# Android HR v0.7 preview: build, install, launch and optionally mirror.
# ASCII-only text for Windows PowerShell 5.1 (UTF-8 without BOM compatibility).
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DeviceSerial,
    [switch]$Mirror
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AndroidProject = Join-Path $ProjectRoot 'tools\android-reader-smoke'
$ApkPath = Join-Path $AndroidProject 'app\build\outputs\apk\debug\app-debug.apk'
$PackageName = 'com.cpiattendance.readerprobe'
$LaunchActivity = "$PackageName/.ReaderHandoffActivity"

function Require-Command {
    param([string]$Name, [string]$Hint)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) { throw "Missing command: $Name. $Hint" }
    return $command
}

function Resolve-Java {
    $java = Get-Command 'java' -ErrorAction SilentlyContinue
    if (-not $java -and $env:JAVA_HOME) {
        $bin = Join-Path $env:JAVA_HOME 'bin'
        if (Test-Path -LiteralPath (Join-Path $bin 'java.exe')) {
            $env:PATH = $bin + ';' + $env:PATH
            $java = Get-Command 'java' -ErrorAction SilentlyContinue
        }
    }
    if (-not $java) {
        throw 'Java is not on PATH. Install JDK 17, close the old VS Code terminal and open a new one.'
    }
    $banner = (& $java.Source --version | Select-Object -First 1)
    $match = [regex]::Match([string]$banner, '^(?:openjdk|java) (\d+)')
    if ($LASTEXITCODE -ne 0 -or -not $match.Success -or [int]$match.Groups[1].Value -lt 17) {
        throw "JDK 17 or later is required. Detected: $banner"
    }
    Write-Host "[setup] $banner" -ForegroundColor Green
}

function Resolve-Gradle {
    $global = Get-Command 'gradle' -ErrorAction SilentlyContinue
    if ($global) {
        $versionText = (& $global.Source --version | Out-String)
        if ($LASTEXITCODE -eq 0 -and $versionText -match '(?m)^\s*Gradle 8\.10\.2\s*$') {
            return $global.Source
        }
    }

    if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is unavailable.' }
    $cacheDir = Join-Path $env:LOCALAPPDATA 'CpiAttendance\build-tools'
    $zip = Join-Path $cacheDir 'gradle-8.10.2-bin.zip'
    $gradleBat = Join-Path $cacheDir 'gradle-8.10.2\bin\gradle.bat'
    $expected = '31c55713e40233a8303827ceb42ca48a47267a0ad4bab9177123121e71524c26'

    if (-not (Test-Path -LiteralPath $gradleBat)) {
        New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
        if (-not (Test-Path -LiteralPath $zip)) {
            Write-Host '[setup] Downloading Gradle 8.10.2 from official distribution...' -ForegroundColor Cyan
            [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
            try {
                Invoke-WebRequest -UseBasicParsing -Uri 'https://services.gradle.org/distributions/gradle-8.10.2-bin.zip' -OutFile $zip
            } catch {
                Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
                throw "Gradle download failed: $_"
            }
        }
        $actual = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected) {
            Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
            throw 'Gradle SHA-256 mismatch. Download removed; do not run this archive.'
        }
        Write-Host '[setup] Gradle checksum verified. Extracting...' -ForegroundColor Cyan
        Expand-Archive -LiteralPath $zip -DestinationPath $cacheDir -Force
    }
    if (-not (Test-Path -LiteralPath $gradleBat)) {
        throw "Gradle executable not found after extraction: $gradleBat"
    }
    return $gradleBat
}

function Resolve-AndroidSdk {
    $candidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT)
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'Android\Sdk') }
    $sdk = $null
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'platforms\android-35\android.jar'))) {
            $sdk = $candidate
            break
        }
    }
    if (-not $sdk) {
        throw 'Android SDK Platform 35 not found. Install Android SDK Platform 35 and Build Tools 35.0.0 in Android Studio SDK Manager, then set ANDROID_HOME.'
    }
    $env:ANDROID_HOME = $sdk
    Write-Host "[setup] Android SDK: $sdk" -ForegroundColor Green
}

Resolve-Java
$GradleExecutable = Resolve-Gradle
Resolve-AndroidSdk
Require-Command -Name 'adb' -Hint 'Install Android Platform Tools and add adb to PATH.' | Out-Null
if ($Mirror) {
    Require-Command -Name 'scrcpy' -Hint 'Install scrcpy or omit -Mirror.' | Out-Null
}

Write-Host '[1/4] Building Android HR v0.7 debug APK...' -ForegroundColor Cyan
& $GradleExecutable --no-daemon --project-dir $AndroidProject :app:assembleDebug
if ($LASTEXITCODE -ne 0) { throw "Gradle build failed (exit code $LASTEXITCODE)." }
if (-not (Test-Path -LiteralPath $ApkPath)) { throw "Built APK not found: $ApkPath" }

$connected = & adb devices
if ($LASTEXITCODE -ne 0) { throw 'adb devices failed.' }
$pattern = '(?m)^' + [regex]::Escape($DeviceSerial) + '[ \t]+device\r?$'
if (([string]::Join([Environment]::NewLine, $connected)) -notmatch $pattern) {
    throw "Device $DeviceSerial is not connected/authorized; check USB debugging and the phone prompt."
}

Write-Host "[2/4] Installing APK to $DeviceSerial..." -ForegroundColor Cyan
& adb -s $DeviceSerial install -r $ApkPath
if ($LASTEXITCODE -ne 0) { throw "ADB installation failed (exit code $LASTEXITCODE). Do not uninstall without backing up app data." }

Write-Host '[3/4] Launching Android HR...' -ForegroundColor Cyan
& adb -s $DeviceSerial shell am force-stop $PackageName
if ($LASTEXITCODE -ne 0) { throw 'Cannot stop prior app instance.' }
& adb -s $DeviceSerial shell am start -n $LaunchActivity
if ($LASTEXITCODE -ne 0) { throw 'Cannot launch ReaderHandoffActivity.' }
& adb -s $DeviceSerial shell dumpsys package $PackageName | Select-String 'versionName='

if ($Mirror) {
    Write-Host '[4/4] Opening screen mirror...' -ForegroundColor Cyan
    & scrcpy -s $DeviceSerial
    if ($LASTEXITCODE -ne 0) { throw 'scrcpy exited with an error.' }
} else {
    Write-Host '[4/4] Done (mirror disabled).' -ForegroundColor Green
}

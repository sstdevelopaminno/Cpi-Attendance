# ASCII-only messages keep this script compatible with Windows PowerShell 5.1
# (which may decode UTF-8 without a BOM using the system ANSI code page).
param(
    [Parameter(Mandatory = $true)]
    [string]$DeviceSerial,
    [switch]$Mirror
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AndroidProject = Join-Path $ProjectRoot "tools\android-reader-smoke"
$ApkPath = Join-Path $AndroidProject "app\build\outputs\apk\debug\app-debug.apk"
$PackageName = "com.cpiattendance.readerprobe"
$LaunchActivity = "$PackageName/.ReaderHandoffActivity"

function Require-Command([string]$Name, [string]$HelpText) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing command: $Name. $HelpText"
    }
}

# A Gradle wrapper is not committed to this Android subproject. Use a verified,
# user-local Gradle 8.10.2 distribution when a compatible global Gradle is absent.
function Resolve-Gradle {
    $globalGradle = Get-Command "gradle" -ErrorAction SilentlyContinue
    if ($globalGradle) {
        $versionOutput = & $globalGradle.Source --version | Out-String
        if ($LASTEXITCODE -eq 0 -and $versionOutput -match '(?m)^Gradle 8\.10\.2\s*
Require-Command "adb" "Install Android Platform Tools and add adb to PATH."
if ($Mirror) {
    Require-Command "scrcpy" "Install scrcpy and add it to PATH, or omit -Mirror."
}

Write-Host "[1/4] Build Android HR Debug APK (UI Preview)" -ForegroundColor Cyan
& $GradleExecutable --no-daemon --project-dir $AndroidProject :app:assembleDebug
if ($LASTEXITCODE -ne 0) { throw "Gradle build failed (exit code $LASTEXITCODE)." }
if (-not (Test-Path -LiteralPath $ApkPath)) { throw "APK not found: $ApkPath" }

$Connected = & adb devices
if ($LASTEXITCODE -ne 0) { throw "adb devices failed (exit code $LASTEXITCODE)." }
$DevicePattern = '(?m)^' + [regex]::Escape($DeviceSerial) + '[ \t]+device\r?$'
if (($Connected -join "`n") -notmatch $DevicePattern) {
    throw "Device $DeviceSerial is not authorized/connected. Check USB debugging and the phone's authorization prompt."
}

Write-Host "[2/4] Install APK on $DeviceSerial" -ForegroundColor Cyan
& adb -s $DeviceSerial install -r $ApkPath
if ($LASTEXITCODE -ne 0) { throw "APK installation failed (exit code $LASTEXITCODE)." }

Write-Host "[3/4] Launch Android HR" -ForegroundColor Cyan
& adb -s $DeviceSerial shell am force-stop $PackageName
if ($LASTEXITCODE -ne 0) { throw "Cannot stop old Android HR instance (exit code $LASTEXITCODE)." }
& adb -s $DeviceSerial shell am start -n $LaunchActivity
if ($LASTEXITCODE -ne 0) { throw "Cannot launch Android HR (exit code $LASTEXITCODE)." }

if ($Mirror) {
    Write-Host "[4/4] Start screen mirror" -ForegroundColor Cyan
    & scrcpy -s $DeviceSerial
    if ($LASTEXITCODE -ne 0) { throw "scrcpy failed (exit code $LASTEXITCODE)." }
} else {
    Write-Host "[4/4] Done (screen mirror not requested)" -ForegroundColor Green
}
) {
            return $globalGradle.Source
        }
    }

    if (-not $env:LOCALAPPDATA) { throw "LOCALAPPDATA is not set; cannot cache Gradle." }
    $cacheDir = Join-Path $env:LOCALAPPDATA "CpiAttendance\build-tools"
    $zipFile = Join-Path $cacheDir "gradle-8.10.2-bin.zip"
    $gradleBat = Join-Path $cacheDir "gradle-8.10.2\bin\gradle.bat"
    $expectedSha256 = "31c55713e40233a8303827ceb42ca48a47267a0ad4bab9177123121e71524c26"
    if (-not (Test-Path -LiteralPath $gradleBat)) {
        New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
        if (-not (Test-Path -LiteralPath $zipFile)) {
            Write-Host "[setup] Downloading pinned Gradle 8.10.2 (~130 MB)..." -ForegroundColor Yellow
            [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
            try {
                Invoke-WebRequest -UseBasicParsing -Uri "https://services.gradle.org/distributions/gradle-8.10.2-bin.zip" -OutFile $zipFile
            } catch {
                Remove-Item -LiteralPath $zipFile -Force -ErrorAction SilentlyContinue
                throw "Gradle download failed. Check internet or proxy. Details: $_"
            }
        }
        $downloadSha = (Get-FileHash -LiteralPath $zipFile -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($downloadSha -ne $expectedSha256) {
            Remove-Item -LiteralPath $zipFile -Force -ErrorAction SilentlyContinue
            throw "Gradle ZIP SHA-256 mismatch; archive removed. Retry with a trusted connection."
        }
        Write-Host "[setup] Verified Gradle ZIP SHA-256; extracting..." -ForegroundColor Cyan
        Expand-Archive -LiteralPath $zipFile -DestinationPath $cacheDir -Force
        if (-not (Test-Path -LiteralPath $gradleBat)) {
            throw "Gradle extraction failed: $gradleBat"
        }
    }
    return $gradleBat
}

$javaExecutable = Get-Command "java" -ErrorAction SilentlyContinue
if (-not $javaExecutable -and $env:JAVA_HOME) {
    $javaFromHome = Join-Path $env:JAVA_HOME "bin\java.exe"
    if (Test-Path -LiteralPath $javaFromHome) {
        $env:PATH = (Join-Path $env:JAVA_HOME "bin") + ";" + $env:PATH
        $javaExecutable = Get-Command "java" -ErrorAction SilentlyContinue
    }
}
if (-not $javaExecutable) {
    throw "JDK 17+ is missing. Install JDK 17 and set JAVA_HOME, then reopen PowerShell."
}
$javaBanner = (& $javaExecutable.Source --version | Select-Object -First 1)
if ($LASTEXITCODE -ne 0 -or $javaBanner -notmatch '^(?:openjdk|java) (\d+)' -or [int]$Matches[1] -lt 17) {
    throw "JDK 17+ is required. Detected: $javaBanner"
}
$GradleExecutable = Resolve-Gradle
Require-Command "adb" "Install Android Platform Tools and add adb to PATH."
if ($Mirror) {
    Require-Command "scrcpy" "Install scrcpy and add it to PATH, or omit -Mirror."
}

Write-Host "[1/4] Build Android HR Debug APK (UI Preview)" -ForegroundColor Cyan
& gradle --no-daemon --project-dir $AndroidProject :app:assembleDebug
if ($LASTEXITCODE -ne 0) { throw "Gradle build failed (exit code $LASTEXITCODE)." }
if (-not (Test-Path -LiteralPath $ApkPath)) { throw "APK not found: $ApkPath" }

$Connected = & adb devices
if ($LASTEXITCODE -ne 0) { throw "adb devices failed (exit code $LASTEXITCODE)." }
$DevicePattern = '(?m)^' + [regex]::Escape($DeviceSerial) + '[ \t]+device\r?$'
if (($Connected -join "`n") -notmatch $DevicePattern) {
    throw "Device $DeviceSerial is not authorized/connected. Check USB debugging and the phone's authorization prompt."
}

Write-Host "[2/4] Install APK on $DeviceSerial" -ForegroundColor Cyan
& adb -s $DeviceSerial install -r $ApkPath
if ($LASTEXITCODE -ne 0) { throw "APK installation failed (exit code $LASTEXITCODE)." }

Write-Host "[3/4] Launch Android HR" -ForegroundColor Cyan
& adb -s $DeviceSerial shell am force-stop $PackageName
if ($LASTEXITCODE -ne 0) { throw "Cannot stop old Android HR instance (exit code $LASTEXITCODE)." }
& adb -s $DeviceSerial shell am start -n $LaunchActivity
if ($LASTEXITCODE -ne 0) { throw "Cannot launch Android HR (exit code $LASTEXITCODE)." }

if ($Mirror) {
    Write-Host "[4/4] Start screen mirror" -ForegroundColor Cyan
    & scrcpy -s $DeviceSerial
    if ($LASTEXITCODE -ne 0) { throw "scrcpy failed (exit code $LASTEXITCODE)." }
} else {
    Write-Host "[4/4] Done (screen mirror not requested)" -ForegroundColor Green
}

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

Require-Command "gradle" "Install Gradle 8.10.2 and JDK 17, then reopen PowerShell."
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

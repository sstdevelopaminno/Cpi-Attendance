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

function Require-Command([string]$Name, [string]$Help) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "ไม่พบคำสั่ง $Name. $Help"
    }
}

Require-Command "gradle" "ติดตั้ง Gradle 8.10.2 และ JDK 17 แล้วเปิด PowerShell ใหม่"
Require-Command "adb" "ติดตั้ง Android Platform Tools และเพิ่ม adb ใน PATH"

Write-Host "[1/4] Build Android HR Debug APK (UI Preview)" -ForegroundColor Cyan
& gradle --no-daemon --project-dir $AndroidProject :app:assembleDebug
if ($LASTEXITCODE -ne 0) { throw "Gradle build ไม่ผ่าน" }
if (-not (Test-Path $ApkPath)) { throw "ไม่พบ APK: $ApkPath" }

$Connected = & adb devices
if (($Connected -join "`n") -notmatch [regex]::Escape($DeviceSerial) + "\s+device") {
    throw "ไม่พบอุปกรณ์ $DeviceSerial ในสถานะ device — ตรวจ USB debugging และหน้าต่างอนุญาตบนมือถือ"
}

Write-Host "[2/4] Install APK on $DeviceSerial" -ForegroundColor Cyan
& adb -s $DeviceSerial install -r $ApkPath
if ($LASTEXITCODE -ne 0) { throw "ติดตั้ง APK ไม่ผ่าน" }

Write-Host "[3/4] Launch Android HR" -ForegroundColor Cyan
& adb -s $DeviceSerial shell am force-stop $PackageName
& adb -s $DeviceSerial shell am start -n $LaunchActivity
if ($LASTEXITCODE -ne 0) { throw "เปิด Android HR ไม่ผ่าน" }

if ($Mirror) {
    Require-Command "scrcpy" "ติดตั้ง scrcpy และเพิ่มไว้ใน PATH"
    Write-Host "[4/4] Start screen mirror" -ForegroundColor Cyan
    & scrcpy -s $DeviceSerial
} else {
    Write-Host "[4/4] เสร็จแล้ว (ไม่ได้เปิด Mirror)" -ForegroundColor Green
}

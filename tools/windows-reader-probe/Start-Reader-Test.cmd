@echo off
chcp 65001 >nul
cd /d "%~dp0"
title CpiAttendance Windows Smart Card Reader Test
echo ======================================================
echo Cpi Attendance - Windows Reader Hardware Test v0.2
echo ======================================================
echo Please connect the USB-C smart card reader and insert
echo your own physical chip card before continuing.
echo.
if not exist "%~dp0CpiAttendance.ReaderProbe.exe" (
  echo ERROR: Missing CpiAttendance.ReaderProbe.exe.
  echo Extract all files from the ZIP into the same folder.
  pause
  exit /b 1
)
"%~dp0CpiAttendance.ReaderProbe.exe"
set "result=%errorlevel%"
echo.
echo Exit code: %result%
echo If the reader is not found, check Windows Smart Card
echo service and the device driver in Device Manager.
echo.
pause
exit /b %result%

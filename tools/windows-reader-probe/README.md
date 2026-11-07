# Cpi Attendance — Windows USB CCID / PC-SC test v0.2 (portable)

This is a **Windows x64 portable hardware smoke-test**, not an MSI installer or a production HR app.
It detects a CCID reader through the native Windows Smart Card (PC/SC) API, attempts card connection and reports only ATR length and protocol.

## Install-free launch
1. Download the `CpiAttendance-Windows-Reader-Portable-x64-v02` GitHub Actions artifact ZIP.
2. **Extract all files first** to a directory you own.
3. Plug in your physical USB-C CCID card reader, insert your own chip card.
4. Double-click `Start-Reader-Test.cmd` (console stays open). Alternatively run `CpiAttendance.ReaderProbe.exe`.
5. If device is missing, check Windows Device Manager and the `Smart Card` service (`SCardSvr`).

The .NET 8 runtime is **bundled** in the Windows x64 single-file executable, so installation of .NET separately is not needed. No admin installation, Microsoft Store or developer mode required.
Windows SmartScreen or endpoint security may still flag unsigned new binaries; verify source and SHA-256 rather than disabling security.

**Privacy:** No ID, personal details, card photo, or APDU payloads are read, logged, stored or sent to network.
**Limitations:** Windows x64 only; cannot validate device physically in GitHub hosted CI. This is an isolated diagnostic; no employee attendance/HR production feature.

See `README_TH.txt` for Thai operating instructions.

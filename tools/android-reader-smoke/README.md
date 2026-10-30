# Cpi Attendance — Android HR v0.7.0 (account-bound preview)

**Internal test only. Not production-approved.** The Android app uses the same **six-digit organization code + six-character HR code + password** as HR Web. On login it enrolls/rotates a tenant- and HR-bound device capability; the server subsequently matches Android and the signed-in HR browser automatically. **No manual device pairing code**.

## Security and workflow

- HR Web: login in a modal with organization code, HR code, and password; the authenticated user opens **+ เพิ่มผู้สมัครใหม่**, confirms the lawful-purpose notice and presses the Android import control.
- Android: a required sign-in popup requests the same organization's HR identity and password (minimum 12 chars). The password and access token are **not persisted**; the issued 128-bit device capability is encrypted with Android Keystore. App restart requires login.
- The Android reader polls only sessions whose `organization_id` and **`hr_user_id`** match the enrolled user; package and role checks fail closed. Switching HR rotates the credential and invalidates the old one. Android reads a chip only after the intended HR opens an authorized request.
- Data is encrypted in the Android app to the requesting HR browser's ephemeral public key. The server receives ciphertext only. Card contents/photo are for authorized transient review, not auto-persisted.
- The legacy **เครื่องมือทดสอบ USB / CCID** button and screen were removed. USB/CCID protocol code used by the real reader remains intact. Manual pairing code input and claim API are retired.
- Debug APK is for internal UI/device acceptance. Debug permits mirroring for review; non-debuggable release keeps `FLAG_SECURE`. Never share screenshots or logs containing Thai ID card information.
- Customer production needs legal/PDPA review, hardware acceptance, on-device auth/entitlement tests and database migration approval. Existing Android v0.6.x will require upgrading before this new enrollment flow can operate.

## Windows — pull source, install APK, and mirror the Android device

Prerequisites: Git, **JDK 17**, **Gradle 8.10.2**, Android SDK Platform 35, `adb` (Android Platform Tools), optionally `scrcpy`; all on `PATH`. Enable Android USB debugging only for the developer's test device, approve the PC's RSA prompt, and use USB data cable.

```powershell
git clone https://github.com/sstdevelopaminno/Cpi-Attendance.git
cd Cpi-Attendance
git fetch origin
git switch feat/hr-bound-android-login-20261029
git pull --ff-only origin feat/hr-bound-android-login-20261029

adb devices
.\scripts\android-device-preview.ps1 -DeviceSerial "10AEBE1N9C001RD" -Mirror
```

If source already exists locally, omit the clone and `cd` into your existing repository, then fetch, switch and pull. ADB serial may differ; use the serial reported by `adb devices`. The PowerShell script runs Gradle debug build, installs the APK using `adb install -r`, opens `com.cpiattendance.readerprobe/.ReaderHandoffActivity` and optionally runs `scrcpy`.

Manual equivalent:

```powershell
gradle --no-daemon --project-dir .\tools\android-reader-smoke :app:assembleDebug
adb -s 10AEBE1N9C001RD install -r .\tools\android-reader-smoke\app\build\outputs\apk\debug\app-debug.apk
adb -s 10AEBE1N9C001RD shell am force-stop com.cpiattendance.readerprobe
adb -s 10AEBE1N9C001RD shell am start -n com.cpiattendance.readerprobe/.ReaderHandoffActivity
scrcpy -s 10AEBE1N9C001RD
```

**Test matrix:** Android login success/failure; login different HR within same tenant; deny wrong org, inactive tenant and exceeded device quota; HR1's Android never receives HR2's session; switching HR revokes old device token; verify approved HR can review ciphertext only after consent; no chip data reaches API/logs; expiry/revocation fail closed. Physical USB/CCID and real-device testing remain mandatory.

## GitHub Actions

`.github/workflows/android-reader-smoke.yml` builds the debug APK, Java protocol tests and SHA-256 artifact where configured. Run acceptance in an isolated/staging environment **before** deploying the new Supabase migration/Edge code or shipping to users.

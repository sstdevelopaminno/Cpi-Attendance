# Cpi Attendance — Zoweetek Android reader test v0.2 (private local card preview)

## Scope
Experimental Android APK **only for the test phone and tester's own real physical chip card**.
Not suitable for employee clock-in, identity verification, retail distribution or production.

Reader photographed by user: Zoweetek Type-C, ZW-12027 family (suffix uncertain).
Previously observed on Android: USB 2CE3:9563, class 0x0B CCID, Android permission granted,
but slot state 2 (card absent) / ICC_MUTE (0xFE) / USB timeouts.
USB device detected does NOT equal chip read success.

## Workflow / screen
1. Discover USB reader and report VID:PID, CCID interface and bulk endpoints.
2. Request explicit Android USB permission.
3. Query CCID slot: state 2 = no card; state 1/0 = card detected.
4. Power on inserted contact chip and check ATR length.
5. Only with owner consent, select Thai ID application and try two minimal reads:
   Thai-language name and 13-digit citizen ID. Display name and last four digits only.
6. Clear button and app background remove displayed data. Screenshots/recents
   protected while sensitive preview is shown.

## Privacy boundary
- AndroidManifest has NO INTERNET permission, no Supabase credentials.
- No photo, DOB, address, full citizen ID, PIN or authentication claims on screen.
- No PII in logs, Actions, databases or filesystem.
- No Attendance schema or CpiPOS database mutation.
- Never upload ID card photographs or unmasked personal information.
- Experimental APDU support is NOT certified or legally approved for commercialization.
  DOPA-specific software/services cannot be assumed redistributable.

## Build / acceptance
Branch: feat/android-usb-ccid-reader-smoke-local-id-v02.
GitHub Actions builds debug-only APK, retains artifact 7 days.
Install only after CI passes and SHA-256 is verified. No root or USB debugging needed.

- [ ] USB 2CE3:9563 and CCID found, Android grants permission
- [ ] Insert/remove physical chip changes slot status
- [ ] ATR is positive length
- [ ] After consent, Thai name matches card and citizen ID shows masked
- [ ] Clear/background hides all private preview
- [ ] Repeat five times without USB timeouts
- [ ] No personal card data transmitted or retained

If slot status is 2, check orientation and seating. If 0xFE/USB timeout persists,
test the reader on a PC with PC/SC to separate OTG/Android implementation issues.
APDU failure does not mean the physical reader itself has failed.

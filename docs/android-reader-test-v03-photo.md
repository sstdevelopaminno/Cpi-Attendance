# Cpi Attendance — Android Zoweetek Full Card + Photo Diagnostic v0.3

**Research-only device compatibility test**, based on v0.2 that the owner reports succeeded 5 consecutive times with their own card. This build **must not be merged into Production HR, attendance APIs, CpiPOS or CRM**.

## Device and verified previous acceptance
- Zoweetek USB-C CCID reader on Android; observed USB VID:PID 2CE3:9563.
- v0.2: USB host, CCID, ATR and local Thai name/masked citizen-number preview pass (5/5 by owner report).
- v0.3: broader text field reads and JPEG photo extraction are **unverified on real card**. CI build is not hardware acceptance.

## On-device workflow
1. Insert the owner's chip card with the CCID reader.
2. Scan USB; allow Android USB permission; test slot status and ATR.
3. Press **5 ทดลองอ่านข้อมูลทุกช่องและภาพถ่ายจากชิป**, confirm the card belongs to you.
4. The reader selects the local Thai ID card applet, requests 10 known fields and up to 20 photo blocks of 255 bytes.
5. Displays the fields including citizen number **and any successfully decoded JPEG photo ONLY in on-device memory**.
6. Press Clear (or background the app) to remove the displayed information; Android FLAG_SECURE blocks screenshots and screen recordings while displayed.

## Diagnostics/limitations
- The app has **no INTERNET permission**, no storage permission, no Supabase credentials and no network upload.
- Does NOT write full card ID or photo to filesystem, cache, logs, Github, telemetry, or any database.
- Only the owner should initiate reads and inspect their own screen; do not send screenshots, names, numbers, photos or raw APDU traces to GitHub or ChatGPT.
- Some optional fields can show unavailable; photo JPEG may fail even if text reads pass. Do not label hardware as defective solely because photo fails.
- Photo reader uses 20 x 255-byte requests starting at offset 0x017B. It validates JPEG SOI/EOI before decoding; other card generations may use different layouts.
- This program does not verify authenticity, liveness or physical cardholder identity. Do not connect this experimental reader to employee onboarding or attendance until privacy, licensing and security review.
- The public GitHub repo contains source only. **Do not upload any real card data or the extracted photo** to repository artifacts/issues.
- v0.3 is an offline diagnostic, independent of future Windows PC/SC and Android Kiosk attendance services.

## CI/installation
- GitHub Actions: `Android USB CCID Reader Smoke APK`. Download artifact `CpiAttendance-ReaderPhoto-v03-debug-apk` only after status green, verify SHA-256.
- Debug signing is ephemeral: if the old APK has a different signer, uninstall `Cpi Reader Test` first.
- No root, developer mode or turning off Play Protect is required.
- After testing, remove card, clear preview, close app. Record only a non-sensitive result: number of fields read, photo shown yes/no, ATR success, device VID:PID and failure codes.

## Next architecture
HR Web is the privileged console and Employee PWA does secure QR/GPS check-in/out. Windows and Android will use a separate OS native card-reader adapter that sends **scoped signed attendance assertions**, never raw cardholder fields, to Attendance API. Enrollment/HR capture has a separate legal purpose and minimum-data consent workflow.

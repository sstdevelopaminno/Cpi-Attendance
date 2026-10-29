# Cpi Attendance — Android USB/CCID Reader Smoke Test

**สถานะ:** Android HR v0.6.2 UI Preview สำหรับทดสอบภายในและพัฒนา UI กับเครื่องจริง

Debug/Test APK จะแสดงป้ายโหมดพัฒนาและอนุญาต screenshot/scrcpy เพื่อปรับ UI ได้
ส่วน non-debuggable Production APK ยังคงเปิด `FLAG_SECURE` เพื่อป้องกันการจับภาพข้อมูลบัตร
ห้ามแชร์ภาพหน้าจอที่มีข้อมูลหรือรูปจากบัตรประชาชนจริง

## เป้าหมายการตรวจ

1. ตรวจว่าโทรศัพท์ Android รองรับ USB Host/OTG หรือไม่
2. ตรวจว่า Android เห็นอุปกรณ์ USB พร้อม `VID:PID` และ CCID interface class `0x0B` หรือไม่
3. ขอ USB permission จากผู้ใช้ (แอปไม่เข้าถึงอุปกรณ์โดยไม่ได้รับอนุญาต)
4. ส่งคำสั่ง `PC_to_RDR_GetSlotStatus` ตามมาตรฐาน USB CCID เพื่อดูว่ามีบัตรอยู่ในช่องหรือไม่
5. เมื่อเสียบบัตรที่ตนเป็นเจ้าของ ส่ง `PC_to_RDR_IccPowerOn` เพื่อยืนยัน ATR **โดยแสดงเพียงขนาด ATR** ไม่แสดงข้อมูลภายใน

แอปไม่มี `android.permission.INTERNET` ไม่เชื่อม Supabase และไม่อ่านข้อมูลส่วนบุคคลจากบัตร
ไม่ส่งคำสั่ง APDU เพื่อดึงเลขประจำตัวประชาชน ชื่อ วันเกิด หรือภาพใบหน้า

## ใช้งานกับ Android

อุปกรณ์ที่ต้องใช้:
- โทรศัพท์หรือแท็บเล็ต Android 8.0 (API 26) ขึ้นไป ที่รองรับ USB Host / OTG
- เครื่องอ่าน Zoweetek USB-CCID
- หัวแปลง USB-A → USB-C แบบ **OTG/data** หากเครื่องอ่านเป็น USB-A
- บัตรสมาร์ทการ์ดของตนเองที่ยินยอมใช้ทดสอบ

ขั้นตอน:
1. ดาวน์โหลด `CpiAttendance-ReaderSmoke-debug-apk` จาก **Artifacts** ของ GitHub Actions ใน workflow **Android USB CCID Reader Smoke APK** (ต้องเข้าระบบ GitHub และดู workflow run ที่ผ่านเท่านั้น)
2. แตก ZIP จะได้ `app-debug.apk` แล้วติดตั้งบน Android ที่ใช้ทดสอบตามข้อความเตือนของระบบ ไม่จำเป็นต้องเปิด USB debugging หรือ root
3. เสียบเครื่องอ่านกับมือถือผ่านหัวแปลง OTG และเปิดฟังก์ชัน OTG ใน Settings หากมี
4. เปิดแอป `Cpi Reader Test` กด **ค้นหาเครื่องอ่าน USB** ดูค่า VID, PID และ `CCID=ใช่`
5. กด **ตรวจสถานะช่องบัตร (CCID)** แล้วกด Allow/อนุญาตเมื่อ Android ขอสิทธิ์ USB
6. ใส่บัตรสมาร์ทการ์ดของตนเอง กด **ทดสอบการเชื่อมต่อบัตร (ATR)** เพื่อรับคำยืนยัน ATR เป็นจำนวนไบต์
7. หลังทดสอบ ถอดบัตรและเครื่องอ่านออก

ผลที่ต้องการ: `CCID สื่อสารสำเร็จ` และ `ทดสอบ ATR ผ่าน (N ไบต์)`

**หาก `ไม่พบ CCID interface`:** รุ่นของเครื่องอาจใช้ไดรเวอร์/SDK เฉพาะหรือ Android/OTG ยังไม่มองเห็นเครื่อง; โปรดจดค่า VID/PID และเลขรุ่นบนสติ๊กเกอร์ แล้วนำมาวิเคราะห์ compatibility แทนการเดา VID/PID ล่วงหน้า

**หาก `ไม่มีอุปกรณ์ USB`:** ตรวจสาย OTG/data, พลังงานจากมือถือ, การเปิด OTG และตรวจว่ารุ่นนี้ทำงานกับ Windows ผ่าน PC/SC ได้หรือไม่

**หาก `ATR ไม่ผ่าน`:** ตรวจวิธีเสียบบัตรและการสัมผัสชิป; แอปนี้รองรับเฉพาะ USB CCID ผ่าน bulk endpoints ไม่รองรับ Smart Card Reader proprietary interface

## Build จาก source

Build configuration:
- Android Gradle Plugin 8.7.3, Gradle 8.10.2, JDK 17
- compileSdk 35, targetSdk 34, minSdk 26
- Java, Android USB Host API, ไม่มีไลบรารีแอปภายนอก
- เป็น Debug APK สำหรับทดสอบภายในเท่านั้น ไม่ใช่ Production-Signed APK

GitHub Actions workflow: `.github/workflows/android-reader-smoke.yml`, คอมไพล์ `app-debug.apk` พร้อม checksum `SHA-256` และเก็บ Artifacts 7 วัน

### ทดสอบ CCID codec แบบไม่ต้องมี Android

```bash
cd tools/android-reader-smoke
mkdir -p /tmp/ccid-classes
javac -d /tmp/ccid-classes \
  app/src/main/java/com/cpiattendance/readerprobe/CcidProtocol.java \
  tests/com/cpiattendance/readerprobe/ProtocolSmokeTest.java
java -cp /tmp/ccid-classes com.cpiattendance.readerprobe.ProtocolSmokeTest
```

### Build ติดตั้งและ Mirror บน Windows

ต้องมี JDK 17, Gradle 8.10.2, Android Platform Tools และ scrcpy ใน `PATH`

```powershell
cd "E:\Cpi-Attendance\Cpi-Attendance"
.\scripts\android-device-preview.ps1 -DeviceSerial "10AEBE1N9C001RD" -Mirror
```

## ขอบเขตที่ยังไม่รองรับ

- ยังไม่ได้ทดสอบกับเครื่อง Zoweetek ของผู้ใช้จริงจากระยะไกล
- ไม่มีการสแกนเลขประจำตัว 13 หลัก และยังไม่มีการยืนยันตัวตนของผู้ถือบัตร
- ยังไม่เชื่อม Cpi Attendance HR/Employee, POS หรือฐานข้อมูล
- ยังไม่รองรับการเสียบบัตรพร้อมอ่านข้อมูลแบบอัตโนมัติหรือ Kiosk production
- USB CCID อาจต่างกันตามเลขรุ่นแม้ใช้ชื่อผู้ผลิตเดียวกัน

ขั้นตอนถัดไปหลังผ่าน Hardware Test: ตรวจสอบ SDK/รุ่นที่ได้จริง, พัฒนา Kiosk Bridge แบบยืนยันอุปกรณ์ ลงทะเบียนเครื่องและความยินยอมของพนักงานก่อนใช้จริง

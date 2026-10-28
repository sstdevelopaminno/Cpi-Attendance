package com.cpiattendance.readerprobe;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Typeface;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Cpi Attendance — isolated Zoweetek reader test.
 * No INTERNET permission, no Supabase, no PII persistence, no employee punch.
 */
public final class MainActivity extends Activity {
    private enum TestMode { NONE, SLOT_STATUS, POWER_ON_ATR, LOCAL_ID_READ, FULL_CARD_READ }
    private UsbManager usbManager;
    private UsbDevice selectedDevice;
    private TestMode pending = TestMode.NONE;
    private ExecutorService worker;
    private String permissionAction;
    private TextView results, stateLabel, privatePreview;
    private ImageView cardPhoto;
    private Button slotButton, atrButton, identityButton, fullButton, clearButton;
    private final StringBuilder lines = new StringBuilder();
    private boolean busy = false;

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (permissionAction.equals(intent.getAction())) {
                UsbDevice granted;
                if (Build.VERSION.SDK_INT >= 33) {
                    granted = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice.class);
                } else {
                    granted = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                }
                if (granted == null || selectedDevice == null ||
                        !granted.getDeviceName().equals(selectedDevice.getDeviceName())) {
                    line("USB permission ไม่ตรงกับอุปกรณ์ที่เลือก");
                    return;
                }
                if (!usbManager.hasPermission(granted)) {
                    pending = TestMode.NONE;
                    line("Android ไม่อนุญาตให้เข้าถึง USB");
                    state("ยังไม่ได้รับสิทธิ์ USB", false);
                    return;
                }
                TestMode test = pending;
                pending = TestMode.NONE;
                line("Android อนุญาต USB สำเร็จ");
                runTest(test);
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(intent.getAction())) {
                clearPrivate();
                scanDevices();
            }
        }
    };

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);
        worker = Executors.newSingleThreadExecutor();
        permissionAction = getPackageName() + ".USB_PERMISSION";
        buildUi();
        IntentFilter filter = new IntentFilter(permissionAction);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(usbReceiver, filter);
        }
        line("เริ่มทดสอบแบบออฟไลน์: ไม่เชื่อมเซิร์ฟเวอร์ ไม่บันทึกข้อมูลบัตร");
        scanDevices();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(246,248,252));
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(20), dp(24), dp(20), dp(28));
        scroll.addView(panel);

        panel.addView(label("Cpi Attendance", 25, Color.rgb(6,76,138), true));
        panel.addView(label("Zoweetek USB-C • Card Reader Test v0.3", 14,
                Color.rgb(77,93,112), false));
        gap(panel, 16);
        stateLabel = label("กำลังตรวจ USB...", 17, Color.rgb(91,101,117), true);
        panel.addView(stateLabel);

        gap(panel, 14);
        panel.addView(label("ตรวจสอบเครื่องอ่าน", 18, Color.rgb(20,39,62), true));
        panel.addView(label("1. เสียบเครื่องอ่าน USB-C (เปิด OTG ถ้าจำเป็น)\n" +
                "2. กดค้นหาเครื่องอ่าน แล้วอนุญาต USB\n" +
                "3. เสียบบัตรจริงที่มีชิปให้สุด แล้วตรวจสถานะบัตร\n" +
                "4. ทดสอบ ATR ก่อนทดลองอ่านข้อมูลบัตร",
                15, Color.rgb(50,68,88), false));

        button("1   ค้นหาอุปกรณ์ USB / CCID", panel)
                .setOnClickListener(v -> scanDevices());
        slotButton = button("2   ตรวจสถานะบัตรในเครื่องอ่าน", panel);
        slotButton.setOnClickListener(v -> requestTest(TestMode.SLOT_STATUS));
        atrButton = button("3   ทดสอบ ATR (สื่อสารกับชิป)", panel);
        atrButton.setOnClickListener(v -> requestTest(TestMode.POWER_ON_ATR));

        gap(panel, 12);
        panel.addView(label("ทดลองอ่านบัตรของฉัน (เฉพาะเครื่องนี้)", 18,
                Color.rgb(20,39,62), true));
        panel.addView(label("อ่านชื่อภาษาไทย และเลขบัตรที่ปิดบังเหลือ 4 หลักสุดท้าย " +
                "เฉพาะเมื่อคุณกดยืนยัน ไม่อ่านภาพ/ที่อยู่ ไม่ส่งข้อมูลออกจากมือถือ",
                14, Color.rgb(63,80,99), false));
        identityButton = button("4   ยืนยันและทดลองอ่านข้อมูลบัตรของฉัน", panel);
        identityButton.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("ยืนยันการอ่านบัตรส่วนตัว")
                .setMessage("คุณเป็นเจ้าของบัตรและอนุญาตให้อ่านชื่อภาษาไทยกับเลขบัตรเพื่อแสดงแบบปิดบัง " +
                        "บนหน้าจอเครื่องนี้เท่านั้นใช่หรือไม่?\n\n" +
                        "แอปไม่มีอินเทอร์เน็ต ไม่มี Supabase และไม่จัดเก็บข้อมูลบัตร")
                .setNegativeButton("ยกเลิก", (d, w) -> {})
                .setPositiveButton("ยืนยันอ่านบัตร", (d, w) -> requestTest(TestMode.LOCAL_ID_READ))
                .show());

        fullButton = button("5   ทดลองอ่านข้อมูลทุกช่องและภาพถ่ายจากชิป", panel);
        fullButton.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("ยืนยันอ่านข้อมูลส่วนตัวจากบัตร")
                .setMessage("เพื่อทดสอบอุปกรณ์เท่านั้น คุณยืนยันว่าเป็นเจ้าของบัตรและต้องการอ่านชื่อ เลขบัตรเต็ม ที่อยู่ วันเกิด วันที่ออก/หมดอายุ และภาพถ่ายจากชิป " +
                        "โดยแสดงเฉพาะบนมือถือเครื่องนี้หรือไม่?\n\n" +
                        "แอปนี้ไม่ส่งอินเทอร์เน็ต ไม่บันทึกไฟล์ ไม่ส่ง Supabase " +
                        "และจะล็อกภาพหน้าจออัตโนมัติ")
                .setNegativeButton("ยกเลิก", (d, w) -> {})
                .setPositiveButton("ยืนยันอ่านบัตรของฉัน", (d, w) -> requestTest(TestMode.FULL_CARD_READ))
                .show());
        privatePreview = label("", 16, Color.rgb(21,58,84), true);
        privatePreview.setPadding(dp(12), dp(8), dp(12), dp(8));
        privatePreview.setBackgroundColor(Color.WHITE);
        privatePreview.setVisibility(View.GONE);
        panel.addView(privatePreview);
        cardPhoto = new ImageView(this);
        cardPhoto.setAdjustViewBounds(true);
        cardPhoto.setMaxHeight(dp(390));
        cardPhoto.setContentDescription("ภาพถ่ายจากชิปบัตร แสดงบนเครื่องเท่านั้น");
        cardPhoto.setVisibility(View.GONE);
        panel.addView(cardPhoto);
        clearButton = button("ล้างข้อมูลส่วนตัวบนหน้าจอ", panel);
        clearButton.setOnClickListener(v -> clearPrivate());
        clearButton.setVisibility(View.GONE);

        gap(panel, 12);
        panel.addView(label("บันทึกผลตรวจอุปกรณ์ (ไม่มีข้อมูลบัตร)", 18,
                Color.rgb(20,39,62), true));
        results = label("", 13, Color.rgb(40,64,88), false);
        results.setPadding(dp(10), dp(12), dp(10), dp(12));
        results.setBackgroundColor(Color.WHITE);
        panel.addView(results);
        gap(panel, 10);
        panel.addView(label("ผลผ่าน USB/CCID ไม่ได้ยืนยันว่าอ่านชิปได้; " +
                "ต้องผ่าน ATR ก่อน การอ่านข้อมูลบัตรเป็นการทดลองเท่านั้น " +
                "ห้ามใช้ยืนยันตัวตนหรือลงเวลาเข้างานจริง",
                13, Color.rgb(100,116,133), false));
        setContentView(scroll);
        updateButtons();
    }

    private Button button(String title, LinearLayout panel) {
        Button b = new Button(this);
        b.setText(title);
        b.setAllCaps(false);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, dp(54));
        p.bottomMargin = dp(8);
        panel.addView(b, p);
        return b;
    }
    private TextView label(String title, int size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(title);
        t.setTextSize(size);
        t.setTextColor(color);
        t.setLineSpacing(dp(4), 1.05f);
        if (bold) t.setTypeface(null, Typeface.BOLD);
        return t;
    }
    private void gap(LinearLayout panel, int size) {
        panel.addView(new View(this), new LinearLayout.LayoutParams(1, dp(size)));
    }
    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
    private void state(String title, boolean good) {
        stateLabel.setText((good ? "● " : "○ ") + title);
        stateLabel.setTextColor(good ? Color.rgb(0,119,77) : Color.rgb(157,85,31));
    }
    private void updateButtons() {
        boolean enabled = selectedDevice != null && !busy && !worker.isShutdown();
        if (slotButton != null) slotButton.setEnabled(enabled);
        if (atrButton != null) atrButton.setEnabled(enabled);
        if (identityButton != null) identityButton.setEnabled(enabled);
        if (fullButton != null) fullButton.setEnabled(enabled);
    }
    private void line(String message) {
        if (lines.length() > 4500) lines.delete(0, 1800);
        lines.append("• ").append(message).append("\n");
        if (results != null) results.setText(lines.toString());
    }
    private void clearPrivate() {
        if (privatePreview != null) {
            privatePreview.setText("");
            privatePreview.setVisibility(View.GONE);
        }
        if (clearButton != null) clearButton.setVisibility(View.GONE);
        if (cardPhoto != null) { cardPhoto.setImageDrawable(null); cardPhoto.setVisibility(View.GONE); }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }

    private void scanDevices() {
        clearPrivate();
        selectedDevice = null;
        Collection<UsbDevice> devices = usbManager.getDeviceList().values();
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_USB_HOST)) {
            line("โทรศัพท์ไม่รายงาน USB Host / OTG");
        }
        line("อุปกรณ์ USB ที่พบ: " + devices.size());
        for (UsbDevice d : devices) {
            int index = UsbCcidSession.findCcidInterface(d);
            line("VID:PID=" + String.format("%04X:%04X", d.getVendorId(), d.getProductId()) +
                    " | CCID=" + (index >= 0 ? "ใช่" : "ไม่พบ"));
            if (index >= 0) {
                line(UsbCcidSession.endpointSummary(d));
                if (selectedDevice == null ||
                        (d.getVendorId() == 0x2CE3 && d.getProductId() == 0x9563)) {
                    selectedDevice = d;
                }
            }
        }
        state(selectedDevice == null ? "ไม่พบเครื่องอ่าน CCID" :
                "พบเครื่องอ่าน CCID (ยังไม่ได้ยืนยันการอ่านบัตร)",
                selectedDevice != null);
        updateButtons();
    }

    private void requestTest(TestMode mode) {
        if (selectedDevice == null || busy) { line("ค้นหาเครื่องอ่าน USB ใหม่ก่อน"); return; }
        clearPrivate();
        if (usbManager.hasPermission(selectedDevice)) { runTest(mode); return; }
        pending = mode;
        line("กำลังขออนุญาต USB จาก Android");
        Intent intent = new Intent(permissionAction).setPackage(getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        usbManager.requestPermission(selectedDevice,
                PendingIntent.getBroadcast(this, 0, intent, flags));
    }

    private void runTest(TestMode mode) {
        if (mode == TestMode.NONE || selectedDevice == null) return;
        busy = true;
        if (mode == TestMode.FULL_CARD_READ || mode == TestMode.LOCAL_ID_READ)
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        updateButtons();
        UsbDevice device = selectedDevice;
        worker.execute(() -> {
            String outcome;
            ThaiIdLocalReader.Preview preview = null;
            ThaiIdFullReader.Details details = null;
            boolean atrGood = false;
            try (UsbCcidSession reader = UsbCcidSession.open(usbManager, device)) {
                CcidProtocol.Response status = reader.slotStatus();
                outcome = "CCID ตอบกลับ: " + status.cardState();
                if (status.cardStatus == 2) {
                    outcome += "\nยังไม่มีบัตรสัมผัสชิป: เสียบบัตรจริงให้สุดและลองใหม่";
                } else if (mode != TestMode.SLOT_STATUS) {
                    boolean powerAttempted = false;
                    try {
                        powerAttempted = true;
                        CcidProtocol.Response power = reader.powerOn();
                        atrGood = power.cardStatus == 0 && power.payloadLength > 0;
                        if (!atrGood) {
                            outcome += "\nATR ไม่ผ่าน: ตรวจบัตร/เครื่องอ่าน";
                        } else {
                            outcome += "\nATR ผ่าน (" + power.payloadLength + " bytes)";
                            if (mode == TestMode.LOCAL_ID_READ) {
                                preview = ThaiIdLocalReader.readOwnCard(reader);
                                outcome += "\nอ่านข้อมูลบัตรในเครื่องสำเร็จ (ปิดบังเลขบัตร)";
                            } else if (mode == TestMode.FULL_CARD_READ) {
                                details = ThaiIdFullReader.read(reader,
                                    (completed,total)->runOnUiThread(()->{
                                        if(stateLabel!=null)state("กำลังอ่านภาพจากบัตร " + completed + "/" + total,false);
                                    }));
                                outcome += "\nอ่านข้อมูลบัตรในเครื่องสำเร็จ (รายละเอียดและสถานะภาพอยู่ในช่องส่วนตัว)";
                            }
                        }
                    } finally {
                        if (powerAttempted) {
                            try { reader.powerOff(); }
                            catch (Exception ignore) { /* cleanup best effort */ }
                        }
                    }
                }
            } catch (Exception e) {
                outcome = "ไม่ผ่าน: " + e.getMessage() +
                        "\nถ้า cardState=2 ให้ตรวจว่าบัตรสัมผัสชิปจริง; " +
                        "หาก USB timeout ให้ลอง OTG ใหม่และปิดแอปอื่นที่ยึดเครื่องอ่าน";
            }
            String message = outcome;
            ThaiIdLocalReader.Preview previewFinal = preview;
            ThaiIdFullReader.Details detailsFinal = details;
            boolean ok = atrGood;
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                line(message);
                if (detailsFinal != null) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    StringBuilder shown = new StringBuilder();
                    for (Map.Entry<String,String> entry : detailsFinal.fields.entrySet()) {
                        shown.append(entry.getKey()).append(": ").append(entry.getValue()).append("\n");
                    }
                    shown.append("\nรูปภาพจากชิป: ").append(detailsFinal.photoStatus);
                    shown.append("\nจำนวนข้อมูลภาพที่ได้รับ: ").append(detailsFinal.photoBytes).append(" bytes");
                    privatePreview.setText(shown.toString());
                    privatePreview.setVisibility(View.VISIBLE);
                    clearButton.setVisibility(View.VISIBLE);
                    if (detailsFinal.photoJpeg != null) {
                        Bitmap bitmap = BitmapFactory.decodeByteArray(detailsFinal.photoJpeg, 0,
                                detailsFinal.photoJpeg.length);
                        if (bitmap != null && bitmap.getWidth() <= 1024 && bitmap.getHeight() <= 1024) {
                            cardPhoto.setImageBitmap(bitmap);
                            cardPhoto.setVisibility(View.VISIBLE);
                        } else {
                            shown.append("\nตัวถอดรหัส Android ไม่รองรับภาพนี้");
                            privatePreview.setText(shown.toString());
                        }
                    }
                    detailsFinal.clear();
                    state("อ่านข้อมูลบัตรในเครื่องแล้ว — ห้ามแชร์ภาพหน้าจอ",true);
                } else if (previewFinal != null) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    privatePreview.setText("ชื่อภาษาไทย: " + previewFinal.thaiName +
                            "\nเลขบัตร (ปิดบัง): " + previewFinal.maskedCitizenId);
                    privatePreview.setVisibility(View.VISIBLE);
                    clearButton.setVisibility(View.VISIBLE);
                    state("อ่านข้อมูลบัตรเฉพาะเครื่องสำเร็จ", true);
                } else {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    state(ok ? "ATR ผ่าน — ชิปตอบกลับแล้ว" :
                            "ยังไม่ยืนยันการอ่านชิป", ok);
                }
                busy = false;
                updateButtons();
            });
        });
    }

    @Override protected void onPause() {
        clearPrivate(); // Clear PII whenever user backgrounds the app.
        super.onPause();
    }

    @Override protected void onDestroy() {
        unregisterReceiver(usbReceiver);
        worker.shutdownNow();
        super.onDestroy();
    }
}

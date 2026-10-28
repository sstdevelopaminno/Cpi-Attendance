package com.cpiattendance.readerprobe;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.Collection;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Isolated, offline Android USB smart-card reader diagnostic.
 * No INTERNET permission, no Thai citizen-ID APDU, no data upload/persistence.
 */
public final class MainActivity extends Activity {
    private enum TestMode { NONE, SLOT_STATUS, POWER_ON_ATR }

    private UsbManager usbManager;
    private UsbDevice selectedDevice;
    private TestMode pending = TestMode.NONE;
    private ExecutorService worker;
    private TextView results;
    private Button statusButton;
    private Button atrButton;
    private final StringBuilder lines = new StringBuilder();
    private String permissionAction;

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (permissionAction.equals(intent.getAction())) {
                UsbDevice grantedDevice;
                if (Build.VERSION.SDK_INT >= 33) {
                    grantedDevice = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice.class);
                } else {
                    grantedDevice = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                }
                if (grantedDevice == null || selectedDevice == null ||
                        !grantedDevice.getDeviceName().equals(selectedDevice.getDeviceName())) {
                    line("ได้รับการตอบกลับ USB ที่ไม่ตรงกับเครื่องที่เลือก");
                    return;
                }
                boolean allowed = usbManager.hasPermission(grantedDevice);
                if (!allowed) {
                    pending = TestMode.NONE;
                    line("ผู้ใช้ไม่อนุญาตให้แอปเข้าถึง USB");
                    updateButtons();
                    return;
                }
                TestMode current = pending;
                pending = TestMode.NONE;
                line("อนุญาต USB สำเร็จ");
                runTest(current);
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(intent.getAction())) {
                scanDevices();
            }
        }
    };

    @Override
    public void onCreate(Bundle saved) {
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
        line("พร้อมตรวจ USB OTG / CCID โดยไม่อ่านข้อมูลส่วนตัวในบัตร");
        scanDevices();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(246,249,253));
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(22), dp(28), dp(22), dp(24));
        scroll.addView(panel);

        TextView brand = label("Cpi Attendance", 23, Color.rgb(15,68,139), true);
        panel.addView(brand);
        panel.addView(label("Zoweetek USB Smart Card — Android Hardware Test", 14,
                Color.rgb(74,94,118), false));
        addGap(panel, 14);
        panel.addView(label("ขั้นตอนทดสอบ", 19, Color.rgb(21,39,62), true));
        panel.addView(label(
                "1. เปิด OTG (หากเครื่องกำหนด) แล้วเสียบ Zoweetek ผ่าน USB-C OTG\n" +
                "2. กดค้นหาอุปกรณ์ USB และอนุญาตการเข้าถึง\n" +
                "3. กดตรวจสถานะช่องบัตร\n" +
                "4. เสียบบัตรของคุณเอง แล้วกดทดสอบ ATR เพื่อยืนยันการสื่อสาร",
                15, Color.rgb(52,71,94), false));
        addGap(panel, 10);

        Button scan = button("1  ค้นหาเครื่องอ่าน USB", panel);
        scan.setOnClickListener(v -> scanDevices());

        statusButton = button("2  ตรวจสถานะช่องบัตร (CCID)", panel);
        statusButton.setOnClickListener(v -> requestTest(TestMode.SLOT_STATUS));

        atrButton = button("3  ทดสอบการเชื่อมต่อบัตร (ATR)", panel);
        atrButton.setOnClickListener(v -> requestTest(TestMode.POWER_ON_ATR));

        addGap(panel, 10);
        panel.addView(label("ผลตรวจสอบ", 18, Color.rgb(21,39,62), true));
        results = label("", 14, Color.rgb(34,62,92), false);
        results.setPadding(dp(12), dp(12), dp(12), dp(12));
        results.setBackgroundColor(Color.WHITE);
        panel.addView(results);
        addGap(panel, 12);
        panel.addView(label(
                "ความเป็นส่วนตัว: แอปนี้ไม่มีสิทธิ์อินเทอร์เน็ต ไม่ดึงชื่อ เลขบัตร ที่อยู่หรือภาพจากบัตร และไม่เชื่อม Supabase",
                13, Color.rgb(88,108,130), false));
        setContentView(scroll);
        updateButtons();
    }

    private Button button(String text, LinearLayout parent) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(52));
        params.bottomMargin = dp(8);
        parent.addView(button, params);
        return button;
    }

    private TextView label(String text, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setLineSpacing(dp(4), 1.05f);
        if (bold) view.setTypeface(null, Typeface.BOLD);
        return view;
    }

    private void addGap(LinearLayout parent, int height) {
        View gap = new View(this);
        parent.addView(gap, new LinearLayout.LayoutParams(1, dp(height)));
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void updateButtons() {
        boolean available = selectedDevice != null && !worker.isShutdown();
        if (statusButton != null) statusButton.setEnabled(available);
        if (atrButton != null) atrButton.setEnabled(available);
    }

    private void line(String text) {
        // Only device IDs, protocol status and ATR length. Never log card payload.
        if (lines.length() > 3500) lines.delete(0, 1600);
        lines.append("• ").append(text).append("\n");
        if (results != null) results.setText(lines.toString());
    }

    private void scanDevices() {
        selectedDevice = null;
        Collection<UsbDevice> devices = usbManager.getDeviceList().values();
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_USB_HOST)) {
            line("โทรศัพท์หรือแท็บเล็ตไม่รองรับ USB Host / OTG");
        }
        line("อุปกรณ์ USB ที่พบ: " + devices.size());
        for (UsbDevice device : devices) {
            int ccidIndex = UsbCcidSession.findCcidInterface(device);
            line("USB VID=" + hex4(device.getVendorId()) +
                    " PID=" + hex4(device.getProductId()) +
                    " | CCID=" + (ccidIndex >= 0 ? "ใช่" : "ไม่พบ") +
                    " | interface=" + device.getInterfaceCount());
            if (selectedDevice == null && ccidIndex >= 0) selectedDevice = device;
        }
        if (selectedDevice == null) {
            line("ยังไม่พบเครื่องอ่านมาตรฐาน CCID: ตรวจสาย OTG, ไฟเลี้ยง, รุ่นอุปกรณ์ หรือ SDK ผู้ผลิต");
        } else {
            line("พร้อมตรวจเครื่อง CCID " + hex4(selectedDevice.getVendorId()) +
                    ":" + hex4(selectedDevice.getProductId()));
        }
        updateButtons();
    }

    private String hex4(int value) {
        return String.format("%04X", value);
    }

    private void requestTest(TestMode mode) {
        if (selectedDevice == null) {
            line("กรุณากดค้นหา USB ใหม่");
            return;
        }
        if (usbManager.hasPermission(selectedDevice)) {
            runTest(mode);
            return;
        }
        pending = mode;
        line("กำลังขอสิทธิ์เข้าถึง USB จาก Android...");
        Intent intent = new Intent(permissionAction).setPackage(getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        // FLAG_MUTABLE: USB manager must be able to insert EXTRA_DEVICE / permission result.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        PendingIntent pi = PendingIntent.getBroadcast(this, 0, intent, flags);
        usbManager.requestPermission(selectedDevice, pi);
    }

    private void runTest(TestMode mode) {
        if (mode == TestMode.NONE) return;
        UsbDevice device = selectedDevice;
        statusButton.setEnabled(false);
        atrButton.setEnabled(false);
        worker.execute(() -> {
            String result;
            try (UsbCcidSession session = UsbCcidSession.open(usbManager, device)) {
                CcidProtocol.Response status = session.slotStatus();
                result = "CCID สื่อสารสำเร็จ: " + status.cardState();
                if (mode == TestMode.POWER_ON_ATR) {
                    if (status.cardStatus == 2) {
                        result += "\nเสียบบัตรก่อนทดสอบ ATR";
                    } else {
                        CcidProtocol.Response powered = session.powerOn();
                        if (powered.cardStatus == 0 && powered.payloadLength > 0) {
                            result += "\nทดสอบ ATR ผ่าน (" + powered.payloadLength +
                                    " ไบต์) — USB กับชิปบัตรสื่อสารกันได้";
                        } else {
                            result += "\nไม่พบ ATR ที่อ่านได้ ตรวจบัตรและรุ่นเครื่อง";
                        }
                        try { session.powerOff(); }
                        catch (Exception ignore) {
                            result += "\nหมายเหตุ: ไม่สามารถปิดไฟบัตรได้ตามปกติ";
                        }
                    }
                }
            } catch (Exception e) {
                result = "ทดสอบไม่ผ่าน: " + e.getMessage() +
                        "\nอาจเป็น USB OTG, CCID ไม่ตรงรุ่น หรือมีแอปอื่นยึดอุปกรณ์";
            }
            String finished = result;
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                line(finished);
                updateButtons();
            });
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterReceiver(usbReceiver);
        worker.shutdownNow();
    }
}

package com.cpiattendance.readerprobe;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import java.io.IOException;
import java.util.Arrays;

/** Offline USB CCID transport for physical Android USB OTG reader tests. */
public final class UsbCcidSession implements AutoCloseable {
    private static final int USB_CCID_CLASS = 0x0B;
    private static final int TRANSFER_TIMEOUT_MS = 4000;
    private static final int MAX_FRAME = CcidProtocol.CCID_HEADER_BYTES + CcidProtocol.MAX_PAYLOAD_BYTES;
    private final UsbDeviceConnection connection;
    private final UsbInterface cardInterface;
    private final UsbEndpoint bulkIn, bulkOut;
    private int nextSequence = 1;

    private UsbCcidSession(UsbDeviceConnection connection, UsbInterface iface, UsbEndpoint in, UsbEndpoint out) {
        this.connection = connection;
        this.cardInterface = iface;
        this.bulkIn = in;
        this.bulkOut = out;
    }

    public static int findCcidInterface(UsbDevice device) {
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);
            if (iface.getInterfaceClass() != USB_CCID_CLASS) continue;
            boolean in = false, out = false;
            for (int j = 0; j < iface.getEndpointCount(); j++) {
                UsbEndpoint e = iface.getEndpoint(j);
                if (e.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
                if (e.getDirection() == UsbConstants.USB_DIR_IN) in = true;
                if (e.getDirection() == UsbConstants.USB_DIR_OUT) out = true;
            }
            if (in && out) return i;
        }
        return -1;
    }

    public static String endpointSummary(UsbDevice device) {
        int n = findCcidInterface(device);
        if (n < 0) return "CCID bulk endpoint ไม่พบ";
        UsbInterface iface = device.getInterface(n);
        StringBuilder s = new StringBuilder("CCID interface ").append(iface.getId());
        for (int i = 0; i < iface.getEndpointCount(); i++) {
            UsbEndpoint e = iface.getEndpoint(i);
            s.append(" | ")
                    .append(e.getDirection() == UsbConstants.USB_DIR_IN ? "IN" : "OUT")
                    .append(" addr=0x").append(Integer.toHexString(e.getAddress()))
                    .append(" packet=").append(e.getMaxPacketSize());
        }
        return s.toString();
    }

    public static UsbCcidSession open(UsbManager manager, UsbDevice device) throws IOException {
        if (!manager.hasPermission(device)) throw new IOException("Android ยังไม่อนุญาต USB");
        int index = findCcidInterface(device);
        if (index < 0) throw new IOException("อุปกรณ์นี้ไม่มี CCID bulk interface");
        UsbInterface iface = device.getInterface(index);
        UsbEndpoint read = null, write = null;
        for (int i = 0; i < iface.getEndpointCount(); i++) {
            UsbEndpoint e = iface.getEndpoint(i);
            if (e.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
            if (e.getDirection() == UsbConstants.USB_DIR_IN) read = e;
            if (e.getDirection() == UsbConstants.USB_DIR_OUT) write = e;
        }
        if (read == null || write == null) throw new IOException("ขาด CCID IN/OUT endpoint");
        UsbDeviceConnection conn = manager.openDevice(device);
        if (conn == null) throw new IOException("เปิดอุปกรณ์ USB ไม่สำเร็จ");
        if (!conn.claimInterface(iface, true)) {
            conn.close();
            throw new IOException("USB interface ถูกใช้งานอยู่หรือ Claim ไม่สำเร็จ");
        }
        return new UsbCcidSession(conn, iface, read, write);
    }

    public CcidProtocol.Response slotStatus() throws IOException {
        return transact(CcidProtocol.PC_TO_RDR_GET_SLOT_STATUS,
                CcidProtocol.RDR_TO_PC_SLOT_STATUS, new byte[0]);
    }
    public CcidProtocol.Response powerOn() throws IOException {
        return transact(CcidProtocol.PC_TO_RDR_ICC_POWER_ON,
                CcidProtocol.RDR_TO_PC_DATA_BLOCK, new byte[0]);
    }
    public void powerOff() throws IOException {
        transact(CcidProtocol.PC_TO_RDR_ICC_POWER_OFF,
                CcidProtocol.RDR_TO_PC_SLOT_STATUS, new byte[0]);
    }
    public byte[] transferApdu(byte[] apdu) throws IOException {
        return transact(CcidProtocol.PC_TO_RDR_XFR_BLOCK,
                CcidProtocol.RDR_TO_PC_DATA_BLOCK, apdu).payload;
    }

    private synchronized CcidProtocol.Response transact(int cmd, int reply, byte[] payload)
            throws IOException {
        int seq = nextSequence++ & 255;
        byte[] request = CcidProtocol.command(cmd, seq, payload);
        int wrote = connection.bulkTransfer(bulkOut, request, request.length, TRANSFER_TIMEOUT_MS);
        if (wrote != request.length) {
            throw new IOException("USB OUT ไม่สำเร็จ (requested=" + request.length +
                    ", written=" + wrote + ")");
        }
        for (int i = 0; i < 8; i++) {
            byte[] frame = readFrame();
            CcidProtocol.Response answer;
            try { answer = CcidProtocol.decode(frame, frame.length, reply, seq); }
            catch (IllegalArgumentException e) {
                throw new IOException("CCID response invalid: " + e.getMessage(), e);
            }
            if (answer.commandStatus == 2) continue; // Time-extension frame.
            if (answer.commandStatus != 0) {
                throw new IOException(String.format("CCID error=0x%02X cardState=%d",
                        answer.errorCode, answer.cardStatus));
            }
            return answer;
        }
        throw new IOException("CCID รอ time-extension เกินกำหนด");
    }

    private byte[] readFrame() throws IOException {
        byte[] raw = new byte[MAX_FRAME];
        int received = 0, expected = CcidProtocol.CCID_HEADER_BYTES;
        while (received < expected) {
            byte[] chunk = new byte[Math.min(512, MAX_FRAME - received)];
            int count = connection.bulkTransfer(bulkIn, chunk, chunk.length, TRANSFER_TIMEOUT_MS);
            if (count <= 0) throw new IOException("USB IN timeout (ไม่มีข้อมูลตอบกลับจากเครื่องอ่าน)");
            if (received + count > MAX_FRAME) throw new IOException("CCID frame เกินขนาด");
            System.arraycopy(chunk, 0, raw, received, count);
            received += count;
            if (received >= CcidProtocol.CCID_HEADER_BYTES) {
                try { expected = CcidProtocol.frameSize(raw, received); }
                catch (IllegalArgumentException e) { throw new IOException("CCID header invalid", e); }
            }
        }
        if (received != expected) throw new IOException("CCID frame มีข้อมูลเกินจากที่ระบุ");
        return Arrays.copyOf(raw, received);
    }

    @Override public void close() {
        try { connection.releaseInterface(cardInterface); }
        finally { connection.close(); }
    }
}

package com.cpiattendance.readerprobe;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import java.io.IOException;

/**
 * USB-host proof of concept for standard USB-CCID readers.
 * Only checks slot state and powers a contact smartcard to receive ATR length.
 * Does NOT issue APDUs; cannot read a Thai ID number, name, DOB or address.
 */
public final class UsbCcidSession implements AutoCloseable {
    private static final int USB_CCID_CLASS = 0x0b;
    private static final int TRANSFER_TIMEOUT_MS = 3000;
    private static final int MAX_CCID_MESSAGE = CcidProtocol.CCID_HEADER_BYTES +
            CcidProtocol.MAX_PAYLOAD_BYTES;
    private final UsbDeviceConnection connection;
    private final UsbInterface cardInterface;
    private final UsbEndpoint bulkIn;
    private final UsbEndpoint bulkOut;
    private int nextSequence = 1;

    private UsbCcidSession(UsbDeviceConnection connection, UsbInterface cardInterface,
                           UsbEndpoint bulkIn, UsbEndpoint bulkOut) {
        this.connection = connection;
        this.cardInterface = cardInterface;
        this.bulkIn = bulkIn;
        this.bulkOut = bulkOut;
    }

    /** CCID devices normally expose a Smart Card interface class 0x0B. */
    public static int findCcidInterface(UsbDevice device) {
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);
            if (iface.getInterfaceClass() != USB_CCID_CLASS) continue;
            boolean hasIn = false, hasOut = false;
            for (int j = 0; j < iface.getEndpointCount(); j++) {
                UsbEndpoint endpoint = iface.getEndpoint(j);
                if (endpoint.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
                if (endpoint.getDirection() == UsbConstants.USB_DIR_IN) hasIn = true;
                if (endpoint.getDirection() == UsbConstants.USB_DIR_OUT) hasOut = true;
            }
            if (hasIn && hasOut) return i;
        }
        return -1;
    }

    public static UsbCcidSession open(UsbManager manager, UsbDevice device) throws IOException {
        if (!manager.hasPermission(device)) throw new IOException("ยังไม่ได้รับอนุญาต USB");
        int index = findCcidInterface(device);
        if (index < 0) throw new IOException("เครื่องไม่แสดง CCID interface (0x0B) อาจต้องใช้ SDK ของผู้ผลิต");
        UsbInterface iface = device.getInterface(index);
        UsbEndpoint read = null, write = null;
        for (int j = 0; j < iface.getEndpointCount(); j++) {
            UsbEndpoint e = iface.getEndpoint(j);
            if (e.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                if (e.getDirection() == UsbConstants.USB_DIR_IN) read = e;
                else if (e.getDirection() == UsbConstants.USB_DIR_OUT) write = e;
            }
        }
        if (read == null || write == null) throw new IOException("ไม่พบ CCID bulk endpoints");
        UsbDeviceConnection conn = manager.openDevice(device);
        if (conn == null) throw new IOException("เปิด USB device ไม่สำเร็จ");
        if (!conn.claimInterface(iface, true)) {
            conn.close();
            throw new IOException("ไม่สามารถ Claim CCID interface ได้");
        }
        return new UsbCcidSession(conn, iface, read, write);
    }

    public CcidProtocol.Response slotStatus() throws IOException {
        return transact(CcidProtocol.PC_TO_RDR_GET_SLOT_STATUS,
                CcidProtocol.RDR_TO_PC_SLOT_STATUS);
    }

    public CcidProtocol.Response powerOn() throws IOException {
        return transact(CcidProtocol.PC_TO_RDR_ICC_POWER_ON,
                CcidProtocol.RDR_TO_PC_DATA_BLOCK);
    }

    public void powerOff() throws IOException {
        transact(CcidProtocol.PC_TO_RDR_ICC_POWER_OFF,
                CcidProtocol.RDR_TO_PC_SLOT_STATUS);
    }

    private synchronized CcidProtocol.Response transact(int commandType, int replyType)
            throws IOException {
        int sequence = nextSequence++ & 0xff;
        byte[] command = CcidProtocol.command(commandType, sequence);
        int written = connection.bulkTransfer(bulkOut, command, command.length,
                TRANSFER_TIMEOUT_MS);
        if (written != command.length) {
            throw new IOException("ส่ง CCID command ไม่สำเร็จ (ส่งได้ " + written + " bytes)");
        }
        // bStatus=0x80.. means the CCID requested a response-time extension.
        for (int retry = 0; retry < 8; retry++) {
            byte[] reply = readFrame();
            CcidProtocol.Response result;
            try {
                result = CcidProtocol.decode(reply, reply.length, replyType, sequence);
            } catch (IllegalArgumentException ex) {
                throw new IOException("CCID ตอบกลับไม่ถูกต้อง: " + ex.getMessage(), ex);
            }
            if (result.commandStatus == 2) continue;
            if (result.commandStatus != 0) {
                throw new IOException(String.format(
                        "CCID command failed (error=0x%02X, cardState=%d)",
                        result.errorCode, result.cardStatus));
            }
            return result;
        }
        throw new IOException("CCID รอตอบกลับนานเกินไป");
    }

    private byte[] readFrame() throws IOException {
        byte[] result = new byte[MAX_CCID_MESSAGE];
        int received = 0;
        int needed = CcidProtocol.CCID_HEADER_BYTES;
        while (received < needed) {
            int amount = Math.min(512, needed - received);
            byte[] chunk = new byte[amount];
            int count = connection.bulkTransfer(bulkIn, chunk, chunk.length, TRANSFER_TIMEOUT_MS);
            if (count <= 0) throw new IOException("รอข้อมูลจากเครื่องอ่านเกินเวลา (USB timeout)");
            System.arraycopy(chunk, 0, result, received, count);
            received += count;
            if (received == CcidProtocol.CCID_HEADER_BYTES) {
                try {
                    needed = CcidProtocol.frameSize(result, received);
                } catch (IllegalArgumentException ex) {
                    throw new IOException("CCID frame ผิดรูปแบบ", ex);
                }
            }
        }
        byte[] frame = new byte[received];
        System.arraycopy(result, 0, frame, 0, received);
        return frame;
    }

    @Override
    public void close() {
        try { connection.releaseInterface(cardInterface); }
        finally { connection.close(); }
    }
}

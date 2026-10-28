package com.cpiattendance.readerprobe;

import java.util.Arrays;

/** Minimal USB CCID packet codec. Card payload is never logged. */
public final class CcidProtocol {
    public static final int PC_TO_RDR_ICC_POWER_ON = 0x62;
    public static final int PC_TO_RDR_ICC_POWER_OFF = 0x63;
    public static final int PC_TO_RDR_GET_SLOT_STATUS = 0x65;
    public static final int PC_TO_RDR_XFR_BLOCK = 0x6F;
    public static final int RDR_TO_PC_DATA_BLOCK = 0x80;
    public static final int RDR_TO_PC_SLOT_STATUS = 0x81;
    public static final int CCID_HEADER_BYTES = 10;
    public static final int MAX_PAYLOAD_BYTES = 3072;

    private CcidProtocol() {}

    public static byte[] command(int type, int sequence) {
        return command(type, sequence, new byte[0]);
    }

    public static byte[] command(int type, int sequence, byte[] payload) {
        if (sequence < 0 || sequence > 255) throw new IllegalArgumentException("bad sequence");
        if (type != PC_TO_RDR_ICC_POWER_ON && type != PC_TO_RDR_ICC_POWER_OFF &&
            type != PC_TO_RDR_GET_SLOT_STATUS && type != PC_TO_RDR_XFR_BLOCK) {
            throw new IllegalArgumentException("unsupported command");
        }
        if (payload == null || payload.length > MAX_PAYLOAD_BYTES ||
            (type != PC_TO_RDR_XFR_BLOCK && payload.length != 0)) {
            throw new IllegalArgumentException("unsupported payload");
        }
        byte[] message = new byte[CCID_HEADER_BYTES + payload.length];
        message[0] = (byte) type;
        int n = payload.length;
        message[1] = (byte) n;
        message[2] = (byte) (n >>> 8);
        message[3] = (byte) (n >>> 16);
        message[4] = (byte) (n >>> 24);
        message[6] = (byte) sequence; // slot 0, protocol-specific params all 0.
        System.arraycopy(payload, 0, message, CCID_HEADER_BYTES, payload.length);
        return message;
    }

    public static int frameSize(byte[] raw, int available) {
        if (available < CCID_HEADER_BYTES) throw new IllegalArgumentException("short CCID header");
        long n = ((long) raw[1] & 255)
                | (((long) raw[2] & 255) << 8)
                | (((long) raw[3] & 255) << 16)
                | (((long) raw[4] & 255) << 24);
        if (n > MAX_PAYLOAD_BYTES) throw new IllegalArgumentException("CCID payload too large");
        return CCID_HEADER_BYTES + (int) n;
    }

    public static Response decode(byte[] raw, int available, int expectedType, int sequence) {
        int total = frameSize(raw, available);
        if (available < total) throw new IllegalArgumentException("incomplete CCID frame");
        int type = raw[0] & 255, slot = raw[5] & 255, seq = raw[6] & 255;
        if (type != expectedType || slot != 0 || seq != sequence) {
            throw new IllegalArgumentException("unexpected CCID message / slot / sequence");
        }
        int status = raw[7] & 255;
        return new Response(type, status & 3, (status >>> 6) & 3, raw[8] & 255,
                Arrays.copyOfRange(raw, CCID_HEADER_BYTES, total));
    }

    public static final class Response {
        public final int type, cardStatus, commandStatus, errorCode, payloadLength;
        // Retained only in process memory for an explicitly requested local read.
        public final byte[] payload;

        Response(int type, int cardStatus, int commandStatus, int errorCode, byte[] payload) {
            this.type = type;
            this.cardStatus = cardStatus;
            this.commandStatus = commandStatus;
            this.errorCode = errorCode;
            this.payload = payload;
            this.payloadLength = payload.length;
        }

        public String cardState() {
            switch (cardStatus) {
                case 0: return "พบบัตร (เปิดใช้งานแล้ว)";
                case 1: return "พบบัตร (ยังไม่เปิดชิป)";
                case 2: return "ไม่พบบัตรในช่องอ่าน";
                default: return "สถานะช่องบัตรไม่รองรับ";
            }
        }
    }
}

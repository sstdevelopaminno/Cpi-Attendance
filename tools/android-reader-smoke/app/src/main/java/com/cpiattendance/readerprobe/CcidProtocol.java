package com.cpiattendance.readerprobe;

/**
 * Small, dependency-free CCID frame codec (USB CCID rev 1.1).
 * Never sends a Thai ID APDU or retrieves cardholder information.
 * This class has no Android dependencies so it is testable on a JDK.
 */
public final class CcidProtocol {
    public static final int PC_TO_RDR_ICC_POWER_ON = 0x62;
    public static final int PC_TO_RDR_ICC_POWER_OFF = 0x63;
    public static final int PC_TO_RDR_GET_SLOT_STATUS = 0x65;
    public static final int RDR_TO_PC_DATA_BLOCK = 0x80;
    public static final int RDR_TO_PC_SLOT_STATUS = 0x81;
    public static final int CCID_HEADER_BYTES = 10;
    public static final int MAX_PAYLOAD_BYTES = 3072;

    private CcidProtocol() {}

    public static byte[] command(int type, int sequence) {
        if (sequence < 0 || sequence > 255) throw new IllegalArgumentException("sequence out of range");
        if (type != PC_TO_RDR_ICC_POWER_ON &&
                type != PC_TO_RDR_ICC_POWER_OFF &&
                type != PC_TO_RDR_GET_SLOT_STATUS) {
            throw new IllegalArgumentException("unsupported command");
        }
        byte[] message = new byte[CCID_HEADER_BYTES];
        message[0] = (byte) type;
        // dwLength=0 (little endian), bSlot=0, bSeq=sequence, reserved=0.
        message[6] = (byte) sequence;
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
        int type = raw[0] & 255;
        int slot = raw[5] & 255;
        int seq = raw[6] & 255;
        if (type != expectedType || slot != 0 || seq != sequence) {
            throw new IllegalArgumentException("unexpected CCID message / slot / sequence");
        }
        int status = raw[7] & 255;
        int commandStatus = (status >>> 6) & 3;
        int cardStatus = status & 3;
        return new Response(type, cardStatus, commandStatus,
                raw[8] & 255, total - CCID_HEADER_BYTES);
    }

    public static final class Response {
        public final int type;
        /** 0=card active, 1=card inactive, 2=no card, 3=reserved. */
        public final int cardStatus;
        /** 0=command OK, 1=error, 2=time extension. */
        public final int commandStatus;
        public final int errorCode;
        public final int payloadLength;

        Response(int type, int cardStatus, int commandStatus,
                 int errorCode, int payloadLength) {
            this.type = type;
            this.cardStatus = cardStatus;
            this.commandStatus = commandStatus;
            this.errorCode = errorCode;
            this.payloadLength = payloadLength;
        }

        public String cardState() {
            switch (cardStatus) {
                case 0: return "พบสมาร์ทการ์ด (เปิดใช้งานแล้ว)";
                case 1: return "พบสมาร์ทการ์ด (ยังไม่ได้เปิดใช้งาน)";
                case 2: return "ยังไม่ได้เสียบบัตร";
                default: return "สถานะช่องบัตรไม่รองรับ";
            }
        }
    }
}

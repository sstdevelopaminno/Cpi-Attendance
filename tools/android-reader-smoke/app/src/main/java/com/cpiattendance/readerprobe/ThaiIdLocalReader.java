package com.cpiattendance.readerprobe;

import java.io.IOException;
import java.nio.charset.Charset;
import java.util.Arrays;

/**
 * Experimental read of minimal Thai national ID smartcard fields, ON DEVICE ONLY.
 * User must explicitly confirm each read. No cardholder data is logged, persisted,
 * exported or transmitted to any API. Not certified for production identity checks.
 * Cards/protocols may differ: APDU failure is a normal unsupported result.
 */
public final class ThaiIdLocalReader {
    private static final byte[] SELECT_THAI_ID = {
        0x00, (byte) 0xA4, 0x04, 0x00, 0x08,
        (byte) 0xA0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01
    };
    private static final Charset THAI = Charset.forName("TIS-620");

    private ThaiIdLocalReader() {}

    public static final class Preview {
        public final String thaiName;
        public final String maskedCitizenId;
        private Preview(String name, String id) {
            thaiName = name;
            maskedCitizenId = id;
        }
    }

    public static Preview readOwnCard(UsbCcidSession reader) throws IOException {
        byte[] selectResponse = reader.transferApdu(SELECT_THAI_ID);
        expectSuccess(reader, selectResponse, "Thai ID application selection");
        // Read only two small fields: 13-digit CID and 100-byte Thai full name.
        // No photo, address, date of birth or other private data is requested.
        byte[] cid = readBinary(reader, 0x0004, 13);
        byte[] name = readBinary(reader, 0x0011, 100);
        String digits = new String(cid, Charset.forName("US-ASCII")).replaceAll("[^0-9]", "");
        if (digits.length() != 13) throw new IOException("หมายเลขบัตรที่ได้รับมีรูปแบบไม่ถูกต้อง");
        String nameText = new String(name, THAI)
                .replace('#', ' ')
                .replace('\u0000', ' ')
                .trim()
                .replaceAll("\\s+", " ");
        if (nameText.isEmpty()) throw new IOException("ช่องชื่อภาษาไทยว่าง หรือรูปแบบบัตรไม่รองรับ");
        Arrays.fill(cid, (byte) 0);
        Arrays.fill(name, (byte) 0);
        // Only retain the last four digits. Full citizen ID never leaves this method.
        return new Preview(nameText, "XXXXXXXXX" + digits.substring(9));
    }

    private static byte[] readBinary(UsbCcidSession reader, int offset, int length) throws IOException {
        byte[] apdu = { (byte) 0x80, (byte) 0xB0,
                (byte) (offset >>> 8), (byte) offset, 0x02, 0x00, (byte) length };
        return expectSuccess(reader, reader.transferApdu(apdu), "READ BINARY");
    }

    /**
     * Thai ID cards may return SW1=61 (GET RESPONSE required). Some readers
     * already return complete data, so do not issue GET RESPONSE unnecessarily.
     */
    private static byte[] expectSuccess(UsbCcidSession reader, byte[] raw, String step) throws IOException {
        if (raw.length < 2) throw new IOException(step + ": ไม่มี SW1/SW2 จากบัตร");
        int sw1 = raw[raw.length - 2] & 255, sw2 = raw[raw.length - 1] & 255;
        if (sw1 == 0x61) {
            byte[] getResponse = { 0x00, (byte) 0xC0, 0x00, 0x00, (byte) sw2 };
            raw = reader.transferApdu(getResponse);
            if (raw.length < 2) throw new IOException(step + ": GET RESPONSE ไม่มีสถานะ");
            sw1 = raw[raw.length - 2] & 255;
            sw2 = raw[raw.length - 1] & 255;
        }
        if (sw1 != 0x90 || sw2 != 0x00) {
            throw new IOException(String.format("%s: APDU SW=%02X%02X (บัตร/รุ่นไม่รองรับ)",
                    step, sw1, sw2));
        }
        return Arrays.copyOf(raw, raw.length - 2);
    }
}

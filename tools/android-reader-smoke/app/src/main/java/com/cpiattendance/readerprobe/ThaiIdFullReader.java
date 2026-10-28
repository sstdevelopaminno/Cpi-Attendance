package com.cpiattendance.readerprobe;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.Charset;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Offline, user-confirmed DIAGNOSTIC ONLY. Native Android reads a Thai ID
 * card in local transient memory. No logging, persistence, network or export.
 * Never use this class for production identity validation or payroll.
 */
public final class ThaiIdFullReader {
    private static final Charset THAI = Charset.forName("TIS-620");
    private static final Charset ASCII = Charset.forName("US-ASCII");
    private static final byte[] SELECT_THAI = {
            0x00, (byte)0xA4, 0x04, 0x00, 0x08,
            (byte)0xA0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01
    };
    private ThaiIdFullReader() {}

    public interface Progress { void photoChunk(int completed, int total); }

    public static final class Details {
        public final Map<String,String> fields;
        public final byte[] photoJpeg;
        public final String photoStatus;
        public final int photoBytes;
        private Details(Map<String,String> fields, byte[] photoJpeg, String status, int photoBytes) {
            this.fields=fields; this.photoJpeg=photoJpeg;
            this.photoStatus=status; this.photoBytes=photoBytes;
        }
        public void clear() {
            fields.clear();
            if (photoJpeg != null) Arrays.fill(photoJpeg, (byte)0);
        }
    }

    public static Details read(UsbCcidSession reader, Progress progress) throws IOException {
        expect(reader, reader.transferApdu(SELECT_THAI), "SELECT");
        Map<String,String> fields=new LinkedHashMap<>();
        // A non-present or unsupported field is flagged on the device, never logged.
        textField(reader, fields, "เลขประจำตัวประชาชน", 0x0004, 13, ASCII);
        textField(reader, fields, "ชื่อ-นามสกุล ภาษาไทย", 0x0011, 100, THAI);
        textField(reader, fields, "ชื่อ-นามสกุล ภาษาอังกฤษ", 0x0075, 100, ASCII);
        textField(reader, fields, "วันเดือนปีเกิด (พ.ศ.)", 0x00D9, 8, ASCII);
        textField(reader, fields, "เพศ (รหัสบนชิป)", 0x00E1, 1, ASCII);
        textField(reader, fields, "หน่วยงานออกบัตร", 0x00F6, 100, THAI);
        textField(reader, fields, "วันออกบัตร (พ.ศ.)", 0x0167, 8, ASCII);
        textField(reader, fields, "วันหมดอายุ (พ.ศ.)", 0x016F, 8, ASCII);
        textField(reader, fields, "ที่อยู่ตามบัตร", 0x1579, 100, THAI);
        textField(reader, fields, "เลขคำขอมีบัตร", 0x1619, 14, ASCII);

        byte[] photo=null;
        String photoStatus="ยังไม่อ่านภาพ";
        int bytes=0;
        try {
            ByteArrayOutputStream image=new ByteArrayOutputStream(5100);
            // 20 chunks of 255 bytes; offsets 0x017B, 0x027A, ... 0x1468.
            for(int part=0;part<20;part++){
                int offset=0x017B + (part*255);
                byte[] block=readBinary(reader,offset,255);
                image.write(block,0,block.length);
                Arrays.fill(block,(byte)0);
                if(progress!=null) progress.photoChunk(part+1,20);
            }
            byte[] buffer=image.toByteArray();
            bytes=buffer.length;
            int jpegEnd=findJpegEnd(buffer);
            if(jpegEnd>0) {
                photo=Arrays.copyOf(buffer,jpegEnd);
                photoStatus="ได้รับภาพ JPEG จากชิป";
            } else {
                photoStatus="ข้อมูลภาพไม่เป็น JPEG ที่สมบูรณ์ หรือบัตรรุ่นนี้ไม่รองรับ";
            }
            Arrays.fill(buffer,(byte)0);
            image.reset();
        } catch(IOException e) {
            // Photo is an optional experimental read. Do not reveal a card payload.
            photoStatus="ไม่สามารถอ่านภาพจากชิปได้ (รหัส/รุ่นบัตรอาจต่างกัน)";
        }
        return new Details(fields,photo,photoStatus,bytes);
    }

    private static void textField(UsbCcidSession reader, Map<String,String> fields,
                                  String name,int offset,int length,Charset charset) {
        try {
            byte[] bytes=readBinary(reader,offset,length);
            String data=new String(bytes,charset).replace('#',' ')
                    .replace('\u0000',' ').replaceAll("\\s+"," ").trim();
            fields.put(name,data.isEmpty()?"(ไม่มีข้อมูล)":data);
            Arrays.fill(bytes,(byte)0);
        } catch(IOException e) {
            fields.put(name,"(บัตรไม่ตอบกลับช่องนี้)");
        }
    }
    private static byte[] readBinary(UsbCcidSession reader,int offset,int length) throws IOException {
        if(length<1||length>255)throw new IllegalArgumentException("bad field length");
        byte[] req={(byte)0x80,(byte)0xB0,(byte)(offset>>8),(byte)offset,0x02,0x00,(byte)length};
        return expect(reader,reader.transferApdu(req),"READ BINARY");
    }
    private static byte[] expect(UsbCcidSession reader,byte[] response,String step) throws IOException {
        if(response.length<2)throw new IOException(step+" missing SW1/SW2");
        int sw1=response[response.length-2]&255;
        int sw2=response[response.length-1]&255;
        if(sw1==0x61) {
            // Thai ID card reports more response bytes: ask for response explicitly.
            byte[] get={(byte)0x00,(byte)0xC0,0,0,(byte)sw2};
            response=reader.transferApdu(get);
            if(response.length<2)throw new IOException(step+" short GET RESPONSE");
            sw1=response[response.length-2]&255;
            sw2=response[response.length-1]&255;
        }
        if(sw1!=0x90||sw2!=0x00) {
            throw new IOException(String.format("%s SW=%02X%02X",step,sw1,sw2));
        }
        return Arrays.copyOf(response,response.length-2);
    }
    /** Finds the JPEG end marker (FF D9) within 5100-byte card photo blocks. */
    static int findJpegEnd(byte[] b) {
        if(b==null||b.length<4||(b[0]&255)!=0xFF||(b[1]&255)!=0xD8)return -1;
        for(int i=2;i<b.length-1;i++){
            if((b[i]&255)==0xFF&&(b[i+1]&255)==0xD9)return i+2;
        }
        return -1;
    }
}

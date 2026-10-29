package com.cpiattendance.readerprobe;

import java.util.Arrays;

public final class ProtocolSmokeTest {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    public static void main(String[] args) {
        byte[] status = CcidProtocol.command(CcidProtocol.PC_TO_RDR_GET_SLOT_STATUS, 7);
        check(status.length == 10, "status command length");
        check((status[0] & 255) == 0x65 && (status[6] & 255) == 7, "status type/sequence");
        byte[] noCard = {(byte) 0x81,0,0,0,0,0,7,2,0,0};
        CcidProtocol.Response r = CcidProtocol.decode(noCard, noCard.length,0x81,7);
        check(r.cardStatus == 2 && r.commandStatus == 0, "not inserted");
        byte[] powered = {(byte) 0x80,4,0,0,0,0,8,0,0,0,0x3b,0x13,0,0};
        CcidProtocol.Response p = CcidProtocol.decode(powered,powered.length,0x80,8);
        check(p.payloadLength == 4 && p.payload[0] == 0x3b, "ATR bytes retained");
        byte[] select = {0, (byte) 0xa4, 4, 0, 8, (byte) 0xa0};
        byte[] command = CcidProtocol.command(CcidProtocol.PC_TO_RDR_XFR_BLOCK,9,select);
        check(command.length == 16 && command[1] == 6 && command[10] == 0 &&
                (command[11] & 255) == 0xa4 && command[6] == 9, "APDU wrapping");
        boolean rejected = false;
        try { CcidProtocol.decode(noCard,noCard.length,0x81,6); }
        catch (IllegalArgumentException e) { rejected = true; }
        check(rejected, "wrong sequence rejected");
        byte[] huge = Arrays.copyOf(noCard,10);
        huge[1] = (byte) 255; huge[2] = 127;
        rejected = false;
        try { CcidProtocol.frameSize(huge,huge.length); }
        catch (IllegalArgumentException e) { rejected = true; }
        check(rejected, "oversize rejected");
        System.out.println("PASS: CCID slot/ATR/APDU framing, states, size, sequence");
    }
}

package com.cpiattendance.readerprobe;

import java.util.Arrays;

public final class ProtocolSmokeTest {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        byte[] status = CcidProtocol.command(CcidProtocol.PC_TO_RDR_GET_SLOT_STATUS, 7);
        check(status.length == 10, "CCID command length");
        check((status[0] & 255) == 0x65, "slot status message type");
        check((status[6] & 255) == 7, "sequence");
        byte[] noCard = {(byte) 0x81,0,0,0,0,0,7,2,0,0};
        CcidProtocol.Response r = CcidProtocol.decode(noCard, noCard.length,0x81,7);
        check(r.cardStatus == 2 && r.commandStatus == 0, "no card status");
        byte[] powered = {(byte) 0x80,4,0,0,0,0,8,0,0,0,0x3b,0x13,0,0};
        CcidProtocol.Response power = CcidProtocol.decode(powered,powered.length,0x80,8);
        check(power.payloadLength == 4, "ATR payload size only");
        check(power.cardStatus == 0, "card powered on");
        boolean rejected = false;
        try { CcidProtocol.decode(noCard,noCard.length,0x81,6); }
        catch (IllegalArgumentException e) { rejected = true; }
        check(rejected, "reject unexpected sequence");
        byte[] huge = Arrays.copyOf(noCard,10);
        huge[1] = (byte) 255; huge[2] = 127;
        rejected = false;
        try { CcidProtocol.frameSize(huge,huge.length); }
        catch (IllegalArgumentException e) { rejected = true; }
        check(rejected, "reject huge frame");
        System.out.println("PASS: CCID command, card status, ATR length, framing and sequence");
    }
}

package com.cpiattendance.readerprobe;

public final class ScreenCapturePolicyTest {
    public static void main(String[] args) {
        require(!ScreenCapturePolicy.shouldProtect(true),
                "debug builds must allow UI mirroring");
        require(ScreenCapturePolicy.shouldProtect(false),
                "non-debuggable builds must keep screen capture protection");
        System.out.println("Screen capture policy tests passed");
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}

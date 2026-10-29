package com.cpiattendance.readerprobe;

/**
 * Keeps screen-capture protection enabled for production builds while allowing
 * scrcpy/screenshots in explicitly debuggable builds used for UI development.
 */
final class ScreenCapturePolicy {
    private ScreenCapturePolicy() {}

    static boolean shouldProtect(boolean appIsDebuggable) {
        return !appIsDebuggable;
    }
}

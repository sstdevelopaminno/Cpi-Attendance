package com.cpiattendance.readerprobe;

/** Pure decision policy for an uncertain encrypted card handoff. */
final class ReaderPublishRecovery {
    enum Decision { RETRY, CONFIRMED, TERMINAL }

    static Decision classify(String status) {
        if ("received".equals(status)||"consumed".equals(status)||"saved".equals(status))
            return Decision.CONFIRMED;
        if ("expired".equals(status)||"cancelled".equals(status))
            return Decision.TERMINAL;
        return Decision.RETRY;
    }
    /** Exponential backoff capped at 30 s. */
    static long retryDelayMillis(int attempt) {
        if(attempt<=0)return 0L;
        long delay=2000L << Math.min(4,attempt-1);
        return Math.min(30000L,delay);
    }
    private ReaderPublishRecovery(){}
}

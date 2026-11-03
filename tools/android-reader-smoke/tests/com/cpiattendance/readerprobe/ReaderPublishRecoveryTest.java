package com.cpiattendance.readerprobe;

public final class ReaderPublishRecoveryTest {
    private static void check(boolean value,String message) {
        if(!value)throw new AssertionError(message);
    }
    public static void main(String[] args) {
        for(String status:new String[]{"received","consumed","saved"})
            check(ReaderPublishRecovery.classify(status)==ReaderPublishRecovery.Decision.CONFIRMED,
                "already published: "+status);
        for(String status:new String[]{"expired","cancelled"})
            check(ReaderPublishRecovery.classify(status)==ReaderPublishRecovery.Decision.TERMINAL,
                "terminal: "+status);
        for(String status:new String[]{"reading","paired","waiting","","unexpected"})
            check(ReaderPublishRecovery.classify(status)==ReaderPublishRecovery.Decision.RETRY,
                "retry: "+status);
        check(ReaderPublishRecovery.retryDelayMillis(0)==0,"zero delay");
        check(ReaderPublishRecovery.retryDelayMillis(1)==2000,"first retry");
        check(ReaderPublishRecovery.retryDelayMillis(2)==4000,"second retry");
        check(ReaderPublishRecovery.retryDelayMillis(5)==30000,"retry cap");
        check(ReaderPublishRecovery.retryDelayMillis(100)==30000,"bounded shift");
    }
}

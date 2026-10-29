package com.cpiattendance.readerprobe;
import java.util.Set;
/** UI checks only. Server must validate org/device/role independently. */
public final class AttendanceAccessPolicy {
    public enum Mode { HR_ENROLLMENT, EMPLOYEE_KIOSK }
    private AttendanceAccessPolicy() {}
    public static boolean canEnter(Mode mode,String role,String org,String pairedOrg,
                                   String pairedMode,Set<String> grants,long expiry,long now) {
        if(mode==null||role==null||org==null||org.isBlank()||
           !org.equals(pairedOrg)||grants==null||now>=expiry)return false;
        if(mode==Mode.HR_ENROLLMENT) return
          ("owner".equals(role)||"hr_admin".equals(role)) &&
          "HR_ENROLLMENT".equals(pairedMode)&&grants.contains("ATT_HR_ANDROID");
        return "kiosk_device".equals(role)&&"EMPLOYEE_KIOSK".equals(pairedMode)
          &&grants.contains("ATT_KIOSK");
    }
}

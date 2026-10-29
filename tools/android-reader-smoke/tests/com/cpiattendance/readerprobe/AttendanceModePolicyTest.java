package com.cpiattendance.readerprobe;
import java.util.Set;
public final class AttendanceModePolicyTest {
  static void test(boolean value){if(!value)throw new AssertionError("profile denied/allowed incorrectly");}
  public static void main(String[] args) {
    long now=1000000;
    test(AttendanceAccessPolicy.canEnter(AttendanceAccessPolicy.Mode.HR_ENROLLMENT,
      "hr_admin","orgA","orgA","HR_ENROLLMENT",Set.of("ATT_HR_ANDROID"),now+1000,now));
    test(!AttendanceAccessPolicy.canEnter(AttendanceAccessPolicy.Mode.HR_ENROLLMENT,
      "employee","orgA","orgA","HR_ENROLLMENT",Set.of("ATT_HR_ANDROID"),now+1000,now));
    test(!AttendanceAccessPolicy.canEnter(AttendanceAccessPolicy.Mode.HR_ENROLLMENT,
      "hr_admin","orgA","orgB","HR_ENROLLMENT",Set.of("ATT_HR_ANDROID"),now+1000,now));
    test(!AttendanceAccessPolicy.canEnter(AttendanceAccessPolicy.Mode.EMPLOYEE_KIOSK,
      "kiosk_device","orgA","orgA","HR_ENROLLMENT",Set.of("ATT_KIOSK"),now+1000,now));
    test(AttendanceAccessPolicy.canEnter(AttendanceAccessPolicy.Mode.EMPLOYEE_KIOSK,
      "kiosk_device","orgA","orgA","EMPLOYEE_KIOSK",Set.of("ATT_KIOSK"),now+1000,now));
    test(!AttendanceAccessPolicy.canEnter(AttendanceAccessPolicy.Mode.EMPLOYEE_KIOSK,
      "kiosk_device","orgA","orgA","EMPLOYEE_KIOSK",Set.of(),now+1000,now));
    test(!AttendanceAccessPolicy.canEnter(AttendanceAccessPolicy.Mode.EMPLOYEE_KIOSK,
      "kiosk_device","orgA","orgA","EMPLOYEE_KIOSK",Set.of("ATT_KIOSK"),now,now));
    System.out.println("PASS HR/Kiosk role, tenant, entitlement and expiration guards");
  }
}

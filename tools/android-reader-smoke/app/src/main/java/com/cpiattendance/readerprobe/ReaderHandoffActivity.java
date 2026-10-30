package com.cpiattendance.readerprobe;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.text.InputFilter;
import android.text.InputType;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.SecureRandom;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import android.util.Base64;

/**
 * HR-authenticated tenant-scoped Android reader; no manually entered pairing codes.
 * Public key from the HR browser; device encrypts ALL card data locally,
 * API only receives AES-GCM ciphertext. Requires the applicant's consent.
 *
 * DO NOT distribute to customers until real Auth/API/retention/legal acceptance.
 */
public final class ReaderHandoffActivity extends Activity {
    private static final int BLUE=Color.rgb(12,79,140);
    private static final int GREEN=Color.rgb(6,145,99);
    // Endpoint comes from a validated build-time resource so debug APKs can
    // test against isolated Supabase staging without changing application code.
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final SecureRandom random=new SecureRandom();
    private UsbManager usb;
    private TextView status,cardHint,connectionHint,readingHint;
    private TextView hrIdentity,readerStatus,apiStatus;
    private volatile boolean loggedIn=false;
    private String currentHrCode="",currentOrganization="";
    private AlertDialog readingDialog,removeDialog;
    private volatile boolean paired=false,reading=false,stopped=false,cardPrompted=false,networkBusy=false;
    private String apiBase="",deviceSecret="",sessionId="",publicKey="",waitingSaveSession="";
    private final Runnable networkLoop=new Runnable(){
      @Override public void run(){
        if(stopped)return;
        pollNetwork();
        handler.postDelayed(this,2600);
      }
    };
    private final String USB_ACTION="com.cpiattendance.readerprobe.READER_PERMISSION";

    private final BroadcastReceiver receiver=new BroadcastReceiver(){
        @Override public void onReceive(Context context,Intent intent){
            if(USB_ACTION.equals(intent.getAction())) {
                if(findReader()!=null&&usb.hasPermission(findReader())) startPolling();
                else showState("ไม่สามารถขอสิทธิ์ USB ได้",false);
            }
        }
    };

    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);
        apiBase=getString(R.string.attendance_api_base);
        applyScreenCapturePolicy();
        usb=(UsbManager)getSystemService(Context.USB_SERVICE);
        IntentFilter filter=new IntentFilter(USB_ACTION);
        if(Build.VERSION.SDK_INT>=33)registerReceiver(receiver,filter,Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver,filter);
        String existing=ReaderSecretStore.load(this);
        if(existing!=null)deviceSecret=existing;
        createUi();
        showState("โปรดเข้าสู่ระบบด้วยบัญชี HR ขององค์กร",false);
        handler.post(networkLoop);
        showLoginPopup();
    }
    private TextView text(String value,int size,int color){
        TextView t=new TextView(this);t.setText(value);t.setTextSize(size);
        t.setTextColor(color);t.setPadding(0,dp(12),0,dp(12));return t;
    }
    private int dp(int units){return Math.round(units*getResources().getDisplayMetrics().density);}
    private GradientDrawable surface(int color,int stroke,int radius){
        GradientDrawable d=new GradientDrawable();
        d.setColor(color);d.setCornerRadius(dp(radius));
        if(stroke!=0)d.setStroke(dp(1),stroke);
        return d;
    }
    private LinearLayout vertical(int padding){
        LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(dp(padding),dp(padding),dp(padding),dp(padding));return l;
    }
    private void createUi(){
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(243,248,255));
        LinearLayout root=vertical(20);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        scroll.addView(root);

        ImageView logo=new ImageView(this);
        logo.setImageResource(R.drawable.cpi_brand_mark);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams logoParams=new LinearLayout.LayoutParams(dp(72),dp(70));
        logoParams.gravity=Gravity.CENTER_HORIZONTAL;
        logoParams.topMargin=dp(7);
        root.addView(logo,logoParams);
        TextView brand=text("Cpi Attendance",26,BLUE);
        brand.setTypeface(null,1);brand.setGravity(Gravity.CENTER);
        root.addView(brand);
        TextView sub=text("ANDROID HR  /  เครื่องอ่านบัตรประชาชน",13,Color.rgb(92,116,145));
        sub.setGravity(Gravity.CENTER);root.addView(sub);
        if(isDebuggableBuild()){
            TextView preview=text("รุ่นทดสอบ · อนุญาตการแสดงหน้าจอบนคอมพิวเตอร์",12,Color.rgb(141,96,29));
            preview.setGravity(Gravity.CENTER);
            preview.setBackground(surface(Color.rgb(255,245,225),0,12));
            LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);
            p.topMargin=dp(9);root.addView(preview,p);
        }

        LinearLayout identity=vertical(17);
        identity.setBackground(surface(Color.WHITE,Color.rgb(218,232,247),20));
        LinearLayout.LayoutParams identityParams=new LinearLayout.LayoutParams(-1,-2);
        identityParams.topMargin=dp(16);root.addView(identity,identityParams);
        TextView identityTitle=text("บัญชีที่เชื่อมต่อ",12,Color.rgb(96,123,150));
        identity.addView(identityTitle);
        hrIdentity=text("ยังไม่ได้เข้าสู่ระบบ HR",17,BLUE);
        hrIdentity.setTypeface(null,1);
        identity.addView(hrIdentity);
        status=text("รอเข้าสู่ระบบ",14,BLUE);status.setTypeface(null,1);
        status.setBackground(surface(Color.rgb(237,245,255),0,12));
        status.setPadding(dp(12),dp(12),dp(12),dp(12));
        identity.addView(status);

        LinearLayout overview=vertical(17);
        overview.setBackground(surface(Color.WHITE,Color.rgb(218,232,247),20));
        LinearLayout.LayoutParams viewParams=new LinearLayout.LayoutParams(-1,-2);
        viewParams.topMargin=dp(12);root.addView(overview,viewParams);
        TextView onlineTitle=text("สถานะอุปกรณ์",17,BLUE);
        onlineTitle.setTypeface(null,1);overview.addView(onlineTitle);
        apiStatus=text("● Attendance API  ·  รอตรวจสอบบัญชี",13,Color.rgb(100,122,149));
        overview.addView(apiStatus);
        readerStatus=text("● เครื่องอ่าน Zoweetek  ·  กำลังตรวจสอบ USB",13,Color.rgb(100,122,149));
        overview.addView(readerStatus);
        connectionHint=text("● HR Web  ·  รอ HR เปิดคำขออ่านบัตร",13,Color.rgb(100,122,149));
        overview.addView(connectionHint);

        LinearLayout workflow=vertical(19);
        workflow.setBackground(surface(Color.rgb(232,243,255),Color.rgb(207,225,250),20));
        LinearLayout.LayoutParams workflowParams=new LinearLayout.LayoutParams(-1,-2);
        workflowParams.topMargin=dp(12);root.addView(workflow,workflowParams);
        TextView workflowTitle=text("ขั้นตอนอ่านบัตรประชาชน",19,BLUE);
        workflowTitle.setTypeface(null,1);workflow.addView(workflowTitle);
        TextView guide=text("1   HR Web เปิดเมนู + เพิ่มผู้สมัครใหม่\n"+
            "2   Android รับคำขอของ HR คนเดียวกันโดยอัตโนมัติ\n"+
            "3   เสียบเครื่อง Zoweetek และบัตรประชาชน\n"+
            "4   ตรวจข้อมูลบน HR Web และกดบันทึก",14,Color.rgb(42,75,109));
        guide.setLineSpacing(dp(7),1f);workflow.addView(guide);
        cardHint=text("รอ HR เปิดคำขอ",21,BLUE);
        cardHint.setTypeface(null,1);workflow.addView(cardHint);
        readingHint=text("ระบบจะอ่านบัตรเฉพาะเมื่อได้รับคำขอที่อนุญาตจาก HR Web",13,
            Color.rgb(90,118,151));workflow.addView(readingHint);

        LinearLayout actions=new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams actionParams=new LinearLayout.LayoutParams(-1,dp(54));
        actionParams.topMargin=dp(18);root.addView(actions,actionParams);
        Button refresh=new Button(this);
        refresh.setText("ตรวจสถานะใหม่");refresh.setAllCaps(false);
        refresh.setTextColor(BLUE);
        refresh.setBackground(surface(Color.WHITE,Color.rgb(203,221,240),15));
        LinearLayout.LayoutParams left=new LinearLayout.LayoutParams(0,-1,1);
        left.rightMargin=dp(6);actions.addView(refresh,left);
        refresh.setOnClickListener(v->{
            showState("กำลังตรวจสอบการเชื่อมต่อ...",loggedIn);
            pollNetwork();
            readerStatus.setText(findReader()==null?
                "● เครื่องอ่าน Zoweetek  ·  ยังไม่เชื่อมต่อ USB":
                "● เครื่องอ่าน Zoweetek  ·  ตรวจพบอุปกรณ์ USB");
        });
        Button changeHr=new Button(this);
        changeHr.setText("เปลี่ยนบัญชี HR");changeHr.setAllCaps(false);
        changeHr.setTextColor(Color.WHITE);
        changeHr.setBackground(surface(Color.rgb(17,107,227),0,15));
        LinearLayout.LayoutParams right=new LinearLayout.LayoutParams(0,-1,1);
        right.leftMargin=dp(6);actions.addView(changeHr,right);
        changeHr.setOnClickListener(v->{
            if(reading||!waitingSaveSession.isEmpty()){
                HrNoticeDialog.show(this,HrNoticeDialog.Kind.WARNING,
                    "ยังเปลี่ยนผู้ใช้ไม่ได้",
                    "กรุณารอให้ HR รับและบันทึกข้อมูลของคำขอปัจจุบันก่อน",
                    "รับทราบ",null,null);
                return;
            }
            HrNoticeDialog.show(this,HrNoticeDialog.Kind.CONFIRM,
                "เปลี่ยนบัญชี HR?",
                "ระบบจะหยุดรับคำขอของบัญชีปัจจุบัน และให้ลงชื่อเข้าใช้ด้วยบัญชี HR ใหม่",
                "เปลี่ยนผู้ใช้","ยกเลิก",()->{
                    loggedIn=false;paired=false;sessionId="";publicKey="";
                    showState("โปรดลงชื่อเข้าใช้ใหม่",false);
                    showLoginPopup();
                });
        });
        TextView note=text("ข้อมูลบัตรและรูปภาพไม่ถูกเก็บในมือถือ\n"+
            "รอ HR ตรวจทานและกดบันทึกบนเว็บก่อนปิดงาน",12,Color.rgb(104,127,147));
        note.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams noteParams=new LinearLayout.LayoutParams(-1,-2);
        noteParams.topMargin=dp(14);
        root.addView(note,noteParams);
        setContentView(scroll);
        readerStatus.setText(findReader()==null?
            "● เครื่องอ่าน Zoweetek  ·  ยังไม่เชื่อมต่อ USB":
            "● เครื่องอ่าน Zoweetek  ·  ตรวจพบอุปกรณ์ USB");
    }
    private boolean isDebuggableBuild(){
        return (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0;
    }
    private void applyScreenCapturePolicy(){
        if(ScreenCapturePolicy.shouldProtect(isDebuggableBuild()))
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        else
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }
    private void popupReading(){
        runOnUiThread(()->{
            if(stopped||readingDialog!=null)return;
            LinearLayout box=vertical(26);box.setGravity(Gravity.CENTER);
            ProgressBar spinner=new ProgressBar(this);spinner.setIndeterminate(true);box.addView(spinner);
            TextView text=text("กำลังตรวจสอบและอ่านชิปบัตร…",18,BLUE);
            text.setGravity(Gravity.CENTER);box.addView(text);
            readingDialog=new AlertDialog.Builder(this)
                .setTitle("Cpi Attendance · กำลังอ่านข้อมูล").setView(box)
                .setCancelable(false).create();
            readingDialog.show();
        });
    }
    private void closeReading(){
        runOnUiThread(()->{if(readingDialog!=null){readingDialog.dismiss();readingDialog=null;}});
    }
    private void popupRemove(){
        runOnUiThread(()->{
            if(stopped)return;
            HrNoticeDialog.show(this,HrNoticeDialog.Kind.SUCCESS,
                "ส่งข้อมูลบัตรสำเร็จ",
                "กรุณาถอดบัตรออก แล้วรอ HR Web ตรวจสอบและบันทึกข้อมูล",
                "รับทราบ",null,null);
        });
    }
    private void showState(String value,boolean online){
        runOnUiThread(()->{
            if(stopped)return;
            status.setText((online?"🟢 ":"🟠 ")+value);
            status.setTextColor(online?Color.rgb(12,133,85):BLUE);
            if(apiStatus!=null)apiStatus.setText(online?
                "● Attendance API  ·  เชื่อมต่อสำเร็จ":
                "● Attendance API  ·  รอตรวจสอบหรือการเชื่อมต่อหลุด");
        });
    }
    private byte[] fresh(int n){byte[] out=new byte[n];random.nextBytes(out);return out;}
    private String hex(byte[] v){StringBuilder s=new StringBuilder();for(byte b:v)s.append(String.format("%02x",b&255));return s.toString();}
    private static final class ApiFailure extends Exception {
        final int status;
        final String errorCode;
        ApiFailure(int status,String errorCode){
            super("API rejected request");this.status=status;this.errorCode=errorCode;
        }
    }
    private String loginError(Exception cause,boolean enrolling){
        if(!(cause instanceof ApiFailure))
            return "เชื่อมต่อไม่ได้ กรุณาตรวจเครือข่ายและลองอีกครั้ง";
        ApiFailure error=(ApiFailure)cause;
        // Production v5 reports 422 invalid_payload on the unknown enroll route
        // (it validates the legacy reader payload before checking route names).
        // A successful HR sign-in must never be misreported as bad credentials.
        if(enrolling&&(error.status==404||"not_found".equals(error.errorCode)||
            (error.status==422&&"invalid_payload".equals(error.errorCode))))
            return "ยืนยันบัญชี HR สำเร็จ แต่เซิร์ฟเวอร์ยังไม่รองรับการผูกเครื่อง v0.7 หรือข้อมูลลงทะเบียนอุปกรณ์ไม่ถูกต้อง กรุณาให้ผู้ดูแลอัปเดต Attendance API";
        if("invalid_credentials".equals(error.errorCode)||error.status==401)
            return "รหัสองค์กร รหัส HR หรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่ได้รับสิทธิ์";
        if("login_rate_limited".equals(error.errorCode)||error.status==429)
            return "เข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่";
        if("reader_device_limit".equals(error.errorCode))
            return "จำนวนเครื่อง Android HR เต็มตามแพ็กเกจ กรุณาจัดการเครื่องใน HR Web";
        if("reader_package_inactive".equals(error.errorCode)||"subscription_inactive".equals(error.errorCode))
            return "แพ็กเกจ Android HR ยังไม่เปิดใช้งานหรือหมดอายุ";
        if("reader_device_denied".equals(error.errorCode))
            return "อุปกรณ์นี้ผูกอยู่กับองค์กรอื่นหรือถูกระงับสิทธิ์";
        if("attendance_hr_forbidden".equals(error.errorCode)||"account_not_authorized".equals(error.errorCode))
            return "บัญชี HR ไม่มีสิทธิ์ในองค์กรนี้";
        if(error.status==426||"server_upgrade_required".equals(error.errorCode))
            return "แอป Login ไม่ได้ เพราะ Attendance API ยังเป็นรุ่นเก่า กรุณาอัปเดตเซิร์ฟเวอร์ให้รองรับ Android HR v0.7 ก่อน";
        if(error.status==503)return "ระบบ Attendance API ยังไม่พร้อมให้บริการ";
        return "ไม่สามารถเข้าสู่ระบบได้ (HTTP "+error.status+") กรุณาตรวจบัญชีและการเชื่อมต่อ API";
    }
    /**
     * Read-only protocol preflight: refuse mismatched server versions before
     * transmitting HR credentials or consuming the login rate-limit allowance.
     * A successful HTTP 200 alone is insufficient (Production v5 is not v0.7).
     */
    private void requireHrBoundReaderApi() throws Exception{
        HttpURLConnection connection=(HttpURLConnection)new URL(apiBase+"/api/health").openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestMethod("GET");
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Cache-Control","no-store");
        try{
            if(connection.getResponseCode()!=200)
                throw new ApiFailure(503,"service_unavailable");
            java.io.ByteArrayOutputStream buffer=new java.io.ByteArrayOutputStream();
            try(java.io.InputStream input=connection.getInputStream()){
                byte[] part=new byte[512];int read;
                while((read=input.read(part))!=-1){
                    if(buffer.size()+read>4096)throw new ApiFailure(503,"service_unavailable");
                    buffer.write(part,0,read);
                }
            }
            JSONObject health=new JSONObject(buffer.toString("UTF-8"));
            if(!health.optBoolean("dbReady",false))
                throw new ApiFailure(503,"service_unavailable");
            if(!"v1".equals(health.optJSONObject("capabilities")==null?""
                :health.getJSONObject("capabilities").optString("hr_bound_android_enrollment","")))
                throw new ApiFailure(426,"server_upgrade_required");
        }finally{
            connection.disconnect();
        }
    }
    private static JSONObject api(String base,String path,JSONObject input)throws Exception{
        return apiWithBearer(base,path,input,null);
    }
    private static JSONObject apiWithBearer(String base,String path,JSONObject input,String bearer)throws Exception{
        if(!base.startsWith("https://")||base.contains("@")||base.contains("#"))
            throw new IllegalArgumentException("ต้องใช้ HTTPS API ที่กำหนดเท่านั้น");
        HttpURLConnection c=(HttpURLConnection)new URL(base+path).openConnection();
        c.setConnectTimeout(8000);c.setReadTimeout(8000);c.setRequestMethod("POST");
        c.setInstanceFollowRedirects(false);c.setDoOutput(true);
        c.setRequestProperty("Content-Type","application/json; charset=utf-8");
        c.setRequestProperty("Cache-Control","no-store");
        if(bearer!=null&&!bearer.isEmpty())c.setRequestProperty("Authorization","Bearer "+bearer);
        byte[] data=input.toString().getBytes(StandardCharsets.UTF_8);
        if(data.length>240000)throw new IllegalArgumentException("encrypted payload too large");
        try{
            c.setFixedLengthStreamingMode(data.length);
            try(OutputStream stream=c.getOutputStream()){stream.write(data);}
            int http=c.getResponseCode();
            if(http!=200){
                String errorCode="request_rejected";
                try(java.io.InputStream in=c.getErrorStream()){
                    if(in!=null){
                        byte[] dataError=new byte[2048];
                        int length=in.read(dataError);
                        if(length>0){
                            JSONObject json=new JSONObject(new String(dataError,0,length,StandardCharsets.UTF_8));
                            String candidate=json.optString("error","");
                            if(candidate.matches("[a-z0-9_]{1,80}"))errorCode=candidate;
                        }
                    }
                }catch(Exception ignored){}
                throw new ApiFailure(http,errorCode);
            }
            StringBuilder response=new StringBuilder();
            try(BufferedReader in=new BufferedReader(new InputStreamReader(c.getInputStream(),StandardCharsets.UTF_8))){
                String line;while((line=in.readLine())!=null){
                    response.append(line);if(response.length()>10000)throw new IllegalArgumentException("response too large");
                }
            }
            return new JSONObject(response.toString()).getJSONObject("data");
        } finally {c.disconnect();}
    }
    private void pollNetwork(){
        if(!loggedIn||deviceSecret.isEmpty()||networkBusy||stopped||reading)return;
        networkBusy=true;
        io.execute(()->{
            try{
                if(!waitingSaveSession.isEmpty()){
                    JSONObject state=api(apiBase,"/api/reader/status",new JSONObject()
                      .put("device_secret",deviceSecret).put("session_id",waitingSaveSession));
                    String value=state.optString("status","");
                    if("consumed".equals(value)){
                        showState("ข้อมูลถึง HR Web แล้ว · รอการบันทึก",true);
                        runOnUiThread(()->{
                          if(removeDialog!=null)removeDialog.setMessage(
                           "โปรดถอดบัตรออก\nข้อมูลแสดงบน HR Web แล้ว รอ HR ตรวจสอบและกดบันทึก");
                        });
                    }
                    if("saved".equals(value)){
                        showState("HR บันทึกใบสมัครแล้ว",true);
                        runOnUiThread(()->{
                           if(removeDialog!=null)removeDialog.setMessage("HR กดบันทึกใบสมัครแล้ว กรุณาถอดบัตรออก");
                        });
                        waitingSaveSession="";
                    }else if("expired".equals(value)||"cancelled".equals(value))waitingSaveSession="";
                    return;
                }
                if(paired){startPolling();return;}
                JSONObject result=api(apiBase,"/api/reader/next",
                    new JSONObject().put("device_secret",deviceSecret));
                showState("เชื่อมต่อแล้ว · ออนไลน์",true);
                if(!result.has("session_id")){
                    runOnUiThread(()->{
                        cardHint.setText("โปรดเสียบบัตรประชาชน");
                        readingHint.setText("รอ HR เปิด + เพิ่มผู้สมัครใหม่\nยังไม่อ่านชิปเมื่อไม่มีคำขอ");
                    });
                }else{
                    sessionId=result.getString("session_id");
                    publicKey=result.getString("public_key_spki");
                    paired=true;cardPrompted=false;
                    runOnUiThread(()->readingHint.setText("HR เปิดคำขอรับสมัครแล้ว\nพร้อมอ่านชิปและส่งข้อมูล"));
                    startPolling();
                }
            }catch(Exception e){showState("ออฟไลน์ · ตรวจเครือข่ายหรือสิทธิ์เครื่อง",false);}
            finally{networkBusy=false;}
        });
    }
    /** Android HR and HR Web use the same identity. No password or JWT is persisted. */
    private void showLoginPopup(){
        new HrLoginDialog(this).show((orgCode,hrCode,pass,done)->io.execute(()->{
            boolean enrolling=false;
            try{
                requireHrBoundReaderApi();
                JSONObject auth=api(apiBase,"/api/auth/login",new JSONObject()
                    .put("organization_code",orgCode).put("employee_code",hrCode)
                    .put("password",pass));
                JSONObject context=auth.getJSONObject("context");
                String role=context.optString("role","");
                String organizationId=context.getString("organization_id");
                String authenticatedHrId=context.getString("hr_user_id");
                if(!("owner".equals(role)||"hr_admin".equals(role))||
                    !organizationId.matches("[0-9a-fA-F-]{36}")||
                    !authenticatedHrId.matches("[0-9a-fA-F-]{36}")||
                    !orgCode.equals(context.getString("organization_code")))
                    throw new IllegalStateException("HR identity denied");
                String candidate=hex(fresh(16));
                JSONObject enrollment=new JSONObject()
                    .put("organization_id",organizationId).put("device_secret",candidate);
                if(!deviceSecret.isEmpty())enrollment.put("previous_device_secret",deviceSecret);
                enrolling=true;
                JSONObject receipt=apiWithBearer(apiBase,"/api/reader/enroll",enrollment,
                    auth.getString("access_token"));
                // Fail closed: only a receipt for this exact tenant and HR user
                // allows persisting the new device capability into Android Keystore.
                if(!receipt.optBoolean("enrolled",false)||
                    !organizationId.equalsIgnoreCase(receipt.optString("organization_id",""))||
                    !authenticatedHrId.equalsIgnoreCase(receipt.optString("hr_user_id",""))||
                    !receipt.optString("device_id","").matches("[0-9a-fA-F-]{36}"))
                    throw new IllegalStateException("Device identity binding mismatch");
                ReaderSecretStore.save(this,candidate);
                deviceSecret=candidate;currentHrCode=hrCode;currentOrganization=orgCode;
                loggedIn=true;paired=false;sessionId="";publicKey="";waitingSaveSession="";
                cardPrompted=false;
                runOnUiThread(()->{
                    hrIdentity.setText("องค์กร "+currentOrganization+" · HR "+currentHrCode);
                    cardHint.setText("โปรดเสียบบัตรประชาชน");
                    readingHint.setText("รอ HR "+currentHrCode+" เปิดคำขอจาก HR Web\nอ่านบัตรเฉพาะเมื่อ HR ได้รับอนุญาต");
                });
                done.success();
                showState("เข้าสู่ระบบสำเร็จ · พร้อมเชื่อม HR Web",true);
            }catch(Exception failure){
                done.failure(loginError(failure,enrolling));
                if(enrolling && failure instanceof ApiFailure){
                    ApiFailure apiFailure=(ApiFailure)failure;
                    if("reader_device_limit".equals(apiFailure.errorCode)){
                        runOnUiThread(()->HrNoticeDialog.show(this,HrNoticeDialog.Kind.WARNING,
                            "จำนวนเครื่องครบตามแพ็กเกจ",
                            "บัญชี HR ได้รับการยืนยันแล้ว แต่จำนวนเครื่อง Android HR ขององค์กรเต็ม กรุณาปิดสิทธิ์เครื่องที่ไม่ได้ใช้จาก HR Web ก่อน",
                            "เปิด HR Web","กลับไปเข้าสู่ระบบ",()->{
                                Intent web=new Intent(Intent.ACTION_VIEW,
                                    android.net.Uri.parse("https://cpi-attendance-hr.vercel.app/"));
                                startActivity(web);
                            }));
                    }else if("reader_device_denied".equals(apiFailure.errorCode)
                        && !deviceSecret.isEmpty()){
                        runOnUiThread(()->HrNoticeDialog.show(this,HrNoticeDialog.Kind.CONFIRM,
                            "ข้อมูลจับคู่เดิมใช้ไม่ได้",
                            "อุปกรณ์นี้มีข้อมูลจับคู่เดิมที่เซิร์ฟเวอร์ไม่ยอมรับ ต้องการล้างข้อมูลจับคู่เฉพาะบนมือถือ แล้วลงชื่อเข้าใช้ใหม่หรือไม่? ระบบยังตรวจจำนวนเครื่องตามแพ็กเกจตามปกติ",
                            "ล้างการจับคู่เดิม","ยกเลิก",()->{
                                ReaderSecretStore.clear(this);
                                deviceSecret="";
                            }));
                    }
                }
                showState("ยังไม่ได้เข้าสู่ระบบ HR",false);
            }
        }));
    }
    private UsbDevice findReader(){
        for(UsbDevice d:usb.getDeviceList().values())
            if(UsbCcidSession.findCcidInterface(d)>=0)return d;
        return null;
    }
    private void startPolling(){
        if(!paired||stopped)return;
        UsbDevice d=findReader();
        if(d==null){showState("เชื่อม HR แล้ว · ไม่พบเครื่องอ่าน USB-C",true);retry();return;}
        if(!usb.hasPermission(d)){
            PendingIntent request=PendingIntent.getBroadcast(this,55,new Intent(USB_ACTION).setPackage(getPackageName()),
                PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_MUTABLE);
            usb.requestPermission(d,request);return;
        }
        if(reading||cardPrompted)return;
        io.execute(()->{
            try(UsbCcidSession reader=UsbCcidSession.open(usb,d)){
                if(reader.slotStatus().cardStatus!=2){
                    cardPrompted=true;
                    readAndTransfer(d);
                }else retry();
            }catch(Exception e){showState("เครื่องอ่านยังไม่พร้อม · โปรดตรวจ OTG",true);retry();}
        });
    }
    private void retry(){if(!stopped&&paired)handler.postDelayed(this::startPolling,1400);}
    private void readAndTransfer(UsbDevice device){
        if(!paired||reading)return;
        reading=true;popupReading();showState("กำลังตรวจสอบและอ่านชิป...",true);
        io.execute(()->{
            ThaiIdFullReader.Details details=null;
            try{
                api(apiBase,"/api/reader/progress",new JSONObject()
                    .put("session_id",sessionId).put("device_secret",deviceSecret));
                try(UsbCcidSession reader=UsbCcidSession.open(usb,device)){
                    if(reader.slotStatus().cardStatus==2)throw new IllegalStateException("card absent");
                    reader.powerOn();
                    try{details=ThaiIdFullReader.read(reader,(now,total)->
                        showState("กำลังอ่านรูปภาพจากชิป "+now+"/"+total,true));
                    }finally{try{reader.powerOff();}catch(Exception ignored){}}
                }
                JSONObject card=extract(details);
                JSONObject envelope=encrypt(card,publicKey);
                api(apiBase,"/api/reader/publish",new JSONObject()
                    .put("session_id",sessionId).put("device_secret",deviceSecret)
                    .put("payload",envelope));
                waitingSaveSession=sessionId;
                paired=false;publicKey="";sessionId="";
                showState("ส่งข้อมูลเข้ารหัสแล้ว · รอ HR รับและบันทึก",true);
                runOnUiThread(()->{
                    cardHint.setText("โปรดถอดบัตรประชาชนออก");
                    readingHint.setText("ส่งข้อมูลถึง Attendance API แล้ว รอ HR รับและบันทึก");
                });
                closeReading();popupRemove();
            }catch(Exception e){
                // An expired/cancelled HR request is terminal. Never keep
                // attempting /reader/progress for the same rejected session.
                if(e instanceof ApiFailure && (((ApiFailure)e).status==403||
                    ((ApiFailure)e).status==404)){
                    paired=false;sessionId="";publicKey="";cardPrompted=false;
                    showState("คำขออ่านบัตรสิ้นสุดหรือถูกยกเลิก · รอ HR เปิดคำขอใหม่",false);
                }else{
                    showState("อ่าน/ส่งไม่สำเร็จ · ตรวจเครื่องอ่านและการเชื่อมต่อ ("+
                        e.getClass().getSimpleName()+")",false);
                    cardPrompted=false;retry();
                }
            }finally{
                closeReading();
                if(details!=null)details.clear();reading=false;
            }
        });
    }
    private static String get(Map<String,String> fields,String name){
        String x=fields.get(name);if(x==null||x.startsWith("("))return "";
        return x.replace('#',' ').replaceAll("\\s+"," ").trim();
    }
    private static String date(String raw){
        // Chip date is commonly YYYYMMDD in Buddhist Era. Leave blank if invalid.
        if(raw==null||!raw.matches("\\d{8}"))return "";
        try{
            int year=Integer.parseInt(raw.substring(0,4));if(year>2400)year-=543;
            int month=Integer.parseInt(raw.substring(4,6)),day=Integer.parseInt(raw.substring(6,8));
            return java.time.LocalDate.of(year,month,day).toString();
        }catch(Exception ignored){return "";}
    }
    private static JSONObject extract(ThaiIdFullReader.Details d)throws Exception{
        Map<String,String> m=d.fields;
        String cid=get(m,"เลขประจำตัวประชาชน");
        if(!cid.matches("\\d{13}"))throw new IllegalArgumentException("card ID invalid");
        JSONObject j=new JSONObject();
        String thai=get(m,"ชื่อ-นามสกุล ภาษาไทย");
        String english=get(m,"ชื่อ-นามสกุล ภาษาอังกฤษ");
        String thaiPrefix="",englishPrefix="";
        for(String prefix:new String[]{"นางสาว","น.ส.","นาย","นาง"}){
            if(thai.startsWith(prefix+" ")){
                thaiPrefix=prefix;thai=thai.substring(prefix.length()).trim();break;
            }
        }
        for(String prefix:new String[]{"Miss","Mrs.","Mr.","Ms.","Mr","Mrs","Ms"}){
            if(english.startsWith(prefix+" ")){
                englishPrefix=prefix;english=english.substring(prefix.length()).trim();break;
            }
        }
        j.put("thai_prefix",thaiPrefix);
        j.put("english_prefix",englishPrefix);
        j.put("full_name",thai);
        j.put("english_name",english);
        j.put("national_id",cid);
        j.put("dob",date(get(m,"วันเดือนปีเกิด (พ.ศ.)")));
        String g=get(m,"เพศ (รหัสบนชิป)");
        j.put("gender","1".equals(g)?"male":"2".equals(g)?"female":"");
        j.put("issuer",get(m,"หน่วยงานออกบัตร"));
        j.put("issued",date(get(m,"วันออกบัตร (พ.ศ.)")));
        j.put("expires",date(get(m,"วันหมดอายุ (พ.ศ.)")));
        j.put("address",get(m,"ที่อยู่ตามบัตร"));
        if(d.photoJpeg!=null&&d.photoJpeg.length>0&&d.photoJpeg.length<=100000){
            j.put("photo",new JSONObject().put("media_type","image/jpeg")
                .put("base64",Base64.encodeToString(d.photoJpeg,Base64.NO_WRAP)));
        }
        return j;
    }
    private JSONObject encrypt(JSONObject card,String rsaPublicBase64)throws Exception{
        byte[] raw=Base64.decode(rsaPublicBase64,Base64.DEFAULT);
        java.security.PublicKey publicKey=KeyFactory.getInstance("RSA")
            .generatePublic(new X509EncodedKeySpec(raw));Arrays.fill(raw,(byte)0);
        KeyGenerator generator=KeyGenerator.getInstance("AES");generator.init(256);
        SecretKey aes=generator.generateKey();
        byte[] iv=fresh(12);
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,aes,new GCMParameterSpec(128,iv));
        byte[] ciphertext=cipher.doFinal(card.toString().getBytes(StandardCharsets.UTF_8));
        Cipher rsa=Cipher.getInstance("RSA/ECB/OAEPPadding");
        rsa.init(Cipher.ENCRYPT_MODE,publicKey,new OAEPParameterSpec(
            "SHA-256","MGF1",MGF1ParameterSpec.SHA256,PSource.PSpecified.DEFAULT));
        byte[] wrapped=rsa.doFinal(aes.getEncoded());
        JSONObject out=new JSONObject().put("iv",Base64.encodeToString(iv,Base64.NO_WRAP))
            .put("wrapped_key",Base64.encodeToString(wrapped,Base64.NO_WRAP))
            .put("ciphertext",Base64.encodeToString(ciphertext,Base64.NO_WRAP));
        Arrays.fill(wrapped,(byte)0);Arrays.fill(ciphertext,(byte)0);
        return out;
    }
    private void resetSession(){
        paired=false;reading=false;cardPrompted=false;
        sessionId="";publicKey="";waitingSaveSession="";
        closeReading();
        showState("รอ HR "+currentHrCode+" เปิดคำขอรับสมัคร",loggedIn);
    }
    @Override protected void onDestroy(){
        stopped=true;paired=false;handler.removeCallbacksAndMessages(null);
        closeReading();
        if(removeDialog!=null)removeDialog.dismiss();
        try{unregisterReceiver(receiver);}catch(Exception ignored){}
        io.shutdownNow();super.onDestroy();
    }
}

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
    private static final String API_BASE="https://wznixoeezgyhtwurcswb.supabase.co/functions/v1/attendance-api";
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final SecureRandom random=new SecureRandom();
    private UsbManager usb;
    private TextView status,cardHint,connectionHint,readingHint;
    private TextView hrIdentity;
    private volatile boolean loggedIn=false;
    private String currentHrCode="",currentOrganization="";
    private AlertDialog readingDialog,removeDialog;
    private volatile boolean paired=false,reading=false,stopped=false,cardPrompted=false,networkBusy=false;
    private String apiBase=API_BASE,deviceSecret="",sessionId="",publicKey="",waitingSaveSession="";
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
        scroll.setFillViewport(true);scroll.setBackgroundColor(Color.rgb(245,249,254));
        LinearLayout root=vertical(22);root.setGravity(Gravity.CENTER_HORIZONTAL);
        scroll.addView(root);

        TextView brand=text("Cpi Attendance",28,BLUE);brand.setTypeface(null,1);
        brand.setGravity(Gravity.CENTER);root.addView(brand);
        TextView sub=text("ANDROID HR  ·  เครื่องอ่านบัตร Zoweetek",13,Color.rgb(91,115,140));
        sub.setGravity(Gravity.CENTER);root.addView(sub);
        if(isDebuggableBuild()){
            TextView preview=text("โหมดพัฒนา · อนุญาตการ Mirror หน้าจอ",12,Color.rgb(151,91,0));
            preview.setGravity(Gravity.CENTER);
            preview.setBackground(surface(Color.rgb(255,245,219),Color.rgb(238,196,104),14));
            LinearLayout.LayoutParams previewParams=new LinearLayout.LayoutParams(-1,-2);
            previewParams.setMargins(0,dp(10),0,0);root.addView(preview,previewParams);
        }

        LinearLayout indicator=vertical(15);
        indicator.setBackground(surface(Color.WHITE,Color.rgb(217,231,244),22));
        LinearLayout.LayoutParams iParams=new LinearLayout.LayoutParams(-1,-2);
        iParams.setMargins(0,dp(22),0,dp(22));root.addView(indicator,iParams);
        status=text("",16,BLUE);status.setTypeface(null,1);status.setGravity(Gravity.CENTER);
        indicator.addView(status);
        connectionHint=text("เชื่อมต่อปลอดภัยกับองค์กร HR",12,Color.GRAY);
        connectionHint.setGravity(Gravity.CENTER);indicator.addView(connectionHint);

        FrameLayout illustration=new FrameLayout(this);
        illustration.setBackground(surface(Color.rgb(213,237,245),Color.rgb(137,192,213),28));
        LinearLayout.LayoutParams ill=new LinearLayout.LayoutParams(-1,dp(220));
        ill.setMargins(0,dp(8),0,dp(15));root.addView(illustration,ill);
        TextView cardHeader=text("บัตรประจำตัวประชาชน\nThai National ID Card",19,BLUE);
        cardHeader.setTypeface(null,1);
        FrameLayout.LayoutParams head=new FrameLayout.LayoutParams(-1,-2,Gravity.TOP);
        head.setMargins(dp(22),dp(18),dp(22),0);illustration.addView(cardHeader,head);
        TextView chip=text("▦",45,Color.rgb(182,144,48));
        chip.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams chipP=new FrameLayout.LayoutParams(dp(73),dp(72),Gravity.START|Gravity.CENTER_VERTICAL);
        chipP.setMargins(dp(28),0,0,0);
        chip.setBackground(surface(Color.rgb(250,229,147),Color.rgb(206,179,95),12));
        illustration.addView(chip,chipP);
        TextView lines=text("━━━━━━━━━━━━━━\n━━━━━━━━━━━\n━━━━━━━",14,Color.rgb(86,143,159));
        FrameLayout.LayoutParams linesP=new FrameLayout.LayoutParams(-2,-2,Gravity.START|Gravity.BOTTOM);
        linesP.setMargins(dp(25),0,0,dp(12));illustration.addView(lines,linesP);
        TextView portrait=text("รูปภาพ\nผู้ถือบัตร",13,Color.rgb(95,133,151));
        portrait.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams photoP=new FrameLayout.LayoutParams(dp(94),dp(105),Gravity.END|Gravity.BOTTOM);
        photoP.setMargins(0,0,dp(22),dp(20));
        portrait.setBackground(surface(Color.rgb(246,252,254),Color.rgb(181,207,219),12));
        illustration.addView(portrait,photoP);

        cardHint=text("โปรดเสียบบัตรประชาชน",24,BLUE);cardHint.setTypeface(null,1);
        cardHint.setGravity(Gravity.CENTER);root.addView(cardHint);
        readingHint=text("เมื่อ HR กด + เพิ่มผู้สมัครใหม่ ระบบจะอ่านบัตรอัตโนมัติ\nข้อมูลถูกเข้ารหัสและรอให้ HR ตรวจสอบก่อนบันทึก",13,Color.rgb(112,135,153));
        readingHint.setGravity(Gravity.CENTER);root.addView(readingHint);

        hrIdentity=text("ยังไม่ได้เข้าสู่ระบบ HR",15,BLUE);
        hrIdentity.setGravity(Gravity.CENTER);root.addView(hrIdentity);
        Button changeHr=new Button(this);changeHr.setText("เปลี่ยนผู้ใช้ HR");
        root.addView(changeHr);
        changeHr.setOnClickListener(v->{
            if(reading){showState("รออ่านบัตรให้เสร็จก่อนเปลี่ยนผู้ใช้",false);return;}
            loggedIn=false;paired=false;sessionId="";publicKey="";
            showState("โปรดลงชื่อเข้าใช้ใหม่",false);
            showLoginPopup();
        });
        TextView note=text("เพื่อความเป็นส่วนตัว ระบบไม่บันทึกรูปหรือข้อมูลบัตรในมือถือ\nเครื่องอ่านทำงานเมื่อมีคำขอจาก HR เท่านั้น",12,Color.GRAY);
        note.setGravity(Gravity.CENTER);root.addView(note);
        setContentView(scroll);
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
            if(removeDialog!=null){removeDialog.dismiss();removeDialog=null;}
            removeDialog=new AlertDialog.Builder(this)
               .setTitle("อ่านบัตรและส่งข้อมูลสำเร็จ")
               .setMessage("โปรดถอดบัตรประชาชนออก\n\nส่งข้อมูลถึงระบบแล้ว กรุณารอ HR ยืนยันว่าข้อมูลปรากฏบนหน้าเว็บ")
               .setPositiveButton("รับทราบ",(d,w)->{})
               .create();
            removeDialog.show();
        });
    }
    private void showState(String value,boolean online){
        runOnUiThread(()->{
            if(stopped)return;
            status.setText((online?"🟢 ":"🟠 ")+value);
            status.setTextColor(online?Color.rgb(12,133,85):BLUE);
        });
    }
    private byte[] fresh(int n){byte[] out=new byte[n];random.nextBytes(out);return out;}
    private String hex(byte[] v){StringBuilder s=new StringBuilder();for(byte b:v)s.append(String.format("%02x",b&255));return s.toString();}
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
            if(c.getResponseCode()!=200)throw new IllegalStateException("API HTTP "+c.getResponseCode());
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
    /** Password is used for this sign-in only; no password or JWT is persisted. */
    private void showLoginPopup(){
        LinearLayout panel=vertical(20);
        EditText org=new EditText(this);org.setSingleLine(true);
        org.setHint("รหัสองค์กร 6 หลัก");org.setInputType(InputType.TYPE_CLASS_NUMBER);
        org.setFilters(new InputFilter[]{new InputFilter.LengthFilter(6)});
        panel.addView(org);
        EditText hr=new EditText(this);hr.setSingleLine(true);
        hr.setHint("รหัส HR เช่น HR0001");
        hr.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        hr.setFilters(new InputFilter[]{new InputFilter.LengthFilter(6)});
        panel.addView(hr);
        EditText password=new EditText(this);password.setSingleLine(true);
        password.setHint("รหัสผ่าน HR");
        password.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        panel.addView(password);
        TextView error=text("ลงชื่อเข้าใช้ด้วยข้อมูลเดียวกับ HR Web",12,Color.GRAY);
        panel.addView(error);
        AlertDialog dialog=new AlertDialog.Builder(this)
            .setTitle("เข้าสู่ระบบ Android HR")
            .setView(panel).setCancelable(false)
            .setPositiveButton("เข้าสู่ระบบ",null)
            .setNegativeButton("ปิดแอป",(d,which)->finish()).create();
        dialog.setOnShowListener(v->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(w->{
            String orgCode=org.getText().toString().trim();
            String hrCode=hr.getText().toString().trim().toUpperCase(java.util.Locale.ROOT);
            String pass=password.getText().toString();
            if(!orgCode.matches("[0-9]{6}")||!hrCode.matches("[A-Z0-9]{6}")||pass.length()<12){
                error.setText("กรอกรหัสองค์กร รหัส HR และรหัสผ่านให้ถูกต้อง");return;
            }
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
            error.setText("กำลังตรวจสอบสิทธิ์องค์กรและแพ็กเกจ…");
            io.execute(()->{
                try{
                    JSONObject auth=api(apiBase,"/api/auth/login",new JSONObject()
                        .put("organization_code",orgCode).put("employee_code",hrCode)
                        .put("password",pass));
                    JSONObject context=auth.getJSONObject("context");
                    String role=context.optString("role","");
                    String organizationId=context.getString("organization_id");
                    if(!("owner".equals(role)||"hr_admin".equals(role))||
                        !organizationId.matches("[0-9a-fA-F-]{36}"))
                        throw new IllegalStateException("HR role denied");
                    String candidate=hex(fresh(16));
                    JSONObject enrollment=new JSONObject()
                        .put("organization_id",organizationId).put("device_secret",candidate);
                    if(!deviceSecret.isEmpty())enrollment.put("previous_device_secret",deviceSecret);
                    apiWithBearer(apiBase,"/api/reader/enroll",enrollment,
                        auth.getString("access_token"));
                    ReaderSecretStore.save(this,candidate);
                    deviceSecret=candidate;currentHrCode=hrCode;currentOrganization=orgCode;
                    loggedIn=true;paired=false;
                    runOnUiThread(()->{
                        password.setText("");dialog.dismiss();
                        hrIdentity.setText("องค์กร "+currentOrganization+" · HR "+currentHrCode);
                        cardHint.setText("โปรดเสียบบัตรประชาชน");
                        readingHint.setText("เชื่อมต่อเฉพาะคำขอของ HR "+currentHrCode+"\nรอ HR Web เปิด + เพิ่มผู้สมัครใหม่");
                    });
                    showState("เข้าสู่ระบบสำเร็จ · พร้อมเชื่อม HR Web",true);
                }catch(Exception e){
                    runOnUiThread(()->{
                        password.setText("");
                        error.setText("เข้าสู่ระบบไม่สำเร็จ หรือเครื่องถูกผูกต่างองค์กร / แพ็กเกจไม่พร้อม");
                        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
                    });
                    showState("ไม่สามารถยืนยันบัญชี HR หรือสิทธิ์เครื่อง",false);
                }
            });
        }));
        dialog.show();
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
                showState("อ่าน/ส่งไม่สำเร็จ · ตรวจเครื่องอ่านและการเชื่อมต่อ ("+
                    e.getClass().getSimpleName()+")",false);
                cardPrompted=false;retry();
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

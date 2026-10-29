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
 * Experimental HR-initiated one-time enrollment. No Android login.
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
    private EditText codeInput;
    private LinearLayout pairingPanel;
    private Button pairButton,diagnosticButton;
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
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        usb=(UsbManager)getSystemService(Context.USB_SERVICE);
        IntentFilter filter=new IntentFilter(USB_ACTION);
        if(Build.VERSION.SDK_INT>=33)registerReceiver(receiver,filter,Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver,filter);
        createUi();
        String existing=ReaderSecretStore.load(this);
        if(existing!=null){
            deviceSecret=existing;
            showState("กำลังเชื่อมต่อกับ HR Web…",false);
        }else showState("ยังไม่ได้จับคู่อุปกรณ์ · ให้ HR เปิดคำขอครั้งแรก",false);
        handler.post(networkLoop);
    }
    private TextView text(String value,int size,int color){
        TextView t=new TextView(this);t.setText(value);t.setTextSize(size);
        t.setTextColor(color);t.setPadding(0,12,0,12);return t;
    }
    private static GradientDrawable surface(int color,int stroke,int radius){
        GradientDrawable d=new GradientDrawable();
        d.setColor(color);d.setCornerRadius(radius);
        if(stroke!=0)d.setStroke(2,stroke);
        return d;
    }
    private LinearLayout vertical(int padding){
        LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(padding,padding,padding,padding);return l;
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

        LinearLayout indicator=vertical(15);
        indicator.setBackground(surface(Color.WHITE,Color.rgb(217,231,244),22));
        LinearLayout.LayoutParams iParams=new LinearLayout.LayoutParams(-1,-2);
        iParams.setMargins(0,22,0,22);root.addView(indicator,iParams);
        status=text("",16,BLUE);status.setTypeface(null,1);status.setGravity(Gravity.CENTER);
        indicator.addView(status);
        connectionHint=text("เชื่อมต่อปลอดภัยกับองค์กร HR",12,Color.GRAY);
        connectionHint.setGravity(Gravity.CENTER);indicator.addView(connectionHint);

        FrameLayout illustration=new FrameLayout(this);
        illustration.setBackground(surface(Color.rgb(213,237,245),Color.rgb(137,192,213),28));
        LinearLayout.LayoutParams ill=new LinearLayout.LayoutParams(-1,220);
        ill.setMargins(0,8,0,15);root.addView(illustration,ill);
        TextView cardHeader=text("บัตรประจำตัวประชาชน\nThai National ID Card",19,BLUE);
        cardHeader.setTypeface(null,1);
        FrameLayout.LayoutParams head=new FrameLayout.LayoutParams(-1,-2,Gravity.TOP);
        head.setMargins(22,18,22,0);illustration.addView(cardHeader,head);
        TextView chip=text("▦",45,Color.rgb(182,144,48));
        chip.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams chipP=new FrameLayout.LayoutParams(73,72,Gravity.START|Gravity.CENTER_VERTICAL);
        chipP.setMargins(28,0,0,0);
        chip.setBackground(surface(Color.rgb(250,229,147),Color.rgb(206,179,95),12));
        illustration.addView(chip,chipP);
        TextView lines=text("━━━━━━━━━━━━━━\n━━━━━━━━━━━\n━━━━━━━",14,Color.rgb(86,143,159));
        FrameLayout.LayoutParams linesP=new FrameLayout.LayoutParams(-2,-2,Gravity.START|Gravity.BOTTOM);
        linesP.setMargins(25,0,0,12);illustration.addView(lines,linesP);
        TextView portrait=text("รูปภาพ\nผู้ถือบัตร",13,Color.rgb(95,133,151));
        portrait.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams photoP=new FrameLayout.LayoutParams(94,105,Gravity.END|Gravity.BOTTOM);
        photoP.setMargins(0,0,22,20);
        portrait.setBackground(surface(Color.rgb(246,252,254),Color.rgb(181,207,219),12));
        illustration.addView(portrait,photoP);

        cardHint=text("โปรดเสียบบัตรประชาชน",24,BLUE);cardHint.setTypeface(null,1);
        cardHint.setGravity(Gravity.CENTER);root.addView(cardHint);
        readingHint=text("เมื่อ HR กด + เพิ่มผู้สมัครใหม่ ระบบจะอ่านบัตรอัตโนมัติ\nข้อมูลถูกเข้ารหัสและรอให้ HR ตรวจสอบก่อนบันทึก",13,Color.rgb(112,135,153));
        readingHint.setGravity(Gravity.CENTER);root.addView(readingHint);

        pairingPanel=vertical(15);
        pairingPanel.setBackground(surface(Color.WHITE,Color.rgb(216,231,243),20));
        LinearLayout.LayoutParams pairP=new LinearLayout.LayoutParams(-1,-2);
        pairP.setMargins(0,25,0,0);root.addView(pairingPanel,pairP);
        TextView once=text("จับคู่กับ HR Web ครั้งแรกเท่านั้น",17,BLUE);once.setTypeface(null,1);
        pairingPanel.addView(once);
        pairingPanel.addView(text("ให้ Owner/HR Admin เปิด + เพิ่มผู้สมัครใหม่ แล้วกดเชื่อมต่อ Android HR จากนั้นกรอกรหัสที่เว็บแสดง",13,Color.DKGRAY));
        codeInput=new EditText(this);codeInput.setSingleLine(true);
        codeInput.setHint("รหัสจับคู่ชั่วคราว 32 ตัวอักษร");
        codeInput.setTextSize(15);pairingPanel.addView(codeInput,new LinearLayout.LayoutParams(-1,-2));
        pairButton=new Button(this);pairButton.setText("จับคู่อุปกรณ์ครั้งแรก");
        pairingPanel.addView(pairButton);pairButton.setOnClickListener(v->connect());

        diagnosticButton=new Button(this);diagnosticButton.setText("เครื่องมือทดสอบ USB / CCID");
        LinearLayout.LayoutParams tools=new LinearLayout.LayoutParams(-1,-2);tools.setMargins(0,18,0,0);
        root.addView(diagnosticButton,tools);
        diagnosticButton.setOnClickListener(v->startActivity(new Intent(this,MainActivity.class)));
        TextView note=text("เพื่อความเป็นส่วนตัว ระบบไม่บันทึกรูปหรือข้อมูลบัตรในมือถือ\nเครื่องอ่านทำงานเมื่อมีคำขอจาก HR เท่านั้น",12,Color.GRAY);
        note.setGravity(Gravity.CENTER);root.addView(note);
        setContentView(scroll);
        pairingPanel.setVisibility(deviceSecret.isEmpty()?View.VISIBLE:View.GONE);
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
               .setMessage("โปรดถอดบัตรประชาชนออก\n\nข้อมูลแสดงอยู่ใน HR Web แล้ว กรุณาให้ HR ตรวจสอบและกดบันทึกใบสมัคร")
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
        if(!base.startsWith("https://")||base.contains("@")||base.contains("#"))
            throw new IllegalArgumentException("ต้องใช้ HTTPS API ที่กำหนดเท่านั้น");
        HttpURLConnection c=(HttpURLConnection)new URL(base+path).openConnection();
        c.setConnectTimeout(8000);c.setReadTimeout(8000);c.setRequestMethod("POST");
        c.setInstanceFollowRedirects(false);c.setDoOutput(true);
        c.setRequestProperty("Content-Type","application/json; charset=utf-8");
        c.setRequestProperty("Cache-Control","no-store");
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
        if(deviceSecret.isEmpty()||networkBusy||stopped||reading)return;
        networkBusy=true;
        io.execute(()->{
            try{
                if(!waitingSaveSession.isEmpty()){
                    JSONObject state=api(apiBase,"/api/reader/status",new JSONObject()
                      .put("device_secret",deviceSecret).put("session_id",waitingSaveSession));
                    String value=state.optString("status","");
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
    private void connect(){
        if(paired||reading)return;
        final String code=codeInput.getText().toString().trim().toLowerCase();
        if(!code.matches("[a-f0-9]{32}")){
            showState("กรอกรหัสจับคู่ 32 ตัวจาก HR Web",false);return;
        }
        pairButton.setEnabled(false);showState("กำลังจับคู่กับ HR Web…",false);
        io.execute(()->{
            String generated=hex(fresh(16));
            try{
                JSONObject result=api(apiBase,"/api/reader/claim",new JSONObject()
                    .put("pairing_code",code).put("device_secret",generated));
                ReaderSecretStore.save(this,generated);
                deviceSecret=generated;
                sessionId=result.getString("session_id");
                publicKey=result.getString("public_key_spki");
                paired=true;cardPrompted=false;
                runOnUiThread(()->{
                    codeInput.setText("");
                    pairingPanel.setVisibility(View.GONE);
                    cardHint.setText("โปรดเสียบบัตรประชาชน");
                    readingHint.setText("เชื่อมต่อแล้ว รอชิปและคำขอ HR");
                });
                showState("เชื่อมต่อแล้ว · ออนไลน์",true);
                startPolling();
            }catch(Exception e){
                runOnUiThread(()->pairButton.setEnabled(true));
                showState("จับคู่ไม่สำเร็จ กรุณาให้ HR ออกรหัสใหม่",false);
            }
        });
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
                    runOnUiThread(()->new AlertDialog.Builder(this)
                        .setTitle("ตรวจพบชิปบัตรประชาชน")
                        .setMessage("ยืนยันว่าผู้สมัครยินยอมให้ใช้ข้อมูลบนบัตรเพื่อกรอกใบสมัครและส่งแบบเข้ารหัสไปยัง HR Web ขององค์กร?")
                        .setNegativeButton("ยังไม่อ่าน",(dlg,w)->{cardPrompted=false;retry();})
                        .setPositiveButton("ยืนยันและอ่านชิป",(dlg,w)->readAndTransfer(d))
                        .show());
                }else retry();
            }catch(Exception e){showState("เครื่องอ่านยังไม่พร้อม · โปรดตรวจ OTG",true);retry();}
        });
    }
    private void retry(){if(!stopped&&paired)handler.postDelayed(this::startPolling,1400);}
    private void readAndTransfer(UsbDevice device){
        if(!paired||reading)return;
        reading=true;showState("กำลังตรวจสอบและอ่านชิป...",true);
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
                showState("ส่งข้อมูลเข้ารหัสสำเร็จ · รอ HR ตรวจทาน",true);
                paired=false;deviceSecret="";publicKey="";sessionId="";
                runOnUiThread(()->cardHint.setText("ส่งข้อมูลแล้ว · ถอดบัตรและตรวจบน HR Web"));
            }catch(Exception e){
                showState("อ่าน/ส่งไม่สำเร็จ · ตรวจเครื่องอ่านและการเชื่อมต่อ ("+
                    e.getClass().getSimpleName()+")",false);
                cardPrompted=false;retry();
            }finally{
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
        j.put("full_name",get(m,"ชื่อ-นามสกุล ภาษาไทย"));
        j.put("english_name",get(m,"ชื่อ-นามสกุล ภาษาอังกฤษ"));
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
        paired=false;reading=false;cardPrompted=false;sessionId="";deviceSecret="";publicKey="";
        pairButton.setEnabled(true);showState("ยกเลิกแล้ว · รอเริ่มเชื่อมต่อใหม่",false);
    }
    @Override protected void onDestroy(){
        stopped=true;paired=false;handler.removeCallbacksAndMessages(null);
        try{unregisterReceiver(receiver);}catch(Exception ignored){}
        io.shutdownNow();super.onDestroy();
    }
}

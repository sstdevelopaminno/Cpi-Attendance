package com.cpiattendance.readerprobe;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
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
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final SecureRandom random=new SecureRandom();
    private UsbManager usb;
    private TextView status,cardHint;
    private EditText apiInput,codeInput;
    private Button pairButton,closeButton;
    private volatile boolean paired=false,reading=false,stopped=false,cardPrompted=false;
    private String apiBase="",deviceSecret="",sessionId="",publicKey="";
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
        showState("ออฟไลน์ · รอรหัสเชื่อมต่อจาก HR Web",false);
    }
    private TextView text(String value,int size,int color){
        TextView t=new TextView(this);t.setText(value);t.setTextSize(size);
        t.setTextColor(color);t.setPadding(0,12,0,12);return t;
    }
    private void createUi(){
        ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(Color.rgb(245,249,254));
        LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(24,40,24,40);scroll.addView(box);
        box.addView(text("Cpi Attendance · Android HR",25,BLUE));
        box.addView(text("เครื่องอ่านบัตร Zoweetek · HR Reader v0.5",14,Color.DKGRAY));
        status=text("",18,BLUE);box.addView(status);
        TextView illustration=text("┌───────────────────────────┐\n│   บัตรประจำตัวประชาชนไทย    │\n│    ◇    Thai ID Card       │\n│    ▤    ▧                 │\n└───────────────────────────┘",20,BLUE);
        illustration.setBackgroundColor(Color.rgb(221,238,249));illustration.setPadding(18,22,18,22);
        box.addView(illustration);
        cardHint=text("โปรดเสียบบัตรประชาชน\nพร้อมใช้หลังจากฝั่ง HR เปิดคำขออ่านบัตร",18,BLUE);
        box.addView(cardHint);
        box.addView(text("Attendance API HTTPS URL",13,Color.GRAY));
        apiInput=new EditText(this);apiInput.setSingleLine(true);apiInput.setHint("https://attendance-api.example.com");
        box.addView(apiInput);
        box.addView(text("รหัสเชื่อมต่อชั่วคราวจากหน้า + เพิ่มผู้สมัครใหม่",13,Color.GRAY));
        codeInput=new EditText(this);codeInput.setSingleLine(true);codeInput.setHint("รหัส 32 ตัวอักษรจาก HR Web");
        box.addView(codeInput);
        pairButton=new Button(this);pairButton.setText("เชื่อมต่อ HR Web");box.addView(pairButton);
        pairButton.setOnClickListener(v->connect());
        closeButton=new Button(this);closeButton.setText("ยกเลิกการเชื่อมต่อ");box.addView(closeButton);
        closeButton.setOnClickListener(v->resetSession());
        box.addView(text("ข้อมูลบัตรและรูปถูกเข้ารหัสก่อนส่ง โดยไม่บันทึกลงมือถือและไม่ใช้บัญชีล็อกอิน Android การเปิดคำขอทำโดย HR ขององค์กรเท่านั้น",12,Color.GRAY));
        setContentView(scroll);
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
    private void connect(){
        if(paired||reading)return;
        final String origin=apiInput.getText().toString().trim().replaceAll("/+$","");
        final String code=codeInput.getText().toString().trim().toLowerCase();
        if(!origin.startsWith("https://")||!code.matches("[a-f0-9]{32}")){
            showState("URL หรือรหัสเชื่อมต่อไม่ถูกต้อง",false);return;
        }
        pairButton.setEnabled(false);showState("กำลังเชื่อมต่อกับ HR Web...",false);
        io.execute(()->{
            try{
                apiBase=origin;deviceSecret=hex(fresh(16));
                JSONObject body=new JSONObject().put("pairing_code",code).put("device_secret",deviceSecret);
                JSONObject data=api(apiBase,"/api/reader/claim",body);
                sessionId=data.getString("session_id");publicKey=data.getString("public_key_spki");
                paired=true;
                runOnUiThread(()->codeInput.setText(""));
                showState("เชื่อมต่อแล้ว · ออนไลน์",true);
                runOnUiThread(()->cardHint.setText("โปรดเสียบบัตรประชาชน\nระบบพร้อมอ่านเมื่อพบชิป"));
                startPolling();
            }catch(Exception e){
                runOnUiThread(()->pairButton.setEnabled(true));
                showState("เชื่อมต่อไม่สำเร็จ กรุณาตรวจรหัสและ API ("+e.getClass().getSimpleName()+")",false);
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

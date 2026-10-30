package com.cpiattendance.readerprobe;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.Locale;

/** Tenant HR sign-in presentation only. Credentials are never saved here. */
final class HrLoginDialog {
    interface Completion {
        void success();
        void failure(String userFacingMessage);
    }
    interface Submit {
        void authenticate(String orgCode,String hrCode,String password,Completion completion);
    }

    private static final int NAVY=Color.rgb(13,60,113);
    private static final int SLATE=Color.rgb(86,105,133);
    private final Activity activity;
    HrLoginDialog(Activity host){activity=host;}
    private int dp(int n){return Math.round(n*activity.getResources().getDisplayMetrics().density);}
    private GradientDrawable rounded(int fill,int stroke,int radius){
        GradientDrawable g=new GradientDrawable();
        g.setColor(fill);g.setCornerRadius(dp(radius));
        if(stroke!=0)g.setStroke(dp(1),stroke);
        return g;
    }
    private TextView text(String value,int size,int color,boolean bold){
        TextView label=new TextView(activity);
        label.setText(value);label.setTextSize(size);label.setTextColor(color);
        if(bold)label.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        return label;
    }
    private EditText field(LinearLayout parent,String title,String hint,int type){
        TextView label=text(title,13,NAVY,true);
        LinearLayout.LayoutParams titleParams=new LinearLayout.LayoutParams(-1,-2);
        titleParams.setMargins(0,dp(15),0,dp(7));
        parent.addView(label,titleParams);
        EditText input=new EditText(activity);
        input.setSingleLine(true);input.setTextSize(15);input.setInputType(type);
        input.setTextColor(NAVY);
        input.setHintTextColor(Color.rgb(149,162,182));input.setHint(hint);
        input.setMinHeight(dp(52));
        input.setPadding(dp(15),0,dp(14),0);
        input.setBackground(rounded(Color.WHITE,Color.rgb(203,219,237),14));
        parent.addView(input,new LinearLayout.LayoutParams(-1,dp(52)));
        return input;
    }
    private Button button(String name,boolean primary){
        Button view=new Button(activity);
        view.setText(name);view.setTextSize(14);view.setAllCaps(false);
        view.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        view.setTextColor(primary?Color.WHITE:NAVY);
        view.setMinHeight(dp(54));view.setStateListAnimator(null);
        if(primary){
            GradientDrawable blue=new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{Color.rgb(26,159,253),Color.rgb(11,77,235)});
            blue.setCornerRadius(dp(15));view.setBackground(blue);
        }else view.setBackground(rounded(Color.rgb(238,245,254),Color.rgb(204,218,235),15));
        return view;
    }
    void show(Submit submit){
        LinearLayout body=new LinearLayout(activity);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(23),dp(17),dp(23),dp(24));
        GradientDrawable card=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{Color.WHITE,Color.rgb(244,249,255)});
        card.setCornerRadius(dp(27));
        card.setStroke(dp(1),Color.rgb(224,235,248));
        body.setBackground(card);
        ImageView logo=new ImageView(activity);
        logo.setImageResource(R.drawable.cpi_brand_mark);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams mark=new LinearLayout.LayoutParams(dp(94),dp(84));
        mark.gravity=Gravity.CENTER_HORIZONTAL;
        body.addView(logo,mark);
        TextView heading=text("เข้าสู่ระบบ Android HR",23,NAVY,true);
        heading.setGravity(Gravity.CENTER);
        body.addView(heading,new LinearLayout.LayoutParams(-1,-2));
        TextView subtitle=text("บัญชี HR เดียวกับเว็บ · ผูกเครื่องอัตโนมัติ\nไม่ต้องกรอกรหัสจับคู่",12,SLATE,false);
        subtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subtitleParams=new LinearLayout.LayoutParams(-1,-2);
        subtitleParams.setMargins(0,dp(8),0,dp(11));body.addView(subtitle,subtitleParams);
        EditText org=field(body,"รหัสองค์กร 6 หลัก","กรอกรหัสองค์กร 6 หลัก",InputType.TYPE_CLASS_NUMBER);
        org.setFilters(new InputFilter[]{new InputFilter.LengthFilter(6)});
        EditText hr=field(body,"รหัส HR","เช่น HR0001",
            InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        hr.setFilters(new InputFilter[]{new InputFilter.LengthFilter(6)});
        TextView passwordLabel=text("รหัสผ่าน HR",13,NAVY,true);
        LinearLayout.LayoutParams passLabelParams=new LinearLayout.LayoutParams(-1,-2);
        passLabelParams.setMargins(0,dp(15),0,dp(7));
        body.addView(passwordLabel,passLabelParams);
        FrameLayout passFrame=new FrameLayout(activity);
        passFrame.setBackground(rounded(Color.WHITE,Color.rgb(203,219,237),14));
        EditText password=new EditText(activity);
        password.setTextSize(15);password.setTextColor(NAVY);password.setSingleLine(true);
        password.setHint("กรอกรหัสผ่าน HR");
        password.setHintTextColor(Color.rgb(149,162,182));
        password.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        password.setPadding(dp(15),0,dp(74),0);
        password.setBackgroundColor(Color.TRANSPARENT);
        passFrame.addView(password,new FrameLayout.LayoutParams(-1,-1));
        TextView reveal=text("แสดง",13,Color.rgb(13,108,209),true);
        reveal.setGravity(Gravity.CENTER);
        passFrame.addView(reveal,new FrameLayout.LayoutParams(dp(66),-1,Gravity.RIGHT));
        reveal.setOnClickListener(v->{
            boolean hidden=password.getInputType()!=
                (InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
            password.setInputType(InputType.TYPE_CLASS_TEXT|(hidden?
                InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD:InputType.TYPE_TEXT_VARIATION_PASSWORD));
            reveal.setText(hidden?"ซ่อน":"แสดง");
            password.setSelection(password.length());
        });
        body.addView(passFrame,new LinearLayout.LayoutParams(-1,dp(52)));
        TextView error=text("",13,Color.rgb(177,39,70),true);
        error.setLineSpacing(dp(4),1f);
        error.setPadding(dp(13),dp(12),dp(13),dp(12));
        error.setBackground(rounded(Color.rgb(255,239,242),Color.rgb(255,214,220),12));
        error.setVisibility(View.GONE);
        LinearLayout.LayoutParams errParams=new LinearLayout.LayoutParams(-1,-2);
        errParams.setMargins(0,dp(12),0,0);
        body.addView(error,errParams);
        LinearLayout actions=new LinearLayout(activity);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams actionsParams=new LinearLayout.LayoutParams(-1,dp(54));
        actionsParams.setMargins(0,dp(23),0,0);
        body.addView(actions,actionsParams);
        Button close=button("ปิดแอป",false),enter=button("เข้าสู่ระบบ",true);
        LinearLayout.LayoutParams first=new LinearLayout.LayoutParams(0,-1,1);
        first.setMargins(0,0,dp(7),0);actions.addView(close,first);
        LinearLayout.LayoutParams second=new LinearLayout.LayoutParams(0,-1,1);
        second.setMargins(dp(7),0,0,0);actions.addView(enter,second);
        ScrollView scroll=new ScrollView(activity);
        scroll.setFillViewport(false);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(body);
        AlertDialog dialog=new AlertDialog.Builder(activity).setView(scroll).create();
        dialog.setCancelable(false);dialog.setCanceledOnTouchOutside(false);
        close.setOnClickListener(v->{
            password.setText("");dialog.dismiss();activity.finish();
        });
        enter.setOnClickListener(v->{
            String organization=org.getText().toString().trim();
            String user=hr.getText().toString().trim().toUpperCase(Locale.ROOT);
            String pass=password.getText().toString();
            if(!organization.matches("[0-9]{6}")||!user.matches("[A-Z0-9]{6}")||pass.length()<12){
                error.setText("!  กรุณาตรวจรหัสองค์กรและรหัส HR ให้ครบ 6 ตัว พร้อมรหัสผ่านอย่างน้อย 12 ตัว");
                error.setTextColor(Color.rgb(177,39,70));
                error.setVisibility(View.VISIBLE);return;
            }
            enter.setEnabled(false);enter.setAlpha(.55f);close.setEnabled(false);
            enter.setText("กำลังเชื่อมต่อ...");
            error.setBackground(rounded(Color.rgb(239,246,255),Color.rgb(210,228,255),12));
            error.setText("กำลังยืนยันบัญชี HR และสิทธิ์เครื่องกับองค์กร...");
            error.setTextColor(SLATE);error.setVisibility(View.VISIBLE);
            submit.authenticate(organization,user,pass,new Completion(){
                @Override public void success(){
                    activity.runOnUiThread(()->{
                        password.setText("");dialog.dismiss();
                    });
                }
                @Override public void failure(String message){
                    activity.runOnUiThread(()->{
                        password.setText("");error.setText("!  "+message);
                        error.setTextColor(Color.rgb(177,39,70));
                        error.setBackground(rounded(Color.rgb(255,239,242),Color.rgb(255,214,220),12));
                        error.setVisibility(View.VISIBLE);
                        enter.setText("เข้าสู่ระบบ");
                        enter.setEnabled(true);enter.setAlpha(1f);close.setEnabled(true);
                    });
                }
            });
        });
        dialog.setOnShowListener(v->{
            Window window=dialog.getWindow();
            if(window!=null){
                window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
                window.setLayout(Math.min(activity.getResources().getDisplayMetrics().widthPixels-dp(26),
                    dp(440)),WindowManager.LayoutParams.WRAP_CONTENT);
                window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
            }
        });
        dialog.show();
    }
}

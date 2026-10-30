package com.cpiattendance.readerprobe;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** One accessible, reusable dialog style for Android HR notices and confirmations.
 *  UI only; never carries a password, card image, or device capability.
 */
final class HrNoticeDialog {
    enum Kind { SUCCESS, WARNING, ERROR, CONFIRM }
    private HrNoticeDialog(){}
    private static int dp(Activity activity,int n){
        return Math.round(n*activity.getResources().getDisplayMetrics().density);
    }
    private static GradientDrawable shape(Activity activity,int fill,int radius){
        GradientDrawable shape=new GradientDrawable();
        shape.setColor(fill);shape.setCornerRadius(dp(activity,radius));return shape;
    }
    static void show(Activity activity,Kind kind,String heading,String details,
                     String confirm,String dismiss,Runnable onConfirm){
        if(activity.isFinishing()||activity.isDestroyed())return;
        final int navy=Color.rgb(13,60,113);
        final int accent=kind==Kind.ERROR?Color.rgb(185,48,69):
            kind==Kind.SUCCESS?Color.rgb(5,139,94):Color.rgb(225,129,30);
        LinearLayout card=new LinearLayout(activity);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        card.setPadding(dp(activity,23),dp(activity,25),dp(activity,23),dp(activity,22));
        card.setBackground(shape(activity,Color.WHITE,24));
        TextView emblem=new TextView(activity);
        emblem.setGravity(Gravity.CENTER);
        emblem.setText(kind==Kind.SUCCESS?"✓":kind==Kind.ERROR?"!":kind==Kind.CONFIRM?"?":"!");
        emblem.setTextSize(27);emblem.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        emblem.setTextColor(accent);
        emblem.setBackground(shape(activity,
            kind==Kind.ERROR?Color.rgb(255,236,238):
            kind==Kind.SUCCESS?Color.rgb(229,250,241):Color.rgb(255,244,226),20));
        card.addView(emblem,new LinearLayout.LayoutParams(dp(activity,64),dp(activity,64)));
        TextView title=new TextView(activity);
        title.setText(heading);title.setTextColor(navy);title.setTextSize(20);
        title.setTypeface(Typeface.DEFAULT,Typeface.BOLD);title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams top=new LinearLayout.LayoutParams(-1,-2);
        top.topMargin=dp(activity,17);card.addView(title,top);
        TextView message=new TextView(activity);
        message.setText(details);message.setTextColor(Color.rgb(84,105,130));
        message.setTextSize(14);message.setGravity(Gravity.CENTER);
        message.setLineSpacing(dp(activity,3),1f);
        LinearLayout.LayoutParams space=new LinearLayout.LayoutParams(-1,-2);
        space.topMargin=dp(activity,11);card.addView(message,space);
        LinearLayout actions=new LinearLayout(activity);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams actionsLayout=new LinearLayout.LayoutParams(-1,dp(activity,51));
        actionsLayout.topMargin=dp(activity,23);card.addView(actions,actionsLayout);
        final AlertDialog dialog=new AlertDialog.Builder(activity).setView(card).create();
        dialog.setCancelable(kind!=Kind.CONFIRM);
        if(dismiss!=null&&!dismiss.isEmpty()){
            Button cancel=makeButton(activity,dismiss,false);
            LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-1,1f);
            p.rightMargin=dp(activity,6);actions.addView(cancel,p);
            cancel.setOnClickListener(v->dialog.dismiss());
        }
        Button accept=makeButton(activity,confirm,true);
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-1,1f);
        p.leftMargin=dp(activity,dismiss==null||dismiss.isEmpty()?0:6);
        actions.addView(accept,p);
        accept.setOnClickListener(v->{dialog.dismiss();if(onConfirm!=null)onConfirm.run();});
        dialog.setOnShowListener(v->{
            Window window=dialog.getWindow();
            if(window!=null){
                window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
                window.setLayout(Math.min(activity.getResources().getDisplayMetrics().widthPixels-dp(activity,28),
                    dp(activity,430)),WindowManager.LayoutParams.WRAP_CONTENT);
            }
        });
        dialog.show();
    }
    private static Button makeButton(Activity activity,String label,boolean primary){
        Button b=new Button(activity);b.setText(label);b.setAllCaps(false);
        b.setTextSize(13);b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        b.setTextColor(primary?Color.WHITE:Color.rgb(13,60,113));
        b.setBackground(shape(activity,primary?Color.rgb(19,103,227):Color.rgb(237,245,255),14));
        b.setStateListAnimator(null);return b;
    }
}

package com.cpiattendance.readerprobe;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Persistent tenant device secret encrypted using hardware-backed AndroidKeyStore where available.
 *  No raw card data is stored. A damaged/invalidated key fails closed and needs new HR pairing.
 */
final class ReaderSecretStore {
    private static final String ALIAS="cpi_attendance_hr_device_v06";
    private static final String PREFS="reader_security_v06";
    private ReaderSecretStore(){}
    private static SecretKey secret() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if(store.containsAlias(ALIAS))return ((KeyStore.SecretKeyEntry)store.getEntry(ALIAS,null)).getSecretKey();
        KeyGenerator key=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        key.init(new KeyGenParameterSpec.Builder(ALIAS,
            KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build());
        return key.generateKey();
    }
    /** Commit device capability and HR label atomically after server-attested
     * enrollment; neither the password nor the Supabase JWT is persisted.
     */
    static void saveSession(Context context,String token,String orgCode,String hrCode) throws Exception{
        if(token==null||!token.matches("[0-9a-f]{32}")||
           orgCode==null||!orgCode.matches("[0-9]{6}")||
           hrCode==null||!hrCode.matches("[A-Z0-9]{6}"))
            throw new IllegalArgumentException("bad HR device session");
        SecretKey key=secret();
        Cipher tokenCipher=Cipher.getInstance("AES/GCM/NoPadding");
        tokenCipher.init(Cipher.ENCRYPT_MODE,key);
        byte[] tokenData=tokenCipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        Cipher labelCipher=Cipher.getInstance("AES/GCM/NoPadding");
        labelCipher.init(Cipher.ENCRYPT_MODE,key);
        byte[] labelData=labelCipher.doFinal((orgCode+":"+hrCode).getBytes(StandardCharsets.UTF_8));
        SharedPreferences.Editor e=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit();
        e.putString("iv",Base64.encodeToString(tokenCipher.getIV(),Base64.NO_WRAP));
        e.putString("cipher",Base64.encodeToString(tokenData,Base64.NO_WRAP));
        e.putString("identity_iv",Base64.encodeToString(labelCipher.getIV(),Base64.NO_WRAP));
        e.putString("identity_cipher",Base64.encodeToString(labelData,Base64.NO_WRAP));
        e.putBoolean("auto_resume",true);
        if(!e.commit())throw new IllegalStateException("HR device session not saved");
    }
    static String[] loadIdentity(Context context){
        SharedPreferences p=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        if(!p.getBoolean("auto_resume",false))return null;
        String iv=p.getString("identity_iv",null),sealed=p.getString("identity_cipher",null);
        if(iv==null||sealed==null)return null;
        try{
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,secret(),
                new GCMParameterSpec(128,Base64.decode(iv,Base64.DEFAULT)));
            String identity=new String(cipher.doFinal(Base64.decode(sealed,Base64.DEFAULT)),
                StandardCharsets.UTF_8);
            if(!identity.matches("[0-9]{6}:[A-Z0-9]{6}"))return null;
            return identity.split(":",2);
        }catch(Exception invalid){
            // Never return unverified labels after Keystore invalidation.
            return null;
        }
    }
    static void suspendAutoResume(Context context){
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE)
            .edit().putBoolean("auto_resume",false).commit();
    }
    static String load(Context context){
        SharedPreferences p=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        String iv=p.getString("iv",null),enc=p.getString("cipher",null);
        if(iv==null||enc==null)return null;
        try{
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,secret(),new GCMParameterSpec(128,
                 Base64.decode(iv,Base64.DEFAULT)));
            String token=new String(cipher.doFinal(Base64.decode(enc,Base64.DEFAULT)),
                StandardCharsets.UTF_8);
            return token.matches("[0-9a-f]{32}")?token:null;
        }catch(Exception invalid){
            // Explicitly drop invalid credentials; the subscriber HR may pair again.
            clear(context);return null;
        }
    }
    static void clear(Context context){
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().clear().apply();
    }
}

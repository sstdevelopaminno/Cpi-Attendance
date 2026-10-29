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
    static void save(Context context,String token) throws Exception{
        if(token==null||!token.matches("[0-9a-f]{32}"))throw new IllegalArgumentException("bad secret");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,secret());
        byte[] output=cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        SharedPreferences.Editor e=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit();
        e.putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP));
        e.putString("cipher",Base64.encodeToString(output,Base64.NO_WRAP));
        if(!e.commit())throw new IllegalStateException("Reader pairing not saved");
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

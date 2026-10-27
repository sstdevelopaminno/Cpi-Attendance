import {createHmac} from "node:crypto";
/**
 * This module does NOT read Thai national ID smartcards or authenticate a person.
 * Kiosk hardware reads only via supported trusted PC/SC/Android bridge.
 * Card data is processed transiently and must not appear in logs or browser state.
 */
export function cardFingerprint({identityNumber,tenantSecret}){
  if(typeof identityNumber!=="string"||!/^\d{13}$/.test(identityNumber))
    throw new TypeError("invalid_identity_reference");
  if(typeof tenantSecret!=="string"||tenantSecret.length<32)
    throw new TypeError("invalid_tenant_secret");
  return createHmac("sha256",tenantSecret).update("card:v1:"+identityNumber).digest("hex");
}
export function validateKioskAssertion(value){
  return Boolean(value && /^[0-9a-f-]{36}$/i.test(value.deviceId)
    && /^[0-9a-f]{64}$/.test(value.cardFingerprint)
    && Number.isSafeInteger(value.observedAt)
    && typeof value.signature==="string"&&value.signature.length>=40);
}
// Validation of device signature, certificate, challenge and site is performed
// server-side; a card fingerprint alone does NOT prove the person is present.

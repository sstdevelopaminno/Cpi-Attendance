/** IT-issued verified entitlement / service-credential scope contract.
 * Pure authorization helper: NEVER accept grant objects supplied by browser,
 * Android kiosk or external clients. Server must authenticate and load grant.
 */
export const EXTERNAL_SCOPES=Object.freeze([
  "attendance:read","attendance:write","employees:read","shifts:read",
  "leave:read","payroll:read","webhooks:manage"
]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function authorizeExternalGrant({trustedGrant,requestedOrganizationId,scope,nowMs=Date.now()}={}){
  if(!trustedGrant||typeof trustedGrant!=="object"||!uuid.test(String(requestedOrganizationId??"")))
    return {allowed:false,reason:"missing_grant_or_organization"};
  if(trustedGrant.organizationId!==requestedOrganizationId)
    return {allowed:false,reason:"organization_scope_denied"};
  if(trustedGrant.revoked===true||trustedGrant.status!=="active")
    return {allowed:false,reason:"integration_inactive"};
  if(!Number.isFinite(trustedGrant.expiresAtMs)||trustedGrant.expiresAtMs<=nowMs)
    return {allowed:false,reason:"integration_expired"};
  if(!Array.isArray(trustedGrant.features)||!trustedGrant.features.includes("ATT_EXTERNAL_API"))
    return {allowed:false,reason:"integration_unlicensed"};
  if(!EXTERNAL_SCOPES.includes(scope)||!Array.isArray(trustedGrant.scopes)||!trustedGrant.scopes.includes(scope))
    return {allowed:false,reason:"scope_denied"};
  return {allowed:true,organizationId:requestedOrganizationId,scope};
}

/** Explicit field allow-list for outbound attendance event webhooks.
 * Never include Thai citizen identifiers, card photo, raw APDU or chip data.
 */
export function publicAttendanceEvent(event){
  if(!event||!uuid.test(String(event.organizationId??""))||
     !uuid.test(String(event.eventId??""))||
     !uuid.test(String(event.employeeId??""))||
     !["check_in","check_out"].includes(event.eventType)||
     !Number.isFinite(Date.parse(event.occurredAt))||
     !["qr","smart_card","kiosk","api","manual"].includes(event.method))
    throw new TypeError("invalid_external_attendance_event");
  return Object.freeze({
    event_id:event.eventId,employee_id:event.employeeId,
    event_type:event.eventType,occurred_at:new Date(event.occurredAt).toISOString(),
    method:event.method,organization_id:event.organizationId
  });
}

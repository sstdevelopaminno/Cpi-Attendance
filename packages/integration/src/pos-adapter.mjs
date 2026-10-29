/** POS add-on bridge contract. Input grants and mappings must come from
 * authenticated IT/backend records, NEVER from mobile/POS request bodies.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function resolvePosStaffAccess({license,mapping,requestedPosTenantId,
  attendanceOrganizationId,sourceEmployeeCode,nowMs=Date.now()}={}){
  if(!license||!mapping||!uuid.test(String(attendanceOrganizationId??"")))
    return {allowed:false,reason:"missing_contract"};
  if(license.status!=="active"||license.revoked===true||
    !Number.isFinite(license.expiresAtMs)||license.expiresAtMs<=nowMs||
    !Array.isArray(license.features)||!license.features.includes("ATT_POS_ADDON"))
    return {allowed:false,reason:"pos_addon_unlicensed"};
  if(mapping.posTenantId!==requestedPosTenantId||
     mapping.attendanceOrganizationId!==attendanceOrganizationId||
     mapping.sourceEmployeeCode!==sourceEmployeeCode||
     license.attendanceOrganizationId!==attendanceOrganizationId||
     !uuid.test(String(mapping.attendanceEmployeeId??"")))
    return {allowed:false,reason:"mapping_out_of_scope"};
  return {allowed:true,organizationId:attendanceOrganizationId,
    employeeId:mapping.attendanceEmployeeId};
}

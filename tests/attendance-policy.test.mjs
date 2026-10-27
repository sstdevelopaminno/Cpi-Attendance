import assert from "node:assert/strict";
import test from "node:test";
import { localWorkDate, distanceMeters, assessGeofence, validateAttendanceIntent } from "../packages/core/src/attendance-policy.mjs";

test("Bangkok date does not use UTC day", () => {
  assert.equal(localWorkDate("2026-10-27T18:00:00Z"), "2026-10-28");
  assert.equal(localWorkDate("2026-10-27T02:00:00Z"), "2026-10-27");
});
test("local time zone can differ by organization", () => {
  assert.equal(localWorkDate("2026-10-27T18:00:00Z", "UTC"), "2026-10-27");
});
test("invalid timestamp and coordinate fail", () => {
  assert.throws(() => localWorkDate("bad"));
  assert.throws(() => distanceMeters({lat:999,lon:1},{lat:1,lon:1}));
});
test("same point has zero distance", () => {
  assert.equal(distanceMeters({lat:13.75,lon:100.5},{lat:13.75,lon:100.5}),0);
});
test("inside sufficiently accurate GPS qualifies as evidence", () => {
  assert.equal(assessGeofence({site:{lat:13.75,lon:100.5,radiusMeters:150},position:{lat:13.75,lon:100.5,accuracyMeters:20}}).status, "inside");
});
test("low accuracy requires review", () => {
  assert.equal(assessGeofence({site:{lat:13.75,lon:100.5,radiusMeters:150},position:{lat:13.75,lon:100.5,accuracyMeters:130}}).reason,"low_accuracy");
});
test("boundary uncertainty requires review", () => {
  assert.equal(assessGeofence({site:{lat:13.75,lon:100.5,radiusMeters:150},position:{lat:13.75,lon:100.501,accuracyMeters:60}}).status,"review");
});
test("outside GPS cannot be auto approved", () => {
  assert.equal(assessGeofence({site:{lat:13.75,lon:100.5,radiusMeters:100},position:{lat:13.75,lon:100.51,accuracyMeters:20}}).status,"outside");
});
test("idempotency key and recognized method are required", () => {
  const payload={eventType:"check_in",method:"qr",idempotencyKey:"attempt-20261027-001"};
  assert.equal(validateAttendanceIntent(payload),true);
  assert.equal(validateAttendanceIntent({...payload,idempotencyKey:"short"}),false);
  assert.equal(validateAttendanceIntent({...payload,method:"face_scan"}),false);
});

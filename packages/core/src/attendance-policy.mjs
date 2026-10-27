/**
 * Pure policy helpers, NOT an authentication or server-side attendance endpoint.
 * Server must independently verify identity, QR nonce, site entitlement and freshness.
 */
export function localWorkDate(instant, timeZone = "Asia/Bangkok") {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new TypeError("invalid_instant");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const part = (kind) => parts.find((entry) => entry.type === kind)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validCoordinate(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
const radians = (deg) => deg * Math.PI / 180;

export function distanceMeters(from, to) {
  if (!from || !to || !validCoordinate(from.lat, from.lon)
    || !validCoordinate(to.lat, to.lon)) throw new TypeError("invalid_coordinates");
  const earthRadiusMeters = 6371008.8;
  const phi1 = radians(from.lat);
  const phi2 = radians(to.lat);
  const dPhi = radians(to.lat - from.lat);
  const dLambda = radians(to.lon - from.lon);
  const a = Math.sin(dPhi / 2) ** 2
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * 'review' is not approval. Browser-provided GPS is untrusted evidence and
 * must be combined with short-lived QR, bound device and server validations.
 */
export function assessGeofence({ site, position, maxAccuracyMeters = 100 }) {
  if (!site || !Number.isFinite(site.radiusMeters) || site.radiusMeters <= 0) {
    throw new TypeError("invalid_site");
  }
  if (!position || !Number.isFinite(position.accuracyMeters)
    || position.accuracyMeters < 0 || !Number.isFinite(maxAccuracyMeters)
    || maxAccuracyMeters <= 0) throw new TypeError("invalid_accuracy");
  const meters = distanceMeters(site, position);
  if (position.accuracyMeters > maxAccuracyMeters) {
    return { status: "review", reason: "low_accuracy", distanceMeters: Math.round(meters) };
  }
  if (meters > site.radiusMeters) {
    return { status: "outside", reason: "out_of_range", distanceMeters: Math.round(meters) };
  }
  // Near-boundary GPS uncertainty requires review instead of an automatic rejection.
  if (meters + position.accuracyMeters > site.radiusMeters) {
    return { status: "review", reason: "boundary_uncertain", distanceMeters: Math.round(meters) };
  }
  return { status: "inside", reason: "within_range", distanceMeters: Math.round(meters) };
}

export const ATTENDANCE_EVENT_TYPES = Object.freeze(["check_in", "check_out", "break_start", "break_end"]);
export const ATTENDANCE_METHODS = Object.freeze(["qr", "smart_card", "kiosk", "api", "manual"]);

export function validateAttendanceIntent(intent) {
  return Boolean(intent && ATTENDANCE_EVENT_TYPES.includes(intent.eventType)
    && ATTENDANCE_METHODS.includes(intent.method)
    && typeof intent.idempotencyKey === "string"
    && /^[a-zA-Z0-9._:-]{12,128}$/.test(intent.idempotencyKey));
}

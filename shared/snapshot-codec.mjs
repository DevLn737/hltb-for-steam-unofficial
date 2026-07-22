const LOCATION_SHIFT = 16;
const LOCATION_MASK = 0xffff;

function encodeUnsigned(value, output) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Invalid unsigned integer: ${value}`);
  }
  let remaining = value >>> 0;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining) byte |= 0x80;
    output.push(byte);
  } while (remaining);
}

function decodeUnsigned(bytes, offset) {
  let value = 0;
  let shift = 0;
  for (let index = offset; index < bytes.length && index < offset + 5; index += 1) {
    const byte = bytes[index];
    if (byte === undefined) break;
    value += (byte & 0x7f) * (2 ** shift);
    if ((byte & 0x80) === 0) return [value >>> 0, index + 1];
    shift += 7;
  }
  throw new Error('Invalid or truncated ULEB128 value');
}

export function packSnapshotLocation(bucket, rowIndex) {
  if (!Number.isInteger(bucket) || bucket < 0 || bucket >= 64) throw new Error(`Invalid snapshot bucket: ${bucket}`);
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex > LOCATION_MASK) throw new Error(`Invalid snapshot row: ${rowIndex}`);
  return (bucket << LOCATION_SHIFT) | rowIndex;
}

export function unpackSnapshotLocation(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0x3fffff) throw new Error(`Invalid snapshot location: ${value}`);
  return { bucket: value >>> LOCATION_SHIFT, rowIndex: value & LOCATION_MASK };
}

export function encodeSteamIndex(pairs) {
  const output = [];
  let previousAppId = 0;
  for (const [appId, location] of pairs) {
    if (!Number.isSafeInteger(appId) || appId <= previousAppId) throw new Error(`Steam App IDs must be strictly increasing: ${appId}`);
    encodeUnsigned(appId - previousAppId, output);
    encodeUnsigned(location, output);
    previousAppId = appId;
  }
  return Uint8Array.from(output);
}

export function decodeSteamIndex(bytes) {
  const pairs = [];
  let offset = 0;
  let previousAppId = 0;
  while (offset < bytes.length) {
    const [delta, afterDelta] = decodeUnsigned(bytes, offset);
    const [location, afterLocation] = decodeUnsigned(bytes, afterDelta);
    if (delta <= 0) throw new Error('Steam App ID delta must be positive');
    const appId = previousAppId + delta;
    if (!Number.isSafeInteger(appId) || appId > 0xffffffff) throw new Error('Steam App ID overflow');
    pairs.push([appId, location]);
    previousAppId = appId;
    offset = afterLocation;
  }
  return pairs;
}

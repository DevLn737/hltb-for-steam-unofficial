const LOCATION_SHIFT = 16;
const LOCATION_MASK = 0xffff;

const TITLE_MAGIC = Uint8Array.of(0x48, 0x54, 0x37, 0x54); // HT7T
const STEAM_MAGIC = Uint8Array.of(0x48, 0x54, 0x37, 0x53); // HT7S
const encoder = new TextEncoder();

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

function startsWithMagic(bytes, magic) {
  return bytes.length >= magic.length && magic.every((byte, index) => bytes[index] === byte);
}

function commonPrefixLength(left, right) {
  const maximum = Math.min(left.length, right.length);
  let index = 0;
  while (index < maximum && left[index] === right[index]) index += 1;
  return index;
}

function encodeHeader(magic, entries, output) {
  output.push(...magic);
  encodeUnsigned(entries, output);
}

function decodeHeader(bytes, magic) {
  if (!startsWithMagic(bytes, magic)) throw new Error('Invalid snapshot bucket magic');
  return decodeUnsigned(bytes, magic.length);
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
  encodeHeader(STEAM_MAGIC, pairs.length, output);
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
  const [entryCount, afterHeader] = decodeHeader(bytes, STEAM_MAGIC);
  let offset = afterHeader;
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
  if (pairs.length !== entryCount) throw new Error('Steam index entry count mismatch');
  return pairs;
}

export function encodeTitleBucket(rows) {
  const output = [];
  encodeHeader(TITLE_MAGIC, rows.length, output);
  let previousTitle = new Uint8Array();
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 9 || typeof row[0] !== 'string' || row[0].length === 0) {
      throw new Error('Invalid title bucket row');
    }
    const title = encoder.encode(row[0]);
    const prefix = commonPrefixLength(previousTitle, title);
    const suffix = title.subarray(prefix);
    encodeUnsigned(prefix, output);
    encodeUnsigned(suffix.length, output);
    output.push(...suffix);
    for (const value of row.slice(1, 5)) {
      const encoded = value === null ? 0 : value;
      if (!Number.isSafeInteger(encoded) || encoded < 0) throw new Error('Invalid title bucket integer');
      encodeUnsigned(encoded, output);
    }
    encodeUnsigned(row[5], output);
    for (const change of row.slice(6)) encodeUnsigned(encodeTimeChange(change), output);
    previousTitle = title;
  }
  return Uint8Array.from(output);
}

export function decodeTitleBucket(bytes) {
  const [entryCount, afterHeader] = decodeHeader(bytes, TITLE_MAGIC);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const rows = [];
  let offset = afterHeader;
  let previousTitle = new Uint8Array();
  for (let rowIndex = 0; rowIndex < entryCount; rowIndex += 1) {
    const [prefix, afterPrefix] = decodeUnsigned(bytes, offset);
    const [suffixLength, afterSuffixLength] = decodeUnsigned(bytes, afterPrefix);
    if (prefix > previousTitle.length || afterSuffixLength + suffixLength > bytes.length) {
      throw new Error('Invalid or truncated title prefix');
    }
    const titleBytes = new Uint8Array(prefix + suffixLength);
    titleBytes.set(previousTitle.subarray(0, prefix));
    titleBytes.set(bytes.subarray(afterSuffixLength, afterSuffixLength + suffixLength), prefix);
    offset = afterSuffixLength + suffixLength;
    let title;
    try {
      title = decoder.decode(titleBytes);
    } catch {
      throw new Error('Invalid UTF-8 in title bucket');
    }
    if (!title) throw new Error('Empty title in title bucket');
    const values = [];
    for (let index = 0; index < 4; index += 1) {
      const [value, nextOffset] = decodeUnsigned(bytes, offset);
      values.push(index === 0 ? value : value === 0 ? null : value);
      offset = nextOffset;
    }
    if (values[0] === 0) throw new Error('Invalid HLTB game ID');
    const [checkedDateIndex, afterCheckedDate] = decodeUnsigned(bytes, offset);
    offset = afterCheckedDate;
    const changes = [];
    for (let index = 0; index < 3; index += 1) {
      const [encoded, nextOffset] = decodeUnsigned(bytes, offset);
      changes.push(decodeTimeChange(encoded, values[index + 1]));
      offset = nextOffset;
    }
    rows.push([title, ...values, checkedDateIndex, ...changes]);
    previousTitle = titleBytes;
  }
  if (offset !== bytes.length) throw new Error('Unexpected trailing title bucket data');
  return rows;
}

export function encodeTimeChange(change) {
  if (change === null || change?.kind === 'unchanged') return 0;
  if (change?.kind === 'new') return 1;
  if (change?.kind === 'removed') {
    if (!Number.isSafeInteger(change.previous) || change.previous <= 0) throw new Error('Invalid removed time change');
    return change.previous * 2 + 2;
  }
  if (change?.kind === 'delta' && Number.isSafeInteger(change.minutes) && change.minutes !== 0) {
    const zigzag = change.minutes > 0 ? change.minutes * 2 : (-change.minutes * 2) - 1;
    return zigzag * 2 + 3;
  }
  throw new Error('Invalid snapshot time change');
}

export function decodeTimeChange(encoded, current) {
  if (encoded === 0) return null;
  if (encoded === 1) return current === null ? null : { kind: 'new' };
  if (encoded % 2 === 0) {
    const previous = (encoded - 2) / 2;
    return current === null && previous > 0 ? { kind: 'removed', previous } : null;
  }
  if (current === null) return null;
  const zigzag = (encoded - 3) / 2;
  const minutes = zigzag % 2 === 0 ? zigzag / 2 : -((zigzag + 1) / 2);
  return minutes === 0 ? null : { kind: 'delta', minutes };
}

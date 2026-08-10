const HEX = /^[a-f0-9]{64}$/;

function exactBuffer(value: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

export async function sha256Hex(value: Uint8Array | ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', exactBuffer(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function verifyPointerSignature(
  pointerBytes: Uint8Array,
  signatureBase64: string,
  publicKey: JsonWebKey,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      publicKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      exactBuffer(decodeBase64(signatureBase64.trim())),
      exactBuffer(pointerBytes),
    );
  } catch {
    return false;
  }
}

export function isSha256(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

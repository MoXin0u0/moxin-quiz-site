import { canonicalJson } from './canonical.js';

const encoder = new TextEncoder();

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError('Expected ArrayBuffer or typed-array data.');
}

function toHex(bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function getSubtleCrypto() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto SHA-256 is unavailable in this runtime.');
  return subtle;
}

export async function sha256Bytes(value) {
  const digest = await getSubtleCrypto().digest('SHA-256', toUint8Array(value));
  return `sha256:${toHex(new Uint8Array(digest))}`;
}

export async function sha256Text(value) {
  return sha256Bytes(encoder.encode(String(value)));
}

export async function sha256Canonical(value, options) {
  const canonical = canonicalJson(value, options);
  if (canonical === undefined) throw new TypeError('Top-level undefined cannot be hashed as canonical JSON.');
  return sha256Text(canonical);
}

export async function sha256Blob(blob) {
  if (!blob || typeof blob.arrayBuffer !== 'function') {
    throw new TypeError('Expected a Blob-like object with arrayBuffer().');
  }
  return sha256Bytes(await blob.arrayBuffer());
}

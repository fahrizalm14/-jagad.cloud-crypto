import { base64ToBuf, bufToBase64 } from "./utils";

export async function generateAesKey() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptText(text: string, aesKey: CryptoKey) {
  const data = new TextEncoder().encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    data
  );
  return { ciphertext: bufToBase64(ciphertext), iv: bufToBase64(iv.buffer) };
}

export async function decryptText(
  ciphertextBase64: string,
  ivBase64: string,
  aesKey: CryptoKey
) {
  const ct = base64ToBuf(ciphertextBase64);
  const iv = new Uint8Array(base64ToBuf(ivBase64));
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ct
  );
  return new TextDecoder().decode(plainBuf);
}

export async function wrapAesKey(aesKey: CryptoKey, pubKey: CryptoKey) {
  const raw = await crypto.subtle.exportKey("raw", aesKey);
  const wrapped = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    pubKey,
    raw
  );
  return bufToBase64(wrapped);
}

export async function unwrapAesKey(
  wrappedBase64: string | undefined,
  privKey: CryptoKey
) {
  if (!wrappedBase64) return null;
  const wrappedBuf = base64ToBuf(wrappedBase64);
  const raw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privKey,
    wrappedBuf
  );
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

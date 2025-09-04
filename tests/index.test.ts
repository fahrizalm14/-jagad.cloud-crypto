import "fake-indexeddb/auto";

import {
  decryptPrivateKey,
  deriveKeyFromPassword,
  encryptPrivateKey,
  ensureDeviceKey,
  generateKeyPair,
} from "../src";
import {
  decryptText,
  encryptText,
  generateAesKey,
  unwrapAesKey,
  wrapAesKey,
} from "../src/aes";
import { idbPut } from "../src/indexeddb";
import { base64ToBuf, bufToBase64 } from "../src/utils";

describe("Simulasi enkripsi pesan dengan secure-crypto", () => {
  let deviceKey: ArrayBuffer;
  let derivedKeyOld: CryptoKey;
  let derivedKeyNew: CryptoKey;
  let users: {
    id: string;
    publicKey: CryptoKey;
    encryptedPrivateKey: { iv: string; ciphertext: string };
  }[];
  let messageAESKey: CryptoKey;
  let encryptedMessage: { ciphertext: string; iv: string };

  beforeAll(async () => {
    deviceKey = await ensureDeviceKey();
    derivedKeyOld = await deriveKeyFromPassword("password123", "salt-test");
    derivedKeyNew = await deriveKeyFromPassword("password456", "salt-test");

    // Generate 5 users
    users = [];
    for (let i = 1; i <= 5; i++) {
      const { publicKey, privateKeyRaw } = await generateKeyPair();
      const encryptedPrivateKey = await encryptPrivateKey(
        privateKeyRaw,
        derivedKeyOld
      );
      const publicKeyCrypto = await crypto.subtle.importKey(
        "spki",
        base64ToBuf(publicKey),
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
      );
      users.push({
        id: `user${i}`,
        publicKey: publicKeyCrypto,
        encryptedPrivateKey,
      });
    }

    messageAESKey = await generateAesKey();
    encryptedMessage = await encryptText("Pesan rahasia!", messageAESKey);
  });

  // =====================
  // Test tiap fungsi
  // =====================

  test("ensureDeviceKey: membuat & menyimpan device key", async () => {
    expect(deviceKey.byteLength).toBe(32);

    // Simulasi jika deviceKey sudah ada dalam bentuk string base64
    const existingBase64 = bufToBase64(deviceKey);
    await idbPut("device_key_v1", existingBase64);

    const deviceKey2 = await ensureDeviceKey();
    expect(bufToBase64(deviceKey)).toBe(bufToBase64(deviceKey2));
  });

  test("deriveKeyFromPassword: menghasilkan AES-GCM key", async () => {
    expect(derivedKeyOld.type).toBe("secret");
    expect(derivedKeyNew.type).toBe("secret");
  });

  test("generateKeyPair: menghasilkan public & private key", async () => {
    const { publicKey, privateKeyRaw } = await generateKeyPair();
    expect(typeof publicKey).toBe("string");
    expect(privateKeyRaw.byteLength).toBeGreaterThan(0);
  });

  test("encryptPrivateKey & decryptPrivateKey", async () => {
    const { privateKeyRaw } = await generateKeyPair();
    const encrypted = await encryptPrivateKey(privateKeyRaw, derivedKeyOld);
    const privKey = await decryptPrivateKey(encrypted, derivedKeyOld);
    expect(privKey.type).toBe("private");
  });

  test("AES encrypt/decrypt", async () => {
    const aesKey = await generateAesKey();
    const text = "Halo dunia!";
    const { ciphertext, iv } = await encryptText(text, aesKey);
    const decrypted = await decryptText(ciphertext, iv, aesKey);
    expect(decrypted).toBe(text);
  });

  test("wrap/unwrap AES key dengan RSA-OAEP", async () => {
    const { publicKey, privateKeyRaw } = await generateKeyPair();
    const privKey = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyRaw,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );
    const pubKey = await crypto.subtle.importKey(
      "spki",
      base64ToBuf(publicKey),
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );

    const aesKey = await generateAesKey();
    const wrapped = await wrapAesKey(aesKey, pubKey);
    const unwrapped = await unwrapAesKey(wrapped, privKey);
    const text = "Tes wrap AES";
    const { ciphertext, iv } = await encryptText(text, aesKey);
    const decrypted = await decryptText(ciphertext, iv, unwrapped!);
    expect(decrypted).toBe(text);
  });

  // =====================
  // Skenario multi-user
  // =====================

  test("Public key semua user tersedia", async () => {
    const publicKeys = await Promise.all(
      users.map(async (u) =>
        bufToBase64(await crypto.subtle.exportKey("spki", u.publicKey))
      )
    );
    expect(publicKeys.length).toBe(5);
    publicKeys.forEach((pk) => expect(typeof pk).toBe("string"));
  });

  test("Hanya user tertentu bisa decrypt pesan", async () => {
    const wrappedKeys: { id: string; wrappedKey?: string }[] =
      await Promise.all(
        users.map(async (u, i) => {
          if (i % 2 === 0) {
            const wk = await wrapAesKey(messageAESKey, u.publicKey);
            return { id: u.id, wrappedKey: wk };
          } else return { id: u.id };
        })
      );

    const results = [];
    for (const u of users) {
      const wk = wrappedKeys.find((w) => w.id === u.id)?.wrappedKey;
      const privKey = await decryptPrivateKey(
        u.encryptedPrivateKey,
        derivedKeyOld
      );
      const aes = await unwrapAesKey(wk, privKey);
      const decrypted = aes
        ? await decryptText(
            encryptedMessage.ciphertext,
            encryptedMessage.iv,
            aes
          )
        : null;
      results.push({ id: u.id, decrypted });
    }

    expect(results[0].decrypted).toBe("Pesan rahasia!");
    expect(results[2].decrypted).toBe("Pesan rahasia!");
    expect(results[4].decrypted).toBe("Pesan rahasia!");
    expect(results[1].decrypted).toBeNull();
    expect(results[3].decrypted).toBeNull();
  });

  test("Simulasi ganti password & re-encrypt private key", async () => {
    // Re-encrypt private keys dengan derivedKeyNew
    for (const u of users) {
      const privKey = await decryptPrivateKey(
        u.encryptedPrivateKey,
        derivedKeyOld
      );
      const privRaw = await crypto.subtle.exportKey("pkcs8", privKey);
      u.encryptedPrivateKey = await encryptPrivateKey(privRaw, derivedKeyNew);
    }

    // Pastikan user 1,3,5 masih bisa decrypt
    const wrappedKeys: { id: string; wrappedKey?: string }[] =
      await Promise.all(
        users.map(async (u, i) => {
          if (i % 2 === 0) {
            const wk = await wrapAesKey(messageAESKey, u.publicKey);
            return { id: u.id, wrappedKey: wk };
          } else return { id: u.id };
        })
      );

    const resultsAfterPwdChange = [];
    for (const u of users) {
      const wk = wrappedKeys.find((w) => w.id === u.id)?.wrappedKey;
      const privKey = await decryptPrivateKey(
        u.encryptedPrivateKey,
        derivedKeyNew
      );
      const aes = await unwrapAesKey(wk, privKey);
      const decrypted = aes
        ? await decryptText(
            encryptedMessage.ciphertext,
            encryptedMessage.iv,
            aes
          )
        : null;
      resultsAfterPwdChange.push({ id: u.id, decrypted });
    }

    expect(resultsAfterPwdChange[0].decrypted).toBe("Pesan rahasia!");
    expect(resultsAfterPwdChange[2].decrypted).toBe("Pesan rahasia!");
    expect(resultsAfterPwdChange[4].decrypted).toBe("Pesan rahasia!");
    expect(resultsAfterPwdChange[1].decrypted).toBeNull();
    expect(resultsAfterPwdChange[3].decrypted).toBeNull();
  });

  // =====================
  // Branch coverage tambahan
  // =====================

  test("deriveKeyFromPassword: gagal jika salt invalid", async () => {
    await expect(
      // @ts-expect-error force invalid type
      deriveKeyFromPassword("password", 12345)
    ).rejects.toThrow("Invalid salt type");
  });

  test("ensureDeviceKey: jika existing sudah ArrayBuffer", async () => {
    const existingBuf = crypto.getRandomValues(new Uint8Array(32)).buffer;
    await idbPut("device_key_v1", existingBuf);

    const deviceKey2 = await ensureDeviceKey();
    expect(bufToBase64(deviceKey2)).toBe(bufToBase64(existingBuf));
  });

  test("deriveKeyFromPassword: menerima salt sebagai ArrayBuffer", async () => {
    const saltArray = new TextEncoder().encode("arraybuffer-salt").buffer;

    const key = await deriveKeyFromPassword("password123", saltArray);
    expect(key).toBeDefined();
    expect(key.type).toBe("secret");
  });
});

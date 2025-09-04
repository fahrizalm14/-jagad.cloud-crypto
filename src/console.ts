import {
  decryptPrivateKey,
  deriveKeyFromPassword,
  encryptPrivateKey,
  ensureDeviceKey,
  generateKeyPair,
} from ".";
import {
  decryptText,
  encryptText,
  generateAesKey,
  unwrapAesKey,
  wrapAesKey,
} from "./aes";
import { base64ToBuf, bufToBase64 } from "./utils";

// ===== Simulasi 5 user =====
(async () => {
  // 1. Pastikan device key
  const deviceKey = await ensureDeviceKey();
  console.log(
    "Device key ter-generate:",
    bufToBase64(deviceKey).slice(0, 20),
    "..."
  );

  // 2. Password derivation (dummy password "123456")
  const derivedKey = await deriveKeyFromPassword("123456", "salt-unik");
  console.log("Derived AES key dari password berhasil dibuat.");

  // 3. Generate keypair dan encrypt privateKey untuk tiap user
  const users: {
    id: string;
    publicKey: CryptoKey;
    encryptedPrivateKey: { iv: string; ciphertext: string };
  }[] = [];

  for (let i = 1; i <= 5; i++) {
    const { publicKey, privateKeyRaw } = await generateKeyPair();
    const encryptedPrivateKey = await encryptPrivateKey(
      privateKeyRaw,
      derivedKey
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

  console.log(
    "Semua user dengan public key dan private key terenkripsi:",
    users.map((u) => ({
      id: u.id,
      pub: u.publicKey,
      privEnc: u.encryptedPrivateKey.ciphertext.slice(0, 20) + "...",
    }))
  );

  // 4. Buat AES key untuk pesan
  const aesKey = await generateAesKey();
  const message = "Halo, ini pesan rahasia untuk beberapa user!";
  const { ciphertext, iv } = await encryptText(message, aesKey);

  // 5. Wrap AES key hanya untuk user 1,3,5
  const wrappedKeys: { id: string; wrappedKey?: string }[] = await Promise.all(
    users.map(async (u, i) => {
      if (i % 2 === 0) {
        const privKey = await decryptPrivateKey(
          u.encryptedPrivateKey,
          derivedKey
        );
        const wk = await wrapAesKey(aesKey, u.publicKey);
        return { id: u.id, wrappedKey: wk };
      } else return { id: u.id }; // tidak didaftarkan
    })
  );

  console.log(
    "Wrapped AES keys:",
    wrappedKeys.map((w) => ({
      id: w.id,
      wrappedKey: w.wrappedKey?.slice(0, 20) + "..." || "none",
    }))
  );

  // 6. Attempt decrypt
  for (const u of users) {
    const wk = wrappedKeys.find((w) => w.id === u.id)?.wrappedKey;
    const privKey = await decryptPrivateKey(u.encryptedPrivateKey, derivedKey);
    const aes = await unwrapAesKey(wk, privKey);
    if (aes) {
      const decrypted = await decryptText(ciphertext, iv, aes);
      console.log(`${u.id} berhasil decrypt:`, decrypted);
    } else {
      console.log(`${u.id} tidak bisa decrypt pesan.`);
    }
  }
})();

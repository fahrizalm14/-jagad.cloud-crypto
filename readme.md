# @jagad.cloud/crypto (Secure Crypto Library)

`@jagad.cloud/crypto` adalah library JavaScript/TypeScript yang memanfaatkan **Web Crypto API** untuk enkripsi pesan, manajemen kunci, dan komunikasi multi-user yang aman. Cocok untuk aplikasi web yang membutuhkan standar keamanan tinggi.

---

## 🔑 Fitur Utama

* Device-specific key untuk menambah keamanan
* Password-derived AES keys
* RSA key pair untuk wrap/unwrap AES keys
* Enkripsi/dekripsi private key
* Multi-user secure messaging
* Re-encrypt private key saat password diganti
* Standar internasional & praktik terbaik keamanan

---

## 🔐 Keamanan & Praktik Terbaik

* **Device Key:**

  * Tidak bisa diexport → menambah entropy unik per device
* **AES-GCM:**

  * IV random + tag 128-bit → menjamin integritas pesan
* **RSA-OAEP:**

  * Wrap/unwrap AES key aman untuk multi-user
* **PBKDF2:**

  * 200.000 iterasi → proteksi password yang kuat
* **Multi-user Support:**

  * Tanpa mengekspos private key ke server atau user lain

> Semua praktik di atas mengikuti standar industri internasional, termasuk rekomendasi NIST dan W3C untuk Web Crypto API.

---

## 📦 Instalasi

```bash
npm install @jagad.cloud/crypto
# atau
yarn add @jagad.cloud/crypto
# atau
pnpm add @jagad.cloud/crypto
```

---

## 🔑 Daftar Fungsi & Penggunaan

### 1. `ensureDeviceKey()`

```ts
import { ensureDeviceKey } from '@jagad.cloud/crypto';

const deviceKey = await ensureDeviceKey();
console.log(deviceKey.byteLength); // 32
```

* Membuat device-specific secret key (32 bytes) & menyimpannya di IndexedDB.
* Jika device key sudah ada, dikembalikan dari storage.

---

### 2. `deriveKeyFromPassword(password, salt)`

```ts
import { deriveKeyFromPassword } from '@jagad.cloud/crypto';

const derivedKey = await deriveKeyFromPassword("password123", "salt-test");
console.log(derivedKey.type); // secret
```

* Menghasilkan AES-GCM key dari password + salt + deviceKey.
* PBKDF2 dengan 200.000 iterasi, hash SHA-256.

---

### 3. `generateKeyPair()`

```ts
import { generateKeyPair } from '@jagad.cloud/crypto';

const { publicKey, privateKeyRaw } = await generateKeyPair();
```

* Membuat RSA key pair untuk user (wrap/unwrap AES key).

---

### 4. `encryptPrivateKey(privateKeyRaw, derivedKey)`

```ts
import { encryptPrivateKey } from '@jagad.cloud/crypto';

const encryptedPrivateKey = await encryptPrivateKey(privateKeyRaw, derivedKey);
```

* Mengenkripsi private key dengan AES-GCM derived key.

---

### 5. `decryptPrivateKey(encryptedPackage, derivedKey)`

```ts
import { decryptPrivateKey } from '@jagad.cloud/crypto';

const privKey = await decryptPrivateKey(encryptedPrivateKey, derivedKey);
console.log(privKey.type); // private
```

* Mendekripsi private key yang terenkripsi.

---

### 6. AES Utilities

```ts
import { generateAesKey, encryptText, decryptText, wrapAesKey, unwrapAesKey } from '@jagad.cloud/crypto';

const aesKey = await generateAesKey();
const { ciphertext, iv } = await encryptText("Halo dunia!", aesKey);
const decrypted = await decryptText(ciphertext, iv, aesKey);

// Wrap/unwrap AES key dengan RSA
const wrapped = await wrapAesKey(aesKey, publicKey);
const unwrapped = await unwrapAesKey(wrapped, privateKey);
```

---

### 7. Multi-user Secure Messaging

* Setiap user memiliki public key & encrypted private key
* Pesan dienkripsi dengan AES key
* AES key dienkripsi (wrap) untuk public key masing-masing user
* Hanya user dengan private key bisa decrypt

---

### 8. Re-encrypt Private Key saat Password Diganti

```ts
import { decryptPrivateKey, encryptPrivateKey } from '@jagad.cloud/crypto';

// Decrypt dengan derived key lama
const privKeyOld = await decryptPrivateKey(encryptedPrivateKeyOld, derivedKeyOld);

// Export raw private key
const privRaw = await crypto.subtle.exportKey("pkcs8", privKeyOld);

// Encrypt ulang dengan derived key baru
const encryptedPrivateKeyNew = await encryptPrivateKey(privRaw, derivedKeyNew);
```

---

## 📈 Diagram Alur

```mermaid
graph TD
    PT["Plaintext Message"]
    AESK["AES-GCM Key"]
    ENC["Encrypted Message (AES-GCM)"]
    USER1_PUB["User1 Public Key (RSA-OAEP)"]
    USER2_PUB["User2 Public Key (RSA-OAEP)"]
    WRAP1["Wrapped AES Key for User1"]
    WRAP2["Wrapped AES Key for User2"]
    USER1_PRIV["User1 Private Key + Derived Key"]
    USER2_PRIV["User2 Private Key + Derived Key"]
    DECRYPT1["User1 Decrypts AES Key & Message"]
    DECRYPT2["User2 Decrypts AES Key & Message"]
    NEW_DK["New Derived Key (after password change)"]
    RE_ENC["Re-encrypt Private Key with New Derived Key"]

    PT --> AESK
    AESK --> ENC
    AESK --> WRAP1
    AESK --> WRAP2
    USER1_PUB --> WRAP1
    USER2_PUB --> WRAP2

    WRAP1 --> USER1_PRIV --> DECRYPT1 --> ENC
    WRAP2 --> USER2_PRIV --> DECRYPT2 --> ENC

    USER1_PRIV --> RE_ENC --> NEW_DK
    USER2_PRIV --> RE_ENC
```

---

## 📊 Hasil Test & Coverage

```
--------------|---------|----------|---------|---------|-------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
--------------|---------|----------|---------|---------|-------------------
All files     |   100   |   100    |   100   |   100   |                   
aes.ts        |   100   |   100    |   100   |   100   |                   
index.ts      |   100   |   100    |   100   |   100   |                   
indexeddb.ts  |   100   |   100    |   100   |   100   |                   
utils.ts      |   100   |   100    |   100   |   100   |                   
--------------|---------|----------|---------|---------|-------------------
```

* Semua test lulus (12 test)
* Framework: Jest + fake-indexeddb
* Mencakup semua fungsi dan branch coverage

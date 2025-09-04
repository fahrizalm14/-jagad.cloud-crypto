// src/indexeddb.ts
import { openDB } from "idb";

const IDB_DB_NAME = "secure-crypto-db";
const IDB_STORE_NAME = "keys";

export async function getDB() {
  return openDB(IDB_DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    },
  });
}

export async function idbPut(key: string, value: any) {
  const db = await getDB();
  await db.put(IDB_STORE_NAME, value, key);
}

export async function idbGet<T = any>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get(IDB_STORE_NAME, key);
}

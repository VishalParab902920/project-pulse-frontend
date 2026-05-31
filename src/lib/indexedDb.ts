/**
 * Project Pulse — IndexedDB Offline Storage
 * Stores pending logs when the user is offline.
 * Syncs automatically when connectivity is restored.
 */

const DB_NAME = "pulse_offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_sync_logs";

export interface OfflineLog {
  id?: number;
  type: "text" | "audio";
  payload: string; // text content or base64-encoded audio
  timestamp: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineLog(type: "text" | "audio", payload: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.add({
      type,
      payload,
      timestamp: new Date().toISOString(),
    });
    tx.oncomplete = () => {
      console.log(`[Offline] Saved ${type} log to IndexedDB`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineLogs(): Promise<OfflineLog[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as OfflineLog[]);
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineLog(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllOfflineLogs(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

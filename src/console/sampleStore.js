import {
  CONSOLE_SCHEMA_VERSION,
  normalizeProfile,
  validateShowPackage,
} from "./profile.js";

const DATABASE_NAME = "object-drum-show-console";
const DATABASE_VERSION = 1;
const STORE_NAME = "samples";

export function buildShowPackage(profileValue, sampleDataBySlot = {}) {
  const profile = normalizeProfile(profileValue);
  return validateShowPackage({
    schemaVersion: CONSOLE_SCHEMA_VERSION,
    profile,
    samples: sampleDataBySlot,
  });
}

export function readShowPackage(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("无法读取配置包：文件不是有效的 JSON");
  }
  return validateShowPackage(value);
}

export class SampleStore {
  constructor({ indexedDB = globalThis.indexedDB, databaseName = DATABASE_NAME } = {}) {
    this.indexedDB = indexedDB;
    this.databaseName = databaseName;
    this.databasePromise = null;
  }

  async get(slotId) {
    const database = await this.open();
    return requestResult(database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(slotId));
  }

  async set(slotId, record) {
    const database = await this.open();
    const value = { ...record, slotId };
    await transactionComplete(database, "readwrite", (store) => store.put(value));
    return value;
  }

  async delete(slotId) {
    const database = await this.open();
    await transactionComplete(database, "readwrite", (store) => store.delete(slotId));
  }

  async clear() {
    const database = await this.open();
    await transactionComplete(database, "readwrite", (store) => store.clear());
  }

  async entries() {
    const database = await this.open();
    const values = await requestResult(
      database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll(),
    );
    return Object.fromEntries(values.map((record) => [record.slotId, stripSlotId(record)]));
  }

  async open() {
    if (!this.indexedDB) throw new Error("当前浏览器不支持本地音效存储");
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = this.indexedDB.open(this.databaseName, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, { keyPath: "slotId" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("无法打开本地音效存储"));
      });
    }
    return this.databasePromise;
  }
}

function transactionComplete(database, mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    action(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("本地音效存储失败"));
    transaction.onabort = () => reject(transaction.error || new Error("本地音效存储已取消"));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("本地音效读取失败"));
  });
}

function stripSlotId(record) {
  const { slotId, ...value } = record;
  return value;
}

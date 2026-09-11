import { createLogger } from '../shared/logger';

const logger = createLogger('storage');

const DB_NAME = 'tuhclip';
const DB_VERSION = 1;

let connection: IDBDatabase | null = null;
let pending: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (connection) return Promise.resolve(connection);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('meetings')) {
        db.createObjectStore('meetings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('segments')) {
        const segments = db.createObjectStore('segments', { keyPath: 'id' });
        segments.createIndex('by-meeting', 'meetingId', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      connection = request.result;
      pending = null;
      resolve(connection);
    };
    request.onerror = () => {
      pending = null;
      logger.error('IndexedDB open failed', request.error);
      reject(request.error ?? new Error('IndexedDB open failed'));
    };
  });
  return pending;
}

export function getDatabase(): Promise<IDBDatabase> {
  return open();
}

export function closeDatabase(): void {
  connection?.close();
  connection = null;
  pending = null;
}

export function deleteDatabase(): Promise<void> {
  closeDatabase();
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

function transact<T>(
  store: 'meetings' | 'segments' | 'settings',
  mode: IDBTransactionMode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (objectStore: IDBObjectStore) => IDBRequest<any>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const objectStore = transaction.objectStore(store);
        let value: T | undefined;
        try {
          const request = run(objectStore);
          request.onsuccess = () => {
            value = request.result;
          };
          request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        } catch (error) {
          reject(error);
          return;
        }
        transaction.oncomplete = () => resolve(value as T);
        transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
      }),
  );
}

export function storePut<T>(store: 'meetings' | 'segments' | 'settings', value: T): Promise<void> {
  return transact<void>(store, 'readwrite', (objectStore) => objectStore.put(value)).then(() => undefined);
}

export function storeGet<T>(store: 'meetings' | 'segments' | 'settings', key: string): Promise<T | null> {
  return transact<T | undefined>(store, 'readonly', (objectStore) => objectStore.get(key)).then(
    (value) => value ?? null,
  );
}

export function storeGetAll<T>(store: 'meetings' | 'segments' | 'settings'): Promise<T[]> {
  return transact<T[]>(store, 'readonly', (objectStore) => objectStore.getAll()).then(
    (value) => value ?? [],
  );
}

export function storeDelete(store: 'meetings' | 'segments' | 'settings', key: string): Promise<void> {
  return transact<void>(store, 'readwrite', (objectStore) => objectStore.delete(key)).then(() => undefined);
}

export function storeGetAllByIndex<T>(
  store: 'segments',
  index: 'by-meeting',
  key: string,
): Promise<T[]> {
  return open().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const transaction = db.transaction(store, 'readonly');
        const request = transaction.objectStore(store).index(index).getAll(key);
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB index query failed'));
      }),
  );
}

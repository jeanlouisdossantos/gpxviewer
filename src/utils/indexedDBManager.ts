export interface SavedTrace {
  id: string;
  name: string;
  gpxContent: string;
  timestamp: number;
  fileName: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  // Parameters
  altitudeThreshold: number;
  useSlopeColoring: boolean;
  slopeThreshold1: number;
  slopeThreshold2: number;
}

const DB_NAME = 'gpxviewer';
const STORE_NAME = 'savedTraces';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance!);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveTrace(trace: SavedTrace): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(trace);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getTraces(): Promise<SavedTrace[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const request = index.getAll();

    request.onsuccess = () => {
      // Sort by timestamp descending (newest first)
      const traces = request.result.sort((a, b) => b.timestamp - a.timestamp);
      resolve(traces);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getTrace(id: string): Promise<SavedTrace | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTrace(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateTraceName(id: string, newName: string): Promise<void> {
  const trace = await getTrace(id);
  if (trace) {
    trace.name = newName;
    await saveTrace(trace);
  }
}

export async function updateTrace(id: string, updates: Partial<SavedTrace>): Promise<void> {
  const trace = await getTrace(id);
  if (trace) {
    const updated = { ...trace, ...updates, id: trace.id, timestamp: trace.timestamp };
    await saveTrace(updated as SavedTrace);
  }
}

export async function checkStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
}> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentage: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
    };
  }
  return { usage: 0, quota: 0, percentage: 0 };
}

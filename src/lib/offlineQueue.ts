/**
 * offlineQueue.ts — IndexedDB Offline Queue Manager for SIMMACI Scanner
 *
 * Provides offline-first capability for QR code attendance scanning:
 * 1. Safely stores scans into IndexedDB when offline or network fails
 * 2. Emits real-time reactive events for UI counter badges
 * 3. Automatically synchronizes pending scans when internet connection is restored
 * 4. Supports batch synchronization via /api/public/meetings/batch-sync
 */

import axios from 'axios';
import { API_URL } from './api';

export interface QueuedScan {
  id?: number;
  clientId: string;
  type: 'meeting' | 'teacher' | 'student' | 'staff';
  pin: string;
  qrUrl: string;
  meetingId?: number;
  participantId?: number;
  participantName?: string;
  jabatan?: string;
  instansi?: string;
  scannedAt: string; // ISO 8601 string
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage?: string;
  attempts: number;
  syncedAt?: string;
}

const DB_NAME = 'simmaci_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_scans';

type QueueListener = (scans: QueuedScan[]) => void;
const listeners: Set<QueueListener> = new Set();

function notifyListeners(scans: QueuedScan[]) {
  listeners.forEach((fn) => {
    try {
      fn(scans);
    } catch (e) {
      console.error('Queue listener error:', e);
    }
  });
}

/**
 * Open IndexedDB instance safely.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('scannedAt', 'scannedAt', { unique: false });
        store.createIndex('clientId', 'clientId', { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enqueue a scan into IndexedDB.
 */
export async function enqueueOfflineScan(
  scan: Omit<QueuedScan, 'id' | 'status' | 'attempts'>
): Promise<QueuedScan> {
  const db = await openDB();

  const record: QueuedScan = {
    ...scan,
    status: 'pending',
    attempts: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);

    request.onsuccess = async () => {
      const createdRecord = { ...record, id: request.result as number };
      const allPending = await getPendingOfflineScans();
      notifyListeners(allPending);
      resolve(createdRecord);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending (unsynced) scans from IndexedDB.
 */
export async function getPendingOfflineScans(type?: string): Promise<QueuedScan[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let items: QueuedScan[] = request.result || [];
        items = items.filter((item) => item.status === 'pending' || item.status === 'failed');
        if (type) {
          items = items.filter((item) => item.type === type);
        }
        // Order latest first
        items.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
        resolve(items);
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * Get all scans (recent history) from IndexedDB.
 */
export async function getAllOfflineScans(limit = 50): Promise<QueuedScan[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const items: QueuedScan[] = request.result || [];
        items.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
        resolve(items.slice(0, limit));
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * Update scan status in IndexedDB.
 */
export async function updateScanStatus(
  id: number,
  status: QueuedScan['status'],
  errorMessage?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item: QueuedScan = getReq.result;
      if (!item) {
        resolve();
        return;
      }
      item.status = status;
      item.attempts = (item.attempts || 0) + 1;
      if (status === 'synced') {
        item.syncedAt = new Date().toISOString();
        item.errorMessage = undefined;
      } else if (errorMessage) {
        item.errorMessage = errorMessage;
      }

      const updateReq = store.put(item);
      updateReq.onsuccess = async () => {
        const allPending = await getPendingOfflineScans();
        notifyListeners(allPending);
        resolve();
      };
      updateReq.onerror = () => reject(updateReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Delete a specific scan by id.
 */
export async function removeOfflineScan(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = async () => {
      const allPending = await getPendingOfflineScans();
      notifyListeners(allPending);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear older synced scans from IndexedDB (garbage collection).
 */
export async function clearSyncedOfflineScans(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  const db = await openDB();
  const cutoff = Date.now() - olderThanMs;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items: QueuedScan[] = request.result || [];
      let deleted = 0;
      for (const item of items) {
        if (item.status === 'synced' && item.syncedAt && new Date(item.syncedAt).getTime() < cutoff) {
          if (item.id) store.delete(item.id);
          deleted++;
        }
      }
      resolve(deleted);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Synchronize all pending scans to backend server.
 */
export async function syncOfflineQueue(pin: string): Promise<{
  syncedCount: number;
  duplicateCount: number;
  failedCount: number;
  total: number;
}> {
  const pending = await getPendingOfflineScans();
  if (pending.length === 0) {
    return { syncedCount: 0, duplicateCount: 0, failedCount: 0, total: 0 };
  }

  // Filter meeting scans
  const meetingScans = pending.filter((item) => item.type === 'meeting');
  if (meetingScans.length === 0) {
    return { syncedCount: 0, duplicateCount: 0, failedCount: 0, total: 0 };
  }

  // Mark all currently processing as syncing
  for (const scan of meetingScans) {
    if (scan.id) await updateScanStatus(scan.id, 'syncing');
  }

  const payloadItems = meetingScans.map((scan) => ({
    client_id: scan.clientId,
    qr_url: scan.qrUrl,
    checked_in_at: scan.scannedAt,
  }));

  try {
    const response = await axios.post(`${API_URL}/public/meetings/batch-sync`, {
      pin,
      items: payloadItems,
    });

    const data = response.data?.data;
    const results: Array<{ client_id: string; status: string; message: string }> = data?.items || [];

    let syncedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    for (const res of results) {
      const matchingScan = meetingScans.find((s) => s.clientId === res.client_id);
      if (!matchingScan || !matchingScan.id) continue;

      if (res.status === 'synced') {
        await updateScanStatus(matchingScan.id, 'synced');
        syncedCount++;
      } else if (res.status === 'already_checked_in') {
        // Already recorded previously on server — mark synced as duplicate handled
        await updateScanStatus(matchingScan.id, 'synced', 'Sudah tercatat sebelumnya');
        duplicateCount++;
      } else {
        await updateScanStatus(matchingScan.id, 'failed', res.message || 'Gagal sinkron');
        failedCount++;
      }
    }

    return {
      syncedCount,
      duplicateCount,
      failedCount,
      total: meetingScans.length,
    };
  } catch (error: any) {
    // If batch sync failed (e.g. offline again or 500), mark back to pending/failed
    const errorMsg = error.response?.data?.message || error.message || 'Gagal terhubung ke server';
    for (const scan of meetingScans) {
      if (scan.id) await updateScanStatus(scan.id, 'failed', errorMsg);
    }
    throw error;
  }
}

/**
 * Subscribe to offline queue changes.
 */
export function subscribeOfflineQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  // Send initial pending scans immediately
  getPendingOfflineScans().then(listener).catch(() => {});
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Setup automatic sync when browser comes online.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    // Attempt auto-sync if PIN is cached in sessionStorage
    const cachedPin = sessionStorage.getItem('meeting_scanner_pin');
    if (cachedPin) {
      try {
        await syncOfflineQueue(cachedPin);
      } catch (e) {
        console.warn('Auto offline sync deferred:', e);
      }
    }
  });
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  const mockAxiosInstance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
  };

  return {
    default: {
      ...mockAxiosInstance,
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

describe('offlineQueue IndexedDB manager', () => {
  let records: any[] = [];
  let idCounter = 0;

  beforeEach(async () => {
    vi.clearAllMocks();
    records = [];
    idCounter = 0;

    // In-memory IndexedDB mock for jsdom test runner
    const mockDB: any = {
      objectStoreNames: { contains: () => true },
      createObjectStore: () => ({
        createIndex: () => {},
      }),
      transaction: () => ({
        objectStore: () => ({
          add: (record: any) => {
            const req: any = {};
            setTimeout(() => {
              idCounter++;
              const saved = { ...record, id: idCounter };
              records.push(saved);
              req.result = idCounter;
              req.onsuccess?.({ target: req });
            }, 0);
            return req;
          },
          getAll: () => {
            const req: any = {};
            setTimeout(() => {
              req.result = [...records];
              req.onsuccess?.({ target: req });
            }, 0);
            return req;
          },
          get: (id: number) => {
            const req: any = {};
            setTimeout(() => {
              req.result = records.find((r) => r.id === id);
              req.onsuccess?.({ target: req });
            }, 0);
            return req;
          },
          put: (updated: any) => {
            const req: any = {};
            setTimeout(() => {
              const idx = records.findIndex((r) => r.id === updated.id);
              if (idx !== -1) records[idx] = updated;
              req.onsuccess?.({ target: req });
            }, 0);
            return req;
          },
          delete: (id: number) => {
            const req: any = {};
            setTimeout(() => {
              records = records.filter((r) => r.id !== id);
              req.onsuccess?.({ target: req });
            }, 0);
            return req;
          },
        }),
      }),
    };

    (window as any).indexedDB = {
      open: () => {
        const req: any = {};
        setTimeout(() => {
          req.result = mockDB;
          req.onsuccess?.({ target: req });
        }, 0);
        return req;
      },
    };
  });

  it('can enqueue offline scans into IndexedDB and retrieve them', async () => {
    const { enqueueOfflineScan, getPendingOfflineScans } = await import('../offlineQueue');

    const scanItem = {
      clientId: `test_${Date.now()}_1`,
      type: 'meeting' as const,
      pin: '1234',
      qrUrl: 'https://simmaci.com/meetings/10/check-in?participant=55',
      meetingId: 10,
      participantId: 55,
      participantName: 'Budi Santoso',
      scannedAt: new Date().toISOString(),
    };

    const saved = await enqueueOfflineScan(scanItem);
    expect(saved).toBeDefined();
    expect(saved.id).toBeDefined();
    expect(saved.status).toBe('pending');

    const pending = await getPendingOfflineScans('meeting');
    expect(pending.length).toBeGreaterThanOrEqual(1);
    const found = pending.find((p) => p.clientId === scanItem.clientId);
    expect(found).toBeDefined();
    expect(found?.participantId).toBe(55);
  });

  it('can update scan status to synced', async () => {
    const { enqueueOfflineScan, updateScanStatus, getAllOfflineScans } = await import('../offlineQueue');

    const scanItem = {
      clientId: `test_${Date.now()}_2`,
      type: 'meeting' as const,
      pin: '1234',
      qrUrl: 'https://simmaci.com/meetings/10/check-in?participant=56',
      meetingId: 10,
      participantId: 56,
      scannedAt: new Date().toISOString(),
    };

    const saved = await enqueueOfflineScan(scanItem);
    await updateScanStatus(saved.id!, 'synced');

    const all = await getAllOfflineScans();
    const updated = all.find((item) => item.id === saved.id);
    expect(updated?.status).toBe('synced');
    expect(updated?.syncedAt).toBeDefined();
  });

  it('can remove an offline scan by id', async () => {
    const { enqueueOfflineScan, removeOfflineScan, getAllOfflineScans } = await import('../offlineQueue');

    const scanItem = {
      clientId: `test_${Date.now()}_3`,
      type: 'meeting' as const,
      pin: '1234',
      qrUrl: 'https://simmaci.com/meetings/10/check-in?participant=57',
      scannedAt: new Date().toISOString(),
    };

    const saved = await enqueueOfflineScan(scanItem);
    await removeOfflineScan(saved.id!);

    const all = await getAllOfflineScans();
    const found = all.find((item) => item.id === saved.id);
    expect(found).toBeUndefined();
  });

  it('syncOfflineQueue calls backend batchSync endpoint and marks items synced', async () => {
    const { enqueueOfflineScan, syncOfflineQueue, getAllOfflineScans } = await import('../offlineQueue');

    const scanItem = {
      clientId: `test_batch_${Date.now()}`,
      type: 'meeting' as const,
      pin: '9999',
      qrUrl: 'https://simmaci.com/meetings/12/check-in?participant=88',
      meetingId: 12,
      participantId: 88,
      scannedAt: new Date().toISOString(),
    };

    const saved = await enqueueOfflineScan(scanItem);

    (axios.post as any).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: [
            { client_id: scanItem.clientId, status: 'synced', message: 'Check-in berhasil' },
          ],
        },
      },
    });

    const result = await syncOfflineQueue('9999');
    expect(result.syncedCount).toBeGreaterThanOrEqual(1);

    const all = await getAllOfflineScans();
    const synced = all.find((item) => item.id === saved.id);
    expect(synced?.status).toBe('synced');
  });
});

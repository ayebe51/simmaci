import { describe, it, expect, vi } from 'vitest';
import {
  generateSkBatched,
  syncInBatches,
  retrySyncFailures,
  BATCH_SIZE,
  SYNC_CONCURRENCY,
  type Teacher,
  type GenerateOptions,
  type GeneratedDoc,
  type GenerateSingleDocFn,
  type SyncDocFn,
  type SyncFailure,
} from './generateSkBatched';

function createTeachers(count: number): Teacher[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    nama: `Teacher ${i + 1}`,
  }));
}

const defaultOptions: GenerateOptions = {
  templateId: 1,
  tahunAjaran: '2024/2025',
};

function createSuccessGenerator(): GenerateSingleDocFn {
  return async (teacher, _options) => ({
    teacher,
    blob: new Blob(['test']),
    nomorSk: `SK-${teacher.id}`,
  });
}

describe('generateSkBatched', () => {
  it('processes all teachers and returns generated docs', async () => {
    const teachers = createTeachers(7);
    const onProgress = vi.fn();
    const controller = new AbortController();

    const result = await generateSkBatched(
      teachers,
      defaultOptions,
      createSuccessGenerator(),
      onProgress,
      controller.signal
    );

    expect(result.generated).toHaveLength(7);
    expect(result.failures).toHaveLength(0);
  });

  it('uses BATCH_SIZE of 5', () => {
    expect(BATCH_SIZE).toBe(5);
  });

  it('invokes onProgress after each batch with correct counts', async () => {
    const teachers = createTeachers(12);
    const onProgress = vi.fn();
    const controller = new AbortController();

    await generateSkBatched(
      teachers,
      defaultOptions,
      createSuccessGenerator(),
      onProgress,
      controller.signal
    );

    // 12 teachers / 5 per batch = 3 batches (5, 5, 2)
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, 5, 12);
    expect(onProgress).toHaveBeenNthCalledWith(2, 10, 12);
    expect(onProgress).toHaveBeenNthCalledWith(3, 12, 12);
  });

  it('stops processing after current batch when signal is aborted', async () => {
    const teachers = createTeachers(15);
    const onProgress = vi.fn();
    const controller = new AbortController();

    let callCount = 0;
    const generator: GenerateSingleDocFn = async (teacher, options) => {
      callCount++;
      // Abort after first batch completes
      if (callCount === 5) {
        controller.abort();
      }
      return { teacher, blob: new Blob(['test']) };
    };

    const result = await generateSkBatched(
      teachers,
      defaultOptions,
      generator,
      onProgress,
      controller.signal
    );

    // First batch (5) completes, then signal is checked before second batch
    expect(result.generated).toHaveLength(5);
    expect(result.failures).toHaveLength(0);
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it('continues on individual doc failure and collects failures', async () => {
    const teachers = createTeachers(10);
    const onProgress = vi.fn();
    const controller = new AbortController();

    const failingIds = new Set([2, 5, 8]);
    const generator: GenerateSingleDocFn = async (teacher, _options) => {
      if (failingIds.has(teacher.id)) {
        throw new Error(`Generation failed for ${teacher.nama}`);
      }
      return { teacher, blob: new Blob(['test']) };
    };

    const result = await generateSkBatched(
      teachers,
      defaultOptions,
      generator,
      onProgress,
      controller.signal
    );

    expect(result.generated).toHaveLength(7);
    expect(result.failures).toHaveLength(3);
    expect(result.failures[0].teacher.id).toBe(2);
    expect(result.failures[0].error).toBe('Generation failed for Teacher 2');
    expect(result.failures[1].teacher.id).toBe(5);
    expect(result.failures[2].teacher.id).toBe(8);
  });

  it('returns empty results for empty teacher array', async () => {
    const onProgress = vi.fn();
    const controller = new AbortController();

    const result = await generateSkBatched(
      [],
      defaultOptions,
      createSuccessGenerator(),
      onProgress,
      controller.signal
    );

    expect(result.generated).toHaveLength(0);
    expect(result.failures).toHaveLength(0);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('yields to event loop between batches', async () => {
    const teachers = createTeachers(10);
    const onProgress = vi.fn();
    const controller = new AbortController();

    // vitest uses jsdom which has requestAnimationFrame
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');

    await generateSkBatched(
      teachers,
      defaultOptions,
      createSuccessGenerator(),
      onProgress,
      controller.signal
    );

    // 2 batches of 5 = 1 yield between them (no yield after last batch)
    expect(rafSpy).toHaveBeenCalledTimes(1);
    rafSpy.mockRestore();
  });

  it('handles non-Error thrown values gracefully', async () => {
    const teachers = createTeachers(3);
    const onProgress = vi.fn();
    const controller = new AbortController();

    const generator: GenerateSingleDocFn = async (teacher, _options) => {
      if (teacher.id === 2) {
        throw 'string error'; // non-Error throw
      }
      return { teacher, blob: new Blob(['test']) };
    };

    const result = await generateSkBatched(
      teachers,
      defaultOptions,
      generator,
      onProgress,
      controller.signal
    );

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toBe('string error');
  });

  it('does not start new batch if signal already aborted', async () => {
    const teachers = createTeachers(10);
    const onProgress = vi.fn();
    const controller = new AbortController();
    controller.abort(); // Pre-abort

    const generator = vi.fn(createSuccessGenerator());

    const result = await generateSkBatched(
      teachers,
      defaultOptions,
      generator,
      onProgress,
      controller.signal
    );

    expect(generator).not.toHaveBeenCalled();
    expect(result.generated).toHaveLength(0);
    expect(result.failures).toHaveLength(0);
  });
});


function createGeneratedDocs(count: number): GeneratedDoc[] {
  return Array.from({ length: count }, (_, i) => ({
    teacher: { id: i + 1, nama: `Teacher ${i + 1}` },
    blob: new Blob(['test']),
    nomorSk: `SK-${i + 1}`,
  }));
}

describe('syncInBatches', () => {
  it('uses SYNC_CONCURRENCY of 10', () => {
    expect(SYNC_CONCURRENCY).toBe(10);
  });

  it('syncs all documents successfully', async () => {
    const docs = createGeneratedDocs(5);
    const syncFn: SyncDocFn = vi.fn(async () => {});

    const result = await syncInBatches(docs, syncFn);

    expect(result.synced).toHaveLength(5);
    expect(result.syncFailures).toHaveLength(0);
    expect(syncFn).toHaveBeenCalledTimes(5);
  });

  it('batches concurrent requests according to concurrency parameter', async () => {
    const docs = createGeneratedDocs(25);
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const syncFn: SyncDocFn = async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((resolve) => setTimeout(resolve, 10));
      currentConcurrent--;
    };

    await syncInBatches(docs, syncFn, 10);

    // Max concurrent should be at most 10 (the concurrency limit)
    expect(maxConcurrent).toBeLessThanOrEqual(10);
    expect(maxConcurrent).toBeGreaterThan(1); // Confirms concurrency is happening
  });

  it('tracks sync failures separately from successes', async () => {
    const docs = createGeneratedDocs(10);
    const failingIds = new Set([3, 7]);

    const syncFn: SyncDocFn = async (doc) => {
      if (failingIds.has(doc.teacher.id)) {
        throw new Error(`Sync failed for ${doc.teacher.nama}`);
      }
    };

    const result = await syncInBatches(docs, syncFn);

    expect(result.synced).toHaveLength(8);
    expect(result.syncFailures).toHaveLength(2);
    expect(result.syncFailures[0].doc.teacher.id).toBe(3);
    expect(result.syncFailures[0].error).toBe('Sync failed for Teacher 3');
    expect(result.syncFailures[1].doc.teacher.id).toBe(7);
    expect(result.syncFailures[1].error).toBe('Sync failed for Teacher 7');
  });

  it('processes multiple batches when docs exceed concurrency', async () => {
    const docs = createGeneratedDocs(25);
    const batchStarts: number[] = [];
    let callCount = 0;

    const syncFn: SyncDocFn = async () => {
      callCount++;
      // Track when each batch starts (first call in each group of 10)
      if ((callCount - 1) % 10 === 0) {
        batchStarts.push(callCount);
      }
    };

    await syncInBatches(docs, syncFn, 10);

    // 25 docs / 10 concurrency = 3 batches (10, 10, 5)
    expect(batchStarts).toHaveLength(3);
    expect(callCount).toBe(25);
  });

  it('returns empty results for empty input', async () => {
    const syncFn: SyncDocFn = vi.fn(async () => {});

    const result = await syncInBatches([], syncFn);

    expect(result.synced).toHaveLength(0);
    expect(result.syncFailures).toHaveLength(0);
    expect(syncFn).not.toHaveBeenCalled();
  });

  it('handles non-Error thrown values gracefully', async () => {
    const docs = createGeneratedDocs(3);

    const syncFn: SyncDocFn = async (doc) => {
      if (doc.teacher.id === 2) {
        throw 'network timeout';
      }
    };

    const result = await syncInBatches(docs, syncFn);

    expect(result.synced).toHaveLength(2);
    expect(result.syncFailures).toHaveLength(1);
    expect(result.syncFailures[0].error).toBe('network timeout');
  });

  it('uses default concurrency of 10 when not specified', async () => {
    const docs = createGeneratedDocs(15);
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const syncFn: SyncDocFn = async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((resolve) => setTimeout(resolve, 5));
      currentConcurrent--;
    };

    await syncInBatches(docs, syncFn);

    expect(maxConcurrent).toBeLessThanOrEqual(10);
  });
});

describe('retrySyncFailures', () => {
  it('retries failed documents and returns new results', async () => {
    const failures: SyncFailure[] = [
      { doc: createGeneratedDocs(1)[0], error: 'timeout' },
      { doc: createGeneratedDocs(2)[1], error: 'server error' },
    ];

    const syncFn: SyncDocFn = vi.fn(async () => {});

    const result = await retrySyncFailures(failures, syncFn);

    expect(result.synced).toHaveLength(2);
    expect(result.syncFailures).toHaveLength(0);
    expect(syncFn).toHaveBeenCalledTimes(2);
  });

  it('tracks failures that persist on retry', async () => {
    const failures: SyncFailure[] = [
      { doc: { teacher: { id: 1, nama: 'Teacher 1' }, blob: null }, error: 'timeout' },
      { doc: { teacher: { id: 2, nama: 'Teacher 2' }, blob: null }, error: 'server error' },
      { doc: { teacher: { id: 3, nama: 'Teacher 3' }, blob: null }, error: 'timeout' },
    ];

    const syncFn: SyncDocFn = async (doc) => {
      if (doc.teacher.id === 2) {
        throw new Error('Still failing');
      }
    };

    const result = await retrySyncFailures(failures, syncFn);

    expect(result.synced).toHaveLength(2);
    expect(result.syncFailures).toHaveLength(1);
    expect(result.syncFailures[0].doc.teacher.id).toBe(2);
    expect(result.syncFailures[0].error).toBe('Still failing');
  });
});

/**
 * Batched SK document generation with progress reporting and cancellation support.
 *
 * Processes teachers in batches of 5, yielding to the browser event loop between
 * batches to prevent UI freezes. Supports partial failure (continues on individual
 * doc failure) and AbortSignal-based cancellation.
 *
 * Feature: performance-optimization
 * Validates: Requirements 6.1, 6.2, 6.4, 6.6
 */

export const BATCH_SIZE = 5;

/** Represents a teacher candidate for SK document generation. */
export interface Teacher {
  id: number;
  nama: string;
  [key: string]: unknown;
}

/** Options passed to the document generation function. */
export interface GenerateOptions {
  templateId?: number;
  tahunAjaran?: string;
  tanggalPenetapan?: string;
  jenisSk?: string;
  [key: string]: unknown;
}

/** A successfully generated document. */
export interface GeneratedDoc {
  teacher: Teacher;
  blob: Blob | ArrayBuffer | unknown;
  nomorSk?: string;
  [key: string]: unknown;
}

/** A failed document generation entry. */
export interface FailedDoc {
  teacher: Teacher;
  error: string;
}

/** Result of the batched generation process. */
export interface GenerateResult {
  generated: GeneratedDoc[];
  failures: FailedDoc[];
}

/** A failed sync entry. */
export interface SyncFailure {
  doc: GeneratedDoc;
  error: string;
}

/** Result of the batched sync process. */
export interface SyncResult {
  synced: GeneratedDoc[];
  syncFailures: SyncFailure[];
}

/** Function signature for syncing a single document to the backend. */
export type SyncDocFn = (doc: GeneratedDoc) => Promise<void>;

/** Function signature for generating a single document. */
export type GenerateSingleDocFn = (
  teacher: Teacher,
  options: GenerateOptions
) => Promise<GeneratedDoc>;

/**
 * Generates SK documents in batches with progress reporting and cancellation.
 *
 * @param teachers - Array of teachers to generate documents for
 * @param options - Generation options (template, dates, etc.)
 * @param generateSingleDoc - Function that generates a single document
 * @param onProgress - Callback invoked after each batch with (completed, total)
 * @param signal - AbortSignal for cancellation (stops after current batch)
 * @returns Promise resolving to generated docs and failures
 */
export async function generateSkBatched(
  teachers: Teacher[],
  options: GenerateOptions,
  generateSingleDoc: GenerateSingleDocFn,
  onProgress: (completed: number, total: number) => void,
  signal: AbortSignal
): Promise<GenerateResult> {
  const generated: GeneratedDoc[] = [];
  const failures: FailedDoc[] = [];

  for (let i = 0; i < teachers.length; i += BATCH_SIZE) {
    // Check cancellation before starting a new batch
    if (signal.aborted) break;

    const batch = teachers.slice(i, i + BATCH_SIZE);

    for (const teacher of batch) {
      try {
        const doc = await generateSingleDoc(teacher, options);
        generated.push(doc);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        failures.push({ teacher, error: errorMessage });
      }
    }

    // Report progress after each batch
    onProgress(generated.length + failures.length, teachers.length);

    // Yield to browser event loop between batches to keep UI responsive
    if (i + BATCH_SIZE < teachers.length && !signal.aborted) {
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => resolve());
        } else {
          // Fallback for non-browser environments (e.g., tests)
          setTimeout(resolve, 0);
        }
      });
    }
  }

  return { generated, failures };
}


export const SYNC_CONCURRENCY = 10;

/**
 * Syncs generated documents to the backend in batches of concurrent requests.
 *
 * Processes documents in groups of `concurrency` (default 10) concurrent API calls.
 * Tracks sync failures separately and returns them for retry capability.
 *
 * Feature: performance-optimization
 * Validates: Requirements 6.3, 6.5
 *
 * @param results - Array of generated documents to sync
 * @param syncFn - Function that syncs a single document to the backend
 * @param concurrency - Number of concurrent requests per batch (default 10)
 * @returns Promise resolving to synced docs and sync failures
 */
export async function syncInBatches(
  results: GeneratedDoc[],
  syncFn: SyncDocFn,
  concurrency: number = SYNC_CONCURRENCY
): Promise<SyncResult> {
  const synced: GeneratedDoc[] = [];
  const syncFailures: SyncFailure[] = [];

  for (let i = 0; i < results.length; i += concurrency) {
    const batch = results.slice(i, i + concurrency);

    const settled = await Promise.allSettled(
      batch.map(async (doc) => {
        await syncFn(doc);
        return doc;
      })
    );

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      if (result.status === 'fulfilled') {
        synced.push(result.value);
      } else {
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        syncFailures.push({ doc: batch[j], error: errorMessage });
      }
    }
  }

  return { synced, syncFailures };
}

/**
 * Retries syncing previously failed documents.
 *
 * Convenience wrapper around syncInBatches that accepts SyncFailure entries
 * and re-attempts the sync for each failed document.
 *
 * @param failures - Array of previously failed sync entries
 * @param syncFn - Function that syncs a single document to the backend
 * @param concurrency - Number of concurrent requests per batch (default 10)
 * @returns Promise resolving to synced docs and remaining failures
 */
export async function retrySyncFailures(
  failures: SyncFailure[],
  syncFn: SyncDocFn,
  concurrency: number = SYNC_CONCURRENCY
): Promise<SyncResult> {
  const docs = failures.map((f) => f.doc);
  return syncInBatches(docs, syncFn, concurrency);
}

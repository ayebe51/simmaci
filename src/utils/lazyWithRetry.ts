import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { versionManager } from '@/lib/versionManager';

interface LazyWithRetryOptions {
  retries?: number;
  interval?: number;
  reloadOnChunkMismatch?: boolean;
}

/**
 * Enhanced React.lazy wrapper that automatically retries dynamic imports
 * when network connection drops, experiences packet loss, or is slow.
 *
 * If after all retries it still fails and reloadOnChunkMismatch is true,
 * it safely attempts a one-time clean page reload to fetch the latest chunk manifest,
 * protected against infinite reload loops and respecting user busy states.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  options: LazyWithRetryOptions = {}
): LazyExoticComponent<T> {
  const {
    retries = 3,
    interval = 1500,
    reloadOnChunkMismatch = true,
  } = options;

  return lazy(async () => {
    const RECOVERY_KEY = 'simmaci_chunk_recovery';
    const recoveryRecord = JSON.parse(
      window.sessionStorage.getItem(RECOVERY_KEY) || '{"count":0,"time":0}'
    );
    const now = Date.now();
    const recentlyRecovered = now - recoveryRecord.time < 30000 && recoveryRecord.count >= 1;

    let currentAttempt = 0;

    const executeImport = async (): Promise<{ default: T }> => {
      try {
        currentAttempt++;
        return await componentImport();
      } catch (error: any) {
        const isNetworkOrChunkError =
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('dynamically imported module') ||
          error?.message?.includes('Importing a module script failed') ||
          error?.name === 'ChunkLoadError' ||
          error instanceof TypeError;

        if (currentAttempt < retries) {
          const delay = interval * Math.pow(1.5, currentAttempt - 1);
          console.warn(
            `[lazyWithRetry] Gagal memuat chunk (Percobaan ${currentAttempt}/${retries}). Mencoba kembali dalam ${Math.round(delay)}ms...`,
            error
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return executeImport();
        }

        // If retries failed, check server version in background
        versionManager.checkNow().catch(() => {});

        // If chunk error and we haven't recently auto-reloaded in the last 30s
        if (reloadOnChunkMismatch && isNetworkOrChunkError && !recentlyRecovered) {
          // If user is busy with active forms or dialogs, don't abrupt reload
          if (!versionManager.isUserBusy()) {
            window.sessionStorage.setItem(
              RECOVERY_KEY,
              JSON.stringify({ count: recoveryRecord.count + 1, time: now })
            );
            console.warn('[lazyWithRetry] Chunk mismatch terdeteksi. Memuat ulang halaman untuk manifest terbaru...');
            window.location.reload();
            return new Promise(() => {});
          }
        }

        throw error;
      }
    };

    const result = await executeImport();
    // Reset recovery record on successful import after 10 seconds of stability
    setTimeout(() => {
      window.sessionStorage.removeItem(RECOVERY_KEY);
    }, 10000);
    return result;
  });
}

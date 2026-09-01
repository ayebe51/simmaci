import { lazy, ComponentType, LazyExoticComponent } from 'react';

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
 * it will attempt a one-time clean page reload to fetch the latest chunk manifest.
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
    const pageAlreadyRefreshed = JSON.parse(
      window.sessionStorage.getItem('chunk_reload_retry') || 'false'
    );

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

        // If all retries failed and it's a chunk error, try refreshing page once
        if (reloadOnChunkMismatch && isNetworkOrChunkError && !pageAlreadyRefreshed) {
          window.sessionStorage.setItem('chunk_reload_retry', 'true');
          console.warn('[lazyWithRetry] Mencoba memuat ulang halaman untuk memperbarui chunk manifest...');
          window.location.reload();
          // Return a pending promise so React doesn't render error boundary during reload
          return new Promise(() => {});
        }

        // Reset the flag for future navigations
        window.sessionStorage.setItem('chunk_reload_retry', 'false');
        throw error;
      }
    };

    const result = await executeImport();
    // Reset refresh flag on successful import
    window.sessionStorage.setItem('chunk_reload_retry', 'false');
    return result;
  });
}

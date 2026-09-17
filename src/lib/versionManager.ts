/**
 * SIMMACI Version & Deployment Manager
 *
 * Coordinates cross-tab deployment detection, safe reloads, BFCache wakeups,
 * and user input preservation for Zero Hard Refresh Deployment.
 */

export interface VersionInfo {
  version: string;
  buildId: string;
  timestamp: string;
  environment?: string;
}

type VersionListener = (newVersion: VersionInfo) => void;

class VersionManager {
  private currentBuildId: string | null = null;
  private latestVersion: VersionInfo | null = null;
  private hasUpdate = false;
  private listeners: Set<VersionListener> = new Set();
  private channel: BroadcastChannel | null = null;
  private checkIntervalTimer: ReturnType<typeof setInterval> | null = null;
  private isChecking = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private async init() {
    // 1. Fetch initial version from /version.json
    try {
      const res = await fetch(`/version.json?init=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data: VersionInfo = await res.json();
        this.currentBuildId = data.buildId;
        console.log(`[VersionManager] Initialized with build: ${this.currentBuildId}`);
      }
    } catch {
      this.currentBuildId = 'initial';
    }

    // 2. Setup BroadcastChannel for cross-tab communication
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('simmaci_release_channel');
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'UPDATE_AVAILABLE' && event.data.versionInfo) {
            this.handleNewVersionDetected(event.data.versionInfo, false);
          }
        };
      } catch (e) {
        console.warn('[VersionManager] BroadcastChannel not available:', e);
      }
    }

    // Fallback localStorage storage event (for older browsers or isolated contexts)
    window.addEventListener('storage', (e) => {
      if (e.key === 'simmaci_latest_version' && e.newValue) {
        try {
          const versionInfo: VersionInfo = JSON.parse(e.newValue);
          this.handleNewVersionDetected(versionInfo, false);
        } catch {}
      }
    });

    // 3. Reactive wakeup triggers
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkNow();
      }
    });

    window.addEventListener('focus', () => {
      this.checkNow();
    });

    // BFCache (Back-Forward Cache): triggered when navigating back/forward from memory cache
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        console.log('[VersionManager] Page restored from BFCache, checking for updates...');
        this.checkNow();
      }
    });

    // Periodic check every 3 minutes with ±15s jitter
    const jitter = Math.floor(Math.random() * 30000) - 15000;
    this.checkIntervalTimer = setInterval(() => {
      this.checkNow();
    }, 180000 + jitter);
  }

  /**
   * Checks the server for a newer version.json buildId.
   */
  public async checkNow(): Promise<boolean> {
    if (this.isChecking || !navigator.onLine) return false;
    this.isChecking = true;

    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'Pragma': 'no-cache',
        },
      });

      if (!res.ok) {
        this.isChecking = false;
        return false;
      }

      const info: VersionInfo = await res.json();

      if (this.currentBuildId && info.buildId && info.buildId !== this.currentBuildId) {
        this.handleNewVersionDetected(info, true);
        this.isChecking = false;
        return true;
      }
    } catch (err) {
      console.warn('[VersionManager] Version check skipped (network glitch):', err);
    } finally {
      this.isChecking = false;
    }
    return false;
  }

  private handleNewVersionDetected(info: VersionInfo, broadcast: boolean) {
    if (this.hasUpdate && this.latestVersion?.buildId === info.buildId) {
      return;
    }

    this.hasUpdate = true;
    this.latestVersion = info;
    console.info(`[VersionManager] 🚀 Versi baru SIMMACI terdeteksi: ${info.buildId} (${info.timestamp})`);

    if (broadcast) {
      this.channel?.postMessage({
        type: 'UPDATE_AVAILABLE',
        versionInfo: info,
      });

      try {
        localStorage.setItem('simmaci_latest_version', JSON.stringify(info));
      } catch {}
    }

    this.listeners.forEach((listener) => {
      try {
        listener(info);
      } catch (err) {
        console.error('[VersionManager] Listener error:', err);
      }
    });
  }

  /**
   * Detects whether the user is actively engaged in an input, modal, or form.
   * Prevents abrupt page reloads that destroy work in progress.
   */
  public isUserBusy(): boolean {
    if (typeof document === 'undefined') return false;

    // 1. Is an input/textarea/select or contenteditable currently focused?
    const activeEl = document.activeElement;
    if (
      activeEl &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) ||
        activeEl.getAttribute('contenteditable') === 'true')
    ) {
      return true;
    }

    // 2. Is any dialog, modal, or drawer open?
    const isModalOpen = !!document.querySelector(
      '[role="dialog"], [role="alertdialog"], [data-state="open"]'
    );
    if (isModalOpen) return true;

    // 3. Is any form marked dirty with unsaved data?
    const hasDirtyForm = !!document.querySelector('[data-form-dirty="true"]');
    if (hasDirtyForm) return true;

    return false;
  }

  /**
   * Safely reloads the application to load the newly deployed bundle.
   * If force is false and user is busy, the reload is deferred and returns false.
   */
  public safeReload(force = false): boolean {
    if (!force && this.isUserBusy()) {
      return false;
    }

    // Clean any chunk recovery keys to prevent reload loop
    sessionStorage.removeItem('simmaci_chunk_recovery');
    sessionStorage.removeItem('simmaci_preload_reload');
    sessionStorage.removeItem('chunk_reload_retry');

    window.location.reload();
    return true;
  }

  /**
   * Subscribe to version update events.
   */
  public subscribe(listener: VersionListener): () => void {
    this.listeners.add(listener);
    if (this.hasUpdate && this.latestVersion) {
      listener(this.latestVersion);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStatus() {
    return {
      currentBuildId: this.currentBuildId,
      hasUpdate: this.hasUpdate,
      latestVersion: this.latestVersion,
    };
  }
}

export const versionManager = new VersionManager();

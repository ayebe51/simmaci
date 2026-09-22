import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Home, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Smart NotFoundPage with automatic cache-clearing recovery.
 *
 * When a user visits a newly added route (like /meetings/:id/walk-in) on a device
 * that still has an old SPA bundle cached, this page detects if the path looks like
 * a valid application route. If so, it unregisters stale Service Workers, clears
 * caches, and automatically hard-reloads once without frustrating the user.
 */
export const NotFoundPage: React.FC = () => {
  const [isRecovering, setIsRecovering] = useState(false);
  const currentPath = window.location.pathname;

  // Check if current URL looks like a valid route in SIMMACI
  const isRecognizedRoute =
    /^\/meetings(\/.*)?$/i.test(currentPath) ||
    /^\/scan(\/.*)?$/i.test(currentPath) ||
    /^\/verify(\/.*)?$/i.test(currentPath) ||
    /^\/daftar(\/.*)?$/i.test(currentPath) ||
    /^\/ppdb(\/.*)?$/i.test(currentPath) ||
    /^\/dashboard(\/.*)?$/i.test(currentPath);

  const handleHardRefresh = async () => {
    setIsRecovering(true);
    try {
      // 1. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // 2. Clear caches storage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // 3. Clear session storage recovery keys
      sessionStorage.removeItem('simmaci_chunk_recovery');
      sessionStorage.removeItem('simmaci_preload_reload');
      sessionStorage.removeItem('chunk_reload_retry');
    } catch (e) {
      console.warn('[NotFoundPage] Failed to wipe caches:', e);
    } finally {
      // Force reload from server with timestamp to bust proxy/browser cache
      const sep = window.location.href.includes('?') ? '&' : '?';
      window.location.href = `${window.location.href}${sep}_reload=${Date.now()}`;
    }
  };

  useEffect(() => {
    if (!isRecognizedRoute) return;

    const RECOVERY_KEY = 'simmaci_404_auto_recovered';
    const lastRecoveryTime = parseInt(sessionStorage.getItem(RECOVERY_KEY) || '0', 10);
    const now = Date.now();

    // If never recovered or last recovery was more than 30 seconds ago, try auto-healing once
    if (now - lastRecoveryTime > 30000) {
      sessionStorage.setItem(RECOVERY_KEY, String(now));
      console.info(`[NotFoundPage] Rute valid ${currentPath} tidak ditemukan di bundle lokal. Memperbarui versi dari server...`);
      setIsRecovering(true);
      const timer = setTimeout(() => {
        handleHardRefresh();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [currentPath, isRecognizedRoute]);

  if (isRecovering) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">Memperbarui Halaman...</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Sedang mengambil versi terbaru sistem dari server. Mohon tunggu sebentar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
              <AlertCircle className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h1 className="text-lg font-bold text-slate-900">
                Halaman Tidak Ditemukan
              </h1>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Tautan yang Anda tuju tidak ditemukan atau aplikasi pada perangkat Anda perlu diperbarui ke versi terbaru.
              </p>
            </div>

            <div className="bg-slate-100 rounded-lg p-2.5 text-xs text-slate-600 font-mono break-all select-all">
              {currentPath}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs font-semibold shadow-sm"
                onClick={handleHardRefresh}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Perbarui / Muat Ulang Halaman
              </Button>

              <Button
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100 gap-2 text-xs"
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                <Home className="h-3.5 w-3.5" />
                Kembali ke Beranda
              </Button>
            </div>

            <p className="text-[11px] text-slate-400 pt-2">
              LP Ma'arif NU Cilacap • SIMMACI
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotFoundPage;

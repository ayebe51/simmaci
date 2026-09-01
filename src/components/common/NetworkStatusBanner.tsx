import { useState, useEffect } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOff, Wifi, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NetworkStatusBanner() {
  const { isOnline, isSlowConnection, isReconnecting, checkConnection } = useNetworkStatus();
  const [showRestored, setShowRestored] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
        setWasOffline(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Show "Restored" toast-banner
  if (showRestored) {
    return (
      <div className="bg-emerald-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top sticky top-0 z-50">
        <Wifi className="h-4 w-4" />
        <span>Koneksi internet telah terhubung kembali. Memperbarui data...</span>
      </div>
    );
  }

  // Offline banner
  if (!isOnline) {
    return (
      <div className="bg-rose-600 text-white px-4 py-2 text-sm font-medium flex flex-wrap items-center justify-center gap-3 shadow-md sticky top-0 z-50 animate-in fade-in slide-in-from-top">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Koneksi terputus. Anda sedang melihat data dari memori cache lokal.</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => checkConnection()}
          disabled={isReconnecting}
          className="h-7 text-xs px-2.5 bg-white text-rose-700 hover:bg-rose-50 border-0 font-semibold gap-1.5"
        >
          <RefreshCw className={`h-3 w-3 ${isReconnecting ? 'animate-spin' : ''}`} />
          {isReconnecting ? 'Menghubungkan...' : 'Coba Hubungkan'}
        </Button>
      </div>
    );
  }

  // Slow connection banner
  if (isSlowConnection) {
    return (
      <div className="bg-amber-500 text-slate-900 px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50">
        <AlertTriangle className="h-3.5 w-3.5 text-slate-900 shrink-0" />
        <span>Koneksi internet Anda lambat. Data mungkin membutuhkan waktu lebih lama untuk dimuat.</span>
      </div>
    );
  }

  return null;
}

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/api';

export interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  isReconnecting: boolean;
  checkConnection: () => Promise<boolean>;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSlowConnection, setIsSlowConnection] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsReconnecting(true);
    try {
      // Ping backend warmup or health endpoint with a small timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${API_URL}/warmup`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const ok = res.ok;
      setIsOnline(ok);
      setIsSlowConnection(false);
      return ok;
    } catch {
      // Fallback: check basic online status
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setIsOnline(online);
      return online;
    } finally {
      setIsReconnecting(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for slow connection via Network Information API
    const nav = navigator as any;
    if (nav?.connection) {
      const updateConnectionStatus = () => {
        const { effectiveType, rtt } = nav.connection;
        const isSlow = effectiveType === '2g' || effectiveType === 'slow-2g' || (rtt && rtt > 2000);
        setIsSlowConnection(!!isSlow);
      };

      updateConnectionStatus();
      nav.connection.addEventListener('change', updateConnectionStatus);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        nav.connection.removeEventListener('change', updateConnectionStatus);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnection]);

  return {
    isOnline,
    isSlowConnection,
    isReconnecting,
    checkConnection,
  };
}

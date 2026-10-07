import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera, ArrowLeft, RefreshCw, Wifi, WifiOff, CheckCircle2,
  AlertTriangle, Clock, Users, ShieldCheck, Flashlight, FlipHorizontal,
  ChevronRight, Database, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  enqueueOfflineScan, getPendingOfflineScans, getAllOfflineScans,
  syncOfflineQueue, subscribeOfflineQueue, QueuedScan
} from '@/lib/offlineQueue';
import axios from 'axios';
import { API_URL } from '@/lib/api';

// Sound synthesizers using Web Audio API (zero audio file dependencies)
function playBeep(type: 'success' | 'offline' | 'error') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'success') {
      // Pleasant high-pitch chime (success)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // E6
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'offline') {
      // Warm double beep (offline queued)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1); // G5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Low buzz (error / already checked in)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Audio context may fail if user hasn't interacted with page yet
  }
}

// Trigger device vibration if supported
function vibrateDevice(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignored if unsupported
  }
}

interface ScanFeedItem {
  id: string;
  name: string;
  jabatan?: string;
  instansi?: string;
  time: string;
  isOffline: boolean;
  status: 'success' | 'duplicate' | 'error';
  message: string;
}

export default function MeetingScannerPage() {
  const { id: routeMeetingId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();

  // PIN & Session
  const [pin, setPin] = useState<string>(() => sessionStorage.getItem('meeting_scanner_pin') || '');
  const [isPinVerified, setIsPinVerified] = useState<boolean>(() => !!sessionStorage.getItem('meeting_scanner_pin'));
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);

  // Scanner State
  const [scanning, setScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);

  // Feed & Queue
  const [recentScans, setRecentScans] = useState<ScanFeedItem[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef<boolean>(false);

  // Load pending scans count & setup subscriber
  useEffect(() => {
    const updatePending = async () => {
      const pending = await getPendingOfflineScans('meeting');
      setPendingCount(pending.length);
    };

    updatePending();
    const unsubscribe = subscribeOfflineQueue((scans) => {
      setPendingCount(scans.filter((s) => s.type === 'meeting').length);
    });

    // Load recent history from IndexedDB
    getAllOfflineScans(15).then((scans) => {
      const feedItems: ScanFeedItem[] = scans.map((s) => ({
        id: s.clientId,
        name: s.participantName || `Peserta #${s.participantId || '?'}`,
        jabatan: s.jabatan,
        instansi: s.instansi,
        time: new Date(s.scannedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        isOffline: s.status !== 'synced',
        status: s.status === 'failed' ? 'error' : 'success',
        message: s.status === 'synced' ? 'Tersinkron ke server' : 'Menunggu sinkronisasi internet',
      }));
      setRecentScans(feedItems);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Trigger auto-sync when online and has pending scans
  useEffect(() => {
    if (isOnline && pendingCount > 0 && pin && !isSyncing) {
      handleManualSync();
    }
  }, [isOnline, pendingCount, pin]);

  // Handle PIN verification
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      toast.error('Masukkan PIN Scanner Rapat');
      return;
    }

    setIsVerifyingPin(true);
    try {
      const res = await axios.post(`${API_URL}/public/meetings/verify-pin`, { pin: pin.trim() });
      if (res.data?.success) {
        sessionStorage.setItem('meeting_scanner_pin', pin.trim());
        setIsPinVerified(true);
        toast.success('PIN Terverifikasi. Selamat bertugas, Panitia Rapat!');
      } else {
        toast.error(res.data?.message || 'PIN salah');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'PIN salah atau koneksi bermasalah';
      toast.error(msg);
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Sync Queue manually or on auto-trigger
  const handleManualSync = useCallback(async () => {
    if (!pin) {
      toast.error('PIN diperlukan untuk sinkronisasi');
      return;
    }

    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const res = await syncOfflineQueue(pin);
      if (res.total > 0) {
        toast.success(`Sinkronisasi selesai: ${res.syncedCount} tercatat, ${res.duplicateCount} duplikat.`);
        playBeep('success');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal sinkronisasi data ke server';
      toast.error(msg);
    } finally {
      setIsSyncing(false);
    }
  }, [pin, isSyncing]);

  // Handle QR Scan
  const handleScanCode = async (decodedText: string) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, 2500);

    const clientUuid = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const nowIso = new Date().toISOString();
    const timeFormatted = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Parse URL client-side
    let meetingId: number | undefined;
    let participantId: number | undefined;

    try {
      const parsed = new URL(decodedText);
      const match = parsed.pathname.match(/\/meetings\/(\d+)\/check-in/);
      if (match) {
        meetingId = parseInt(match[1], 10);
      }
      const pParam = parsed.searchParams.get('participant');
      if (pParam) {
        participantId = parseInt(pParam, 10);
      }
    } catch {
      // invalid URL
    }

    if (!meetingId || !participantId) {
      toast.error('QR Code bukan format undangan absensi rapat SIMMACI.');
      playBeep('error');
      vibrateDevice(200);
      return;
    }

    // Check if offline: Immediately queue into IndexedDB!
    if (!isOnline || !navigator.onLine) {
      try {
        await enqueueOfflineScan({
          clientId: clientUuid,
          type: 'meeting',
          pin,
          qrUrl: decodedText,
          meetingId,
          participantId,
          participantName: `Peserta #${participantId}`,
          scannedAt: nowIso,
        });

        playBeep('offline');
        vibrateDevice([100, 50, 100]);
        toast.warning(`[MODE OFFLINE] Presensi Peserta #${participantId} tersimpan lokal di perangkat.`);

        setRecentScans((prev) => [
          {
            id: clientUuid,
            name: `Peserta #${participantId}`,
            time: timeFormatted,
            isOffline: true,
            status: 'success',
            message: 'Tersimpan di perangkat (Menunggu Sinyal)',
          },
          ...prev.slice(0, 19),
        ]);
        return;
      } catch (err: any) {
        toast.error('Gagal menyimpan ke memori lokal');
        return;
      }
    }

    // Online attempt: send to server with client timestamp
    try {
      const res = await axios.post(`${API_URL}/public/meetings/scan`, {
        pin,
        qr_url: decodedText,
        checked_in_at: nowIso,
      });

      if (res.data?.success) {
        const d = res.data?.data;
        const pName = d?.participant_name || `Peserta #${participantId}`;
        playBeep('success');
        vibrateDevice(100);
        toast.success(res.data?.message || `Check-in ${pName} berhasil!`);

        setRecentScans((prev) => [
          {
            id: clientUuid,
            name: pName,
            jabatan: d?.jabatan,
            instansi: d?.instansi,
            time: timeFormatted,
            isOffline: false,
            status: 'success',
            message: res.data?.message || 'Check-in berhasil tercatat',
          },
          ...prev.slice(0, 19),
        ]);
      }
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || 'Gagal memproses QR code';

      if (status === 409) {
        // Already checked in
        playBeep('error');
        vibrateDevice(200);
        toast.info(msg);
        setRecentScans((prev) => [
          {
            id: clientUuid,
            name: `Peserta #${participantId}`,
            time: timeFormatted,
            isOffline: false,
            status: 'duplicate',
            message: msg,
          },
          ...prev.slice(0, 19),
        ]);
      } else if (!err.response || status >= 500) {
        // Network failure / Gateway Timeout (504) -> Fallback to Offline Queue!
        try {
          await enqueueOfflineScan({
            clientId: clientUuid,
            type: 'meeting',
            pin,
            qrUrl: decodedText,
            meetingId,
            participantId,
            participantName: `Peserta #${participantId}`,
            scannedAt: nowIso,
          });

          playBeep('offline');
          vibrateDevice([100, 50, 100]);
          toast.warning(`[SINYAL TERPUTUS] Presensi Peserta #${participantId} diamankan ke memori lokal.`);

          setRecentScans((prev) => [
            {
              id: clientUuid,
              name: `Peserta #${participantId}`,
              time: timeFormatted,
              isOffline: true,
              status: 'success',
              message: 'Tersimpan di memori lokal (Koneksi Terganggu)',
            },
            ...prev.slice(0, 19),
          ]);
        } catch {
          toast.error('Gagal mencadangkan scan ke memori lokal');
        }
      } else {
        playBeep('error');
        vibrateDevice(200);
        toast.error(msg);
      }
    }
  };

  // Start Scanner
  const startCamera = async () => {
    setCameraError(null);

    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
      }

      const scanner = new Html5Qrcode('meeting-scanner-viewport');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode },
        {
          fps: 20,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        handleScanCode,
        () => {} // silent on frame fail
      );

      setScanning(true);

      // Check torch capability
      try {
        const capabilities = scanner.getRunningTrackCapabilities() as any;
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      setScanning(false);
      setCameraError(err?.message || 'Tidak dapat mengakses kamera. Pastikan izin kamera aktif.');
      toast.error('Gagal membuka kamera');
    }
  };

  // Stop Camera
  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
    setTorchOn(false);
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const next = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: next } as any],
      });
      setTorchOn(next);
    } catch (e) {
      toast.error('Gagal mengaktifkan senter');
    }
  };

  // Toggle Camera Facing
  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (scanning) {
      await stopCamera();
      setTimeout(() => {
        startCamera();
      }, 300);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* ── Top Header & Status ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/meetings')}
              className="text-white hover:bg-slate-800 rounded-xl h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Scanner Rapat (PWA)
              </h1>
              <p className="text-[11px] text-slate-400">Mode Offline-First Terpadu</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Online / Offline status badge */}
            <Badge
              variant="outline"
              className={`text-[11px] font-mono flex items-center gap-1 px-2.5 py-1 ${
                isOnline
                  ? 'border-emerald-500/50 text-emerald-400 bg-emerald-950/40'
                  : 'border-amber-500/50 text-amber-400 bg-amber-950/40 animate-pulse'
              }`}
            >
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </Badge>

            {/* Sync trigger button when pending offline scans exist */}
            {pendingCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualSync}
                disabled={isSyncing || !isOnline}
                className="h-7 text-xs px-2.5 border-amber-500/50 text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 gap-1.5"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{pendingCount}</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Offline Banner Warning if disconnected ─────────────────────── */}
      {!isOnline && (
        <div className="bg-amber-600/90 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-inner">
          <AlertTriangle className="h-4 w-4 shrink-0 text-slate-950" />
          <span>Koneksi internet gedung terputus. Scan tetap berfungsi dan tersimpan aman di HP.</span>
        </div>
      )}

      {/* ── Main Container ────────────────────────────────────────────── */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {/* PIN Screen if not authenticated */}
        {!isPinVerified ? (
          <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-xl mt-8">
            <CardHeader className="text-center pb-2 pt-6">
              <div className="mx-auto w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-2">
                <ShieldCheck className="h-7 w-7 text-emerald-400" />
              </div>
              <CardTitle className="text-lg font-bold">Autentikasi Panitia Rapat</CardTitle>
              <p className="text-xs text-slate-400">
                Masukkan PIN Scanner Rapat yang dikonfigurasi di Settings SIMMACI.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyPin} className="space-y-4">
                <div>
                  <Input
                    type="password"
                    inputMode="numeric"
                    placeholder="Masukkan PIN..."
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-center text-xl tracking-widest h-12 rounded-xl"
                    maxLength={10}
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isVerifyingPin}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-11 rounded-xl"
                >
                  {isVerifyingPin ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                  Buka Kamera Scanner
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Camera Viewport */}
            <div className="relative rounded-3xl overflow-hidden bg-black border-4 border-slate-800 shadow-2xl">
              <div
                id="meeting-scanner-viewport"
                className="w-full"
                style={{ minHeight: scanning ? 320 : 0 }}
              />

              {!scanning && !cameraError && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-700">
                    <Camera className="h-8 w-8 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-xs font-medium">Kamera siap dinyalakan</p>
                  <Button
                    onClick={startCamera}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 h-9 rounded-xl mt-1"
                  >
                    Nyalakan Kamera
                  </Button>
                </div>
              )}

              {!scanning && cameraError && (
                <div className="flex flex-col items-center justify-center py-12 px-6 gap-3 text-center">
                  <XCircle className="h-10 w-10 text-rose-500" />
                  <p className="text-rose-400 text-xs font-semibold">{cameraError}</p>
                  <Button
                    onClick={startCamera}
                    variant="outline"
                    className="border-slate-700 text-slate-300 text-xs h-8 rounded-lg mt-2"
                  >
                    Coba Lagi
                  </Button>
                </div>
              )}

              {/* Scanning Crosshair Overlay */}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-emerald-500/40 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                  </div>
                </div>
              )}

              {/* Controls bar over camera */}
              {scanning && (
                <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                  {hasTorch && (
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={toggleTorch}
                      className={`h-8 w-8 rounded-full ${
                        torchOn ? 'bg-amber-400 text-slate-950' : 'bg-slate-900/80 text-white'
                      }`}
                    >
                      <Flashlight className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={toggleFacingMode}
                    className="h-8 w-8 rounded-full bg-slate-900/80 text-white"
                  >
                    <FlipHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Camera Toggle Button */}
            {scanning && (
              <Button
                variant="outline"
                onClick={stopCamera}
                className="w-full border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-9 rounded-xl"
              >
                Hentikan Sementara Kamera
              </Button>
            )}

            {/* Offline Storage Info Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                <div>
                  <p className="font-semibold text-slate-200">Penyimpanan Offline (IndexedDB)</p>
                  <p className="text-[11px] text-slate-400">
                    {pendingCount > 0
                      ? `${pendingCount} scan belum terkirim ke server`
                      : 'Seluruh scan tersinkronisasi 100%'}
                  </p>
                </div>
              </div>
              {pendingCount > 0 && isOnline && (
                <Button
                  size="sm"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold h-7 px-2.5 text-xs rounded-lg gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  Kirim
                </Button>
              )}
            </div>

            {/* Recent Scans Feed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Riwayat Scan Hari Ini ({recentScans.length})
                </h3>
              </div>

              {recentScans.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                  Belum ada scan kehadiran yang tercatat. Arahkan kamera ke QR peserta.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {recentScans.map((scan) => (
                    <div
                      key={scan.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition ${
                        scan.isOffline
                          ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                          : scan.status === 'duplicate'
                          ? 'bg-blue-950/20 border-blue-800/40 text-blue-200'
                          : 'bg-slate-900 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            scan.isOffline
                              ? 'bg-amber-500/20 text-amber-400'
                              : scan.status === 'duplicate'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {scan.name.charAt(0)}
                        </div>
                        <div className="truncate">
                          <p className="font-semibold truncate">{scan.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {scan.jabatan ? `${scan.jabatan} · ` : ''}
                            {scan.instansi || scan.message}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        <span className="font-mono text-[11px] text-slate-400 block">{scan.time}</span>
                        {scan.isOffline ? (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[9px] px-1 py-0">
                            Offline
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 text-[9px] px-1 py-0">
                            Server ✓
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

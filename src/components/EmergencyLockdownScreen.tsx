import React, { useState } from 'react';
import { ShieldAlert, Lock, AlertTriangle, KeyRound } from 'lucide-react';

interface EmergencyLockdownScreenProps {
  onBypass?: () => void;
}

export const EmergencyLockdownScreen: React.FC<EmergencyLockdownScreenProps> = ({ onBypass }) => {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleBypassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default admin secret bypass PIN: simmaci2026
    if (pin.trim() === 'simmaci2026' || pin.trim() === 'admin123') {
      localStorage.setItem('simmaci_lockdown_bypass', 'true');
      if (onBypass) {
        onBypass();
      } else {
        window.location.reload();
      }
    } else {
      setPinError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 overflow-y-auto selection:bg-red-500 selection:text-white">
      {/* Background Ambience / Red Alert Grid */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#dc2626_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Badge */}
      <header className="relative z-10 w-full max-w-4xl flex items-center justify-between border-b border-red-900/60 pb-4 pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
          <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-red-400 uppercase">
            DEFCON 1 / EMERGENCY SECURITY PROTOCOL
          </span>
        </div>
        <span className="font-mono text-xs text-slate-400 hidden sm:inline-block">
          REF: CVE-2026-109618
        </span>
      </header>

      {/* Main Alert Card */}
      <main className="relative z-10 w-full max-w-2xl my-auto py-8">
        <div className="bg-slate-900/90 border-2 border-red-600/70 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(220,38,38,0.25)] backdrop-blur-xl">
          
          {/* Pulsing Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-red-600/40 animate-ping" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-b from-red-600 to-red-950 border border-red-400/50 flex items-center justify-center shadow-inner">
                <ShieldAlert className="w-10 h-10 sm:w-12 sm:h-12 text-white animate-pulse" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-3 mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold tracking-wide uppercase">
              <AlertTriangle className="w-3.5 h-3.5" />
              Sistem Dinonaktifkan Sementara
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              SISTEM SIMMACI OFFLINE
            </h1>
            <p className="text-sm sm:text-base font-medium text-red-300 leading-relaxed max-w-xl mx-auto">
              PEMBERITAHUAN: Sistem SIMMACI dinonaktifkan sementara untuk Mitigasi Darurat Serangan Siber Global (Zero-Day CVE-2026-109618 - NSA Alert). Tim Teknis sedang melakukan patching keamanan tingkat tinggi.
            </p>
          </div>

          {/* Technical Details Cards */}
          <div className="space-y-3 bg-slate-950/60 rounded-xl p-4 sm:p-5 border border-slate-800 text-xs sm:text-sm">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Akses Pengguna & Login Ditutup</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Seluruh gerbang login admin, operator sekolah, dan akses data dinonaktifkan penuh demi mencegah potensi penyusupan memori runtime.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-t border-slate-800/80 pt-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-200">Integritas Data Guru & SK Aman</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Database dan media penyimpanan telah diisolasi dan di-backup secara aman. Tidak ada kebocoran data terdeteksi.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-t border-slate-800/80 pt-3">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1.5 shrink-0 animate-pulse" />
              <div>
                <p className="font-semibold text-slate-200">Proses Mitigasi Sedang Berlangsung</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Tim teknis sedang merekonstruksi image container, menguji patch binary, dan menata ulang security policy.
                </p>
              </div>
            </div>
          </div>

          {/* Notice to Operators */}
          <div className="mt-6 text-center text-xs text-slate-400">
            <p>
              Bagi Operator Madrasah yang memiliki berkas permohonan SK mendesak, silakan berkoordinasi langsung dengan Pengurus PC LP Ma'arif NU Cilacap.
            </p>
          </div>

        </div>
      </main>

      {/* Footer & Discreet Admin Bypass */}
      <footer className="relative z-10 w-full max-w-4xl border-t border-slate-900 pt-4 pb-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <p>© 2026 PC LP Ma'arif NU Cilacap — Pusat Data & Sistem Informasi</p>
        
        <button
          type="button"
          onClick={() => setShowPinModal(true)}
          className="text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1 text-[11px]"
        >
          <KeyRound className="w-3 h-3" />
          <span>Akses Darurat Admin</span>
        </button>
      </footer>

      {/* Secret PIN Modal for Admin Bypass */}
      {showPinModal && (
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              Bypass Khusus Administrator
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Masukkan PIN Otorisasi Administrator untuk membuka akses sistem di browser ini:
            </p>
            <form onSubmit={handleBypassSubmit} className="space-y-3">
              <input
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setPinError(false);
                }}
                placeholder="PIN Administrator..."
                autoFocus
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
              />
              {pinError && (
                <p className="text-xs text-red-400 font-semibold">
                  PIN salah. Akses ditolak.
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors"
                >
                  Buka Akses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

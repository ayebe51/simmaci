import React, { useEffect, useState } from "react"
import { versionManager, VersionInfo } from "@/lib/versionManager"
import { Button } from "@/components/ui/button"
import { RefreshCw, Sparkles, X, AlertCircle } from "lucide-react"

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const unsubscribe = versionManager.subscribe((info) => {
      setUpdateInfo(info)
    })
    return unsubscribe
  }, [])

  if (!updateInfo) return null

  const handleUpdateClick = () => {
    // Check if user is busy with active forms or dialogs
    if (versionManager.isUserBusy()) {
      setShowConfirmModal(true)
    } else {
      performUpdate()
    }
  }

  const performUpdate = () => {
    setIsUpdating(true)
    versionManager.safeReload(true)
  }

  return (
    <>
      {/* ── Floating Update Banner ── */}
      {!isDismissed ? (
        <div
          role="region"
          aria-label="Pemberitahuan pembaruan sistem"
          className="fixed bottom-5 right-5 z-[99999] max-w-md w-[calc(100vw-2.5rem)] sm:w-auto bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-2xl p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-100 dark:bg-emerald-950/80 p-2.5 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>

            <div className="flex-1 pr-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Pembaruan SIMMACI Tersedia
                </h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  v{updateInfo.version}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Versi baru siap dipasang dengan peningkatan performa dan kestabilan.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleUpdateClick}
                  disabled={isUpdating}
                  className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-sm"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? "animate-spin" : ""}`} />
                  {isUpdating ? "Memuat..." : "Perbarui Sekarang"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsDismissed(true)}
                  className="h-8 px-2.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                >
                  Nanti
                </Button>
              </div>
            </div>

            <button
              onClick={() => setIsDismissed(true)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
              aria-label="Tutup pemberitahuan"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Collapsed Floating Pill Button */
        <button
          onClick={() => setIsDismissed(false)}
          className="fixed bottom-5 right-5 z-[99999] bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 animate-bounce"
          aria-label="Tampilkan pembaruan yang tertunda"
        >
          <Sparkles className="h-4 w-4" />
          <span>Update Baru Siap Dipasang</span>
        </button>
      )}

      {/* ── Form Protection Confirmation Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-3">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Aktivitas Sedang Berlangsung
              </h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Anda terdeteksi sedang membuka formulir input atau dialog aktif. Memuat ulang halaman sekarang
              dapat menyebabkan isian yang belum disimpan hilang.
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmModal(false)}
                className="text-xs"
              >
                Batal / Simpan Dulu
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setShowConfirmModal(false)
                  performUpdate()
                }}
                className="text-xs gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tetap Perbarui
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

import React from "react"
import { Calendar, CheckCircle2, XCircle, Info } from "lucide-react"

interface DateFormatInfoAlertProps {
  className?: string
  compact?: boolean
}

export function DateFormatInfoAlert({ className = "", compact = false }: DateFormatInfoAlertProps) {
  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-left shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-amber-900">
              Ketentuan Wajib Format Tanggal
            </h4>
            <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              Penting
            </span>
          </div>
          
          <p className="text-xs leading-relaxed text-amber-800">
            Untuk mencegah pertukaran antara tanggal dan bulan, SIMMACI <strong>hanya menerima tanggal yang mencantumkan nama bulan</strong> (singkatan maupun lengkap bahasa Indonesia) dengan 4 digit tahun. Format numerik ambigu akan langsung ditolak.
          </p>

          {!compact && (
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Format Diterima (Contoh)
                </div>
                <ul className="space-y-0.5 text-[11px] text-emerald-700">
                  <li>• <code className="font-semibold">11 Nov 2022</code> atau <code className="font-semibold">11 November 2022</code></li>
                  <li>• <code className="font-semibold">11 Nopember 2022</code> (alias resmi didukung)</li>
                  <li>• <code className="font-semibold">05 Januari 2023</code> / <code className="font-semibold">21 Agu 2024</code></li>
                  <li>• Format Excel bertuliskan nama bulan (<code className="font-semibold">dd mmm yyyy</code>)</li>
                </ul>
              </div>

              <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-rose-800">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  Format Ditolak (Wajib Dihindari)
                </div>
                <ul className="space-y-0.5 text-[11px] text-rose-700">
                  <li>• Numerik slash: <code className="font-semibold">11/12/2022</code>, <code className="font-semibold">12/11/22</code></li>
                  <li>• Numerik dash: <code className="font-semibold">11-12-2022</code>, <code className="font-semibold">2022-12-11</code></li>
                  <li>• Numerik titik: <code className="font-semibold">11.12.2022</code></li>
                  <li>• Angka polos / serial tanpa tampilan nama bulan</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DateFormatInfoAlert

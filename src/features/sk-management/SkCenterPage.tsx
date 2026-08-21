import React from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Crown,
  Award,
  FileEdit,
  Archive,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckSquare
} from "lucide-react"
import { authApi } from "@/lib/api"

import SoftPageHeader from "@/components/ui/SoftPageHeader"

export default function SkCenterPage() {
  const navigate = useNavigate()
  const user = authApi.getStoredUser()
  const isAdmin = ["super_admin", "admin_yayasan", "admin"].includes(user?.role)

  return (
    <div className="space-y-6 pb-10">
      <SoftPageHeader
        title="Pusat Layanan SK"
        description="Pusat integrasi permohonan Surat Keputusan (SK) baru, pengajuan rekomendasi kepala, serta pengelolaan revisi data keputusan LP Ma'arif NU Cilacap."
        icon={<FileText className="w-6 h-6 text-emerald-600" />}
      />

      {/* SEKSI 1: Pengajuan SK Baru */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-black tracking-tight text-slate-800 uppercase flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Pengajuan SK & Rekomendasi Baru</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Pilih jenis dokumen SK yang ingin Anda ajukan ke LP Ma'arif NU Cilacap.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: SK Guru & Tendik */}
          <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 group rounded-3xl bg-white flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform duration-300" />
            <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between space-y-5">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100/80 border border-blue-200 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900 group-hover:text-blue-600 transition-colors">
                      SK Guru & Tendik
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                    Pengajuan SK Guru Tetap Yayasan (GTY), GTT, Tenaga Kependidikan, serta perpanjangan masa tugas.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/dashboard/sk-center/submission")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 font-bold text-xs flex items-center justify-between group-hover:px-5 transition-all shadow-md shadow-blue-200"
              >
                <span>Ajukan SK Guru / Tendik</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: SK Kepala Satpend */}
          <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 group rounded-3xl bg-white flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform duration-300" />
            <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between space-y-5">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100/80 border border-amber-200 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-amber-600 transition-colors">
                    SK Kepala Satpend
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                    Pengajuan SK Penetapan Kepala Madrasah / Sekolah baru atau perpanjangan masa jabatan resmi.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/dashboard/sdm/sk-kepala/new")}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-11 font-bold text-xs flex items-center justify-between group-hover:px-5 transition-all shadow-md shadow-amber-200"
              >
                <span>Ajukan SK Kepala</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Rekomendasi Kepala */}
          <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 group rounded-3xl bg-white flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform duration-300" />
            <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between space-y-5">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center">
                  <Award className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-600 transition-colors">
                    Rekomendasi Kepala
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                    Pengajuan Surat Rekomendasi Kepala Satuan Pendidikan LP Ma'arif NU Cilacap.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/dashboard/sdm/rekomendasi-kepala/pengajuan")}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold text-xs flex items-center justify-between group-hover:px-5 transition-all shadow-md shadow-emerald-200"
              >
                <span>Ajukan Rekomendasi</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SEKSI 2: Layanan Revisi & Arsip Dokumen */}
      <div className="space-y-4 pt-4">
        <div className="space-y-1">
          <h2 className="text-lg font-black tracking-tight text-slate-800 uppercase flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-purple-600" />
            <span>Revisi & Akses Arsip Dokumen</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Kelola permohonan koreksi data SK terbit serta akses berkas SK resmi satuan pendidikan Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Revisi Data SK */}
          <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 group rounded-3xl bg-white flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform duration-300" />
            <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between space-y-5">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-100/80 border border-purple-200 flex items-center justify-center">
                  <FileEdit className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-purple-600 transition-colors">
                    Revisi Data SK
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                    Permohonan perubahan atau koreksi data pada SK Guru/Tendik yang telah terbit resmi dari Pengurus Cabang.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/dashboard/sk-center/revisi")}
                variant="outline"
                className="w-full border-purple-200 text-purple-700 hover:bg-purple-50 rounded-xl h-11 font-bold text-xs flex items-center justify-between transition-all"
              >
                <span>Daftar & Ajukan Revisi Data</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Arsip SK Saya */}
          <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 group rounded-3xl bg-white flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform duration-300" />
            <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between space-y-5">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100/80 border border-indigo-200 flex items-center justify-center">
                  <Archive className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-indigo-600 transition-colors">
                    Arsip SK Saya
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                    Akses, unduh, dan cetak dokumen fisik e-SK resmi satuan pendidikan Anda yang telah disetujui.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/dashboard/sk-arsip")}
                variant="outline"
                className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl h-11 font-bold text-xs flex items-center justify-between transition-all"
              >
                <span>Buka Arsip SK Saya</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Option for Admin: Quick Link to Approval */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100 rounded-3xl p-6 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Akses Verifikasi & Approval Admin</h4>
              <p className="text-xs text-slate-500 font-medium">Buka antrean verifikasi permohonan SK Guru & Tendik dari madrasah.</p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/dashboard/sk")}
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 px-5 font-bold text-xs flex items-center gap-2 flex-shrink-0"
          >
            <CheckSquare className="w-4 h-4 text-blue-400" />
            <span>Buka Approval Admin</span>
          </Button>
        </div>
      )}
    </div>
  )
}

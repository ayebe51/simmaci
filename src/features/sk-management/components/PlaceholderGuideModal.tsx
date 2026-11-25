import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, Check, Search, BookOpen, AlertCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface PlaceholderItem {
  tag: string
  label: string
  description: string
  example: string
  skTypes: string[]
}

const PLACEHOLDERS: { category: string; icon: string; items: PlaceholderItem[] }[] = [
  {
    category: 'Header & Nomor SK',
    icon: '📄',
    items: [
      {
        tag: '{NOMOR}',
        label: 'Nomor Urut SK',
        description: 'Nomor urut penomoran SK (angka sequential)',
        example: '1702',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{nomor_sk}',
        label: 'Nomor Lengkap SK',
        description: 'Format nomor SK lengkap otomatis',
        example: '1702/PC.L/A.II/H-34.B/24.29/10/X/2025',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{TANGGAL}',
        label: 'Tanggal (Angka)',
        description: 'Hari tanggal penetapan (2 digit)',
        example: '20',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{BULAN}',
        label: 'Bulan (Angka)',
        description: 'Bulan penetapan (angka)',
        example: '10',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{BL_ROMA}',
        label: 'Bulan Romawi',
        description: 'Bulan penetapan dalam angka Romawi',
        example: 'X',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{TAHUN}',
        label: 'Tahun Penetapan',
        description: 'Tahun terbitnya SK',
        example: '2025',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{TAHUN PELAJARAN}',
        label: 'Tahun Pelajaran',
        description: 'Tahun ajaran masa tugas berlaku',
        example: '2025/2026',
        skTypes: ['GTY', 'GTT', 'Tendik', 'Perubahan Status'],
      },
      {
        tag: '{TANGGAL PENETAPAN}',
        label: 'Tanggal Penetapan Lengkap',
        description: 'Tanggal penetapan format bahasa Indonesia',
        example: '20 Oktober 2025',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{TANGGAL_BERAKHIR}',
        label: 'Tanggal Berakhir',
        description: 'Tanggal batas akhir masa berlaku SK',
        example: '01 Juli 2026',
        skTypes: ['GTT', 'Tendik', 'Perubahan Status'],
      },
    ],
  },
  {
    category: 'Status & Redaksi Dinamis',
    icon: '⚡',
    items: [
      {
        tag: '{JUDUL_PENGANGKATAN}',
        label: 'Judul Pengangkatan (Dinamis)',
        description: 'Otomatis: PENGANGKATAN GURU TETAP YAYASAN (TMT >= 2 th) atau PENGANGKATAN GURU TIDAK TETAP (TMT < 2 th)',
        example: 'PENGANGKATAN GURU TETAP YAYASAN',
        skTypes: ['Perubahan Status', 'GTY', 'GTT'],
      },
      {
        tag: '{JABATAN_UPPER}',
        label: 'Status Jabatan Huruf Kapital',
        description: 'GURU TETAP YAYASAN atau GURU TIDAK TETAP',
        example: 'GURU TETAP YAYASAN',
        skTypes: ['Perubahan Status', 'GTY', 'GTT'],
      },
      {
        tag: '{STATUS_GURU}',
        label: 'Status Jabatan Title Case',
        description: 'Guru Tetap Yayasan atau Guru Tidak Tetap',
        example: 'Guru Tetap Yayasan',
        skTypes: ['Perubahan Status', 'GTY', 'GTT'],
      },
      {
        tag: '{KATA_PENGANGKATAN}',
        label: 'Kata Pengangkatan',
        description: '"diangkat sebagai" (guru baru) atau "diangkat kembali sebagai" (perpanjangan)',
        example: 'diangkat kembali sebagai',
        skTypes: ['GTY', 'GTT', 'Tendik', 'Perubahan Status'],
      },
      {
        tag: '{PERIODE}',
        label: 'Periode Penugasan',
        description: 'Periode masa penugasan (angka)',
        example: '1, 2, atau 3',
        skTypes: ['GTY', 'GTT', 'Tendik'],
      },
    ],
  },
  {
    category: 'Data Personil (Guru / Tendik)',
    icon: '👤',
    items: [
      {
        tag: '{NAMA}',
        label: 'Nama Lengkap Personil',
        description: 'Nama personil huruf kapital beserta gelar (termasuk gelar baru)',
        example: 'ADINDA EGI DIAN RENJANI AULIA, S.Pd',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{TEMPAT/TANGGAL LAHIR}',
        label: 'Tempat & Tanggal Lahir',
        description: 'Format gabungan tempat lahir dan tanggal lahir',
        example: 'Kuningan, 02 September 1989',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{NOMOR INDUK MAARIF}',
        label: 'Nomor Induk Ma\'arif (NIM)',
        description: 'NIM resmi LP Ma\'arif (atau tag {NIM})',
        example: '113402867',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{PENDIDIKAN}',
        label: 'Pendidikan Terakhir',
        description: 'Jenjang pendidikan terakhir yang diakui sistem',
        example: 'S1',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{UNIT KERJA}',
        label: 'Unit Kerja / Sekolah',
        description: 'Nama madrasah/sekolah unit penugasan',
        example: 'MI Al Ma’arif 02 Rejamulya',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{KECAMATAN}',
        label: 'Kecamatan Unit Kerja',
        description: 'Kecamatan lokasi sekolah tempat bertugas',
        example: 'Kedungreja',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{TMT}',
        label: 'Terhitung Mulai Tanggal',
        description: 'Tanggal awal mulai bertugas (format tanggal Indo)',
        example: '1 Juli 2020',
        skTypes: ['Semua SK'],
      },
    ],
  },
  {
    category: 'Khusus SK Perubahan Status',
    icon: '🔄',
    items: [
      {
        tag: '{NOMOR_SK_LAMA}',
        label: 'Nomor SK Tendik Lama',
        description: 'Nomor dokumen SK Tendik sebelumnya yang dicabut dan dinyatakan tidak berlaku',
        example: '447/PC.L/A.II/H-34.B/24.29/5/7/2025',
        skTypes: ['Perubahan Status'],
      },
      {
        tag: '{GELAR_BARU}',
        label: 'Gelar Akademik Baru',
        description: 'Gelar sarjana baru yang ditambahkan',
        example: ', S.Pd.',
        skTypes: ['Perubahan Status'],
      },
      {
        tag: '{JUDUL_PENGANGKATAN}',
        label: 'Judul SK Sesuai Masa Kerja',
        description: 'Otomatis berganti antara Pengangkatan GTY atau GTT berdasarkan TMT',
        example: 'PENGANGKATAN GURU TETAP YAYASAN',
        skTypes: ['Perubahan Status'],
      },
    ],
  },
  {
    category: 'Khusus SK Pemberhentian',
    icon: '⛔',
    items: [
      {
        tag: '{ALASAN_PEMBERHENTIAN}',
        label: 'Alasan Pemberhentian',
        description: 'Alasan resmi pemutusan hubungan tugas/kerja',
        example: 'Mengundurkan Diri',
        skTypes: ['Pemberhentian'],
      },
      {
        tag: '{KETERANGAN_PEMBERHENTIAN}',
        label: 'Keterangan Tambahan',
        description: 'Penjelasan/catatan detail alasan pemberhentian',
        example: 'Atas permintaan sendiri secara tertulis',
        skTypes: ['Pemberhentian'],
      },
      {
        tag: '{TANGGAL_EFEKTIF}',
        label: 'Tanggal Efektif Berhenti',
        description: 'Tanggal mulai berlaku efektifnya pemberhentian',
        example: '15 November 2025',
        skTypes: ['Pemberhentian'],
      },
    ],
  },
  {
    category: 'Konsideran Permohonan & Rekomendasi',
    icon: '📩',
    items: [
      {
        tag: '{NOMOR SURAT PERMOHONAN}',
        label: 'Nomor Surat Permohonan',
        description: 'Nomor surat pengajuan permohonan SK dari madrasah',
        example: '027/MI.025/SP/V/2025',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{TANGGAL SURAT PERMOHONAN}',
        label: 'Tanggal Surat Permohonan',
        description: 'Tanggal surat permohonan dari madrasah',
        example: '26 April 2025',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{NOMOR SURAT REKOMENDASI}',
        label: 'Nomor Surat Rekomendasi',
        description: 'Nomor surat rekomendasi pengurus MWC (bila ada)',
        example: '014/MWC.LP/R-1/2025',
        skTypes: ['Kamad'],
      },
      {
        tag: '{TANGGAL SURAT REKOMENDASI}',
        label: 'Tanggal Surat Rekomendasi',
        description: 'Tanggal surat rekomendasi MWC (bila ada)',
        example: '02 Mei 2025',
        skTypes: ['Kamad'],
      },
      {
        tag: '{GOLONGAN}',
        label: 'Golongan ASN Kamad',
        description: 'Golongan ruang ASN (khusus Kepala Madrasah PNS)',
        example: 'IV/a',
        skTypes: ['Kamad PNS'],
      },
    ],
  },
  {
    category: 'QR Code & Loop Tembusan',
    icon: '🔲',
    items: [
      {
        tag: '{%qrcode}',
        label: 'Gambar QR Code Verifikasi',
        description: 'Wajib diawali simbol % agar docxtemplater mengenalinya sebagai gambar barcode',
        example: '[Gambar QR Code]',
        skTypes: ['Semua SK'],
      },
      {
        tag: '{#tembusan}{nomor}. {isi}{/tembusan}',
        label: 'Loop Tembusan Dinamis',
        description: 'Format loop daftar tembusan yang selalu mereset penomoran dari angka 1 di unduh gabung',
        example: '1. LP Ma\'arif NU PWNU Jawa Tengah ...',
        skTypes: ['Semua SK'],
      },
    ],
  },
]

export function PlaceholderGuideModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedTag, setCopiedTag] = useState<string | null>(null)

  const handleCopy = (tag: string) => {
    navigator.clipboard.writeText(tag)
    setCopiedTag(tag)
    toast.success(`Tag ${tag} berhasil disalin ke clipboard!`)
    setTimeout(() => {
      setCopiedTag(null)
    }, 2000)
  }

  const filteredCategories = PLACEHOLDERS.map((cat) => {
    const matchedItems = cat.items.filter(
      (item) =>
        item.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.skTypes.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    return { ...cat, items: matchedItems }
  }).filter((cat) => cat.items.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shrink-0">
          <div className="flex items-center gap-2 text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">
            <BookOpen className="h-4 w-4" />
            Panduan Dokumen Template Word (.docx)
          </div>
          <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
            Daftar Kode Placeholder SIMMACI
          </DialogTitle>
          <DialogDescription className="text-blue-100 text-xs">
            Gunakan kode di bawah ini pada file Word (.docx). Sistem akan menggantinya secara otomatis saat SK di-generate.
          </DialogDescription>
        </DialogHeader>

        {/* Tips & Search bar */}
        <div className="p-4 border-b bg-slate-50 space-y-3 shrink-0">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold">Tips Pengetikan Word:</span> Agar tag tidak terpotong struktur internal Word XML,
              ketik kode tag di Notepad terlebih dahulu, lalu <strong>Copy</strong> dan <strong>Paste as Plain Text</strong> ke Word.
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Cari nama variabel / tag / kegunaan (misal: NOMOR_SK_LAMA, TMT, NAMA)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-white rounded-xl border-slate-200 text-sm focus-visible:ring-blue-500"
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Search className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-sm font-semibold">Tidak ditemukan placeholder dengan kata kunci "{searchTerm}"</p>
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <div key={cat.category} className="space-y-3">
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-slate-600 border-b pb-1.5">
                  <span>{cat.icon}</span>
                  <span>{cat.category}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] font-bold">
                    {cat.items.length} tag
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cat.items.map((item) => {
                    const isCopied = copiedTag === item.tag
                    return (
                      <div
                        key={item.tag}
                        className="group relative p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <code className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 select-all">
                              {item.tag}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopy(item.tag)}
                              className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Salin ke clipboard"
                            >
                              {isCopied ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              <span className="ml-1 text-[11px]">{isCopied ? 'Tersalin' : 'Salin'}</span>
                            </Button>
                          </div>

                          <div className="font-semibold text-xs text-slate-800 mb-1">{item.label}</div>
                          <p className="text-[11px] text-slate-500 leading-normal mb-2">{item.description}</p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                          <span className="truncate max-w-[150px]">
                            Contoh: <strong className="text-slate-600">{item.example}</strong>
                          </span>
                          <div className="flex gap-1 shrink-0">
                            {item.skTypes.map((st) => (
                              <span
                                key={st}
                                className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium"
                              >
                                {st}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            Dokumen panduan lengkap tersimpan di file <strong>PANDUAN_PLACEHOLDER_TEMPLATE_SK.md</strong>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

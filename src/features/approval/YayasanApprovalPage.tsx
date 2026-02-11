import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BadgeCheck, CheckCircle, Download, FileText, XCircle, Upload } from "lucide-react"
import { useState } from "react"
import { api } from "@/lib/api"  // Keep for file upload only
import { toast } from "sonner"
import QRCode from "qrcode" // NEW: QR Code support
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SignaturePad } from "@/components/SignaturePad"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
// 🔥 CONVEX for real-time data
import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
import { Id } from "../../../convex/_generated/dataModel"

export default function YayasanApprovalPage() {
  // 🔥 REAL-TIME CONVEX QUERY - Auto-updates!
  const allRequests = useQuery(convexApi.headmasters.list, {
    status: undefined  // Get all statuses
  }) || []

  // 🔥 CONVEX MUTATIONS
  const approveMutation = useMutation(convexApi.headmasters.approve)
  const rejectMutation = useMutation(convexApi.headmasters.reject)

  // --- SIGNATURE STATE ---
  const [isSignModalOpen, setIsSignModalOpen] = useState(false)

  const [signTargetId, setSignTargetId] = useState<string | null>(null)
  
  // --- UPLOAD SK FINAL STATE ---
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)

  // --- REJECTION STATE ---
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const calculateTahunAjaran = (dateInput: Date | string = new Date()) => {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return "";
      const year = d.getFullYear();
      const month = d.getMonth(); // 0-11
      // July (6) starts new academic year
      if (month >= 6) {
          return `${year}/${year + 1}`;
      } else {
          return `${year - 1}/${year}`;
      }
  }

  // --- SK SETTINGS STATE ---
  const [nomorFormat, setNomorFormat] = useState("{NOMOR}/PC.L/A.II/H-34.B/{BULAN}/{TAHUN}")
  const [nomorStart, setNomorStart] = useState("") 
  const [tanggalPenetapan, setTanggalPenetapan] = useState("")
  const [nomorSuratMasuk, setNomorSuratMasuk] = useState("")
  const [tanggalSuratMasuk, setTanggalSuratMasuk] = useState("")
  const [tahunAjaran, setTahunAjaran] = useState(calculateTahunAjaran())
  const [defaultKecamatan, setDefaultKecamatan] = useState("")

  // Auto-calculate next number
  useEffect(() => {
    if (allRequests && allRequests.length > 0 && !nomorStart) {
        const approvedCount = allRequests.filter((r: any) => ['approved', 'active'].includes(r.status || "")).length;
        setNomorStart((approvedCount + 1).toString().padStart(4, '0'));
    }
  }, [allRequests, nomorStart]);

  // Auto-update tahunAjaran when tanggalPenetapan changes
  const currentTahunAjaran = tanggalPenetapan ? calculateTahunAjaran(tanggalPenetapan) : tahunAjaran
  // -------------------------

  const toRoman = (num: number): string => {
      const roman = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1}
      let str = '', i
      for ( i in roman ) {
          while ( num >= roman[i as keyof typeof roman] ) {
              str += i
              num -= roman[i as keyof typeof roman]
          }
      }
      return str
  }

  const parseDateSimple = (str: string) => {
      if(!str) return new Date()
      const d = new Date(str)
      if(!isNaN(d.getTime())) return d
      return new Date()
  }

  // Direct approve without signature (signature feature disabled temporarily)
  const handleDirectApprove = async (id: string) => {
      try {
          toast.info("Menyetujui dokumen...")
          const userObj = localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")!) : null;
          const userId = userObj?._id || userObj?.id || "temp_user"; 
          await approveMutation({ 
            id: id as Id<"headmasterTenures">,
            approvedBy: userId as Id<"users">
          })

          toast.success("SK Kepala Disetujui!")
          // No need to reload - Convex auto-updates!

      } catch (e) {
          console.error(e)
          toast.error("Gagal menyetujui: " + (e as Error).message)
      }
  }

  const handleUploadAndApprove = async (file: File) => {
      if (!uploadTargetId) return
      try {
          toast.info("Mengunggah SK Final...")
          const uploadRes = await api.uploadFile(file)
          const skUrl = (uploadRes as any).url || (uploadRes as any).filename

          toast.info("Menyimpan SK Final...")
          const userObj = localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")!) : null;
          const userId = userObj?._id || userObj?.id || "temp_user";
          await approveMutation({ 
            id: uploadTargetId as Id<"headmasterTenures">,
            approvedBy: userId as Id<"users">,
            skUrl: skUrl
          })

          toast.success("SK Final Berhasil Diupload & Disetujui!")
          setIsUploadModalOpen(false)
          setUploadTargetId(null)
          // No need to reload - Convex auto-updates!
      } catch (e) {
          toast.error("Gagal: " + (e as Error).message)
      }
  }

  // 🔥 No need for useEffect/loadData - Convex auto-updates!
  // Filter requests based on status if needed
  const requests = allRequests



  const openRejectModal = (id: string) => {
      setRejectTargetId(id)
      setRejectReason("")
      setIsRejectModalOpen(true)
  }

  const handleReject = async () => {
      if (!rejectTargetId || !rejectReason.trim()) {
          toast.error("Alasan penolakan harus diisi!")
          return;
      }
      try {
          toast.info("Memproses penolakan...");
          const userObj = localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")!) : null;
          const userId = userObj?._id || userObj?.id || "temp_user";
          await rejectMutation({ 
            id: rejectTargetId as Id<"headmasterTenures">,
            rejectedBy: userId as Id<"users">
          })
          toast.success("SK Kepala Ditolak.")
          setIsRejectModalOpen(false)
          setRejectTargetId(null)
          setRejectReason("")
          // No need to reload - Convex auto-updates!
      } catch (e: any) {
          console.error("Reject Error:", e);
          toast.error("Gagal menolak: " + (e?.message || "Unknown error"))
      }
  }

  // Pagination Logic
  const totalPages = Math.ceil(requests.length / itemsPerPage)
  const paginatedRequests = requests.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  )

  return (
    <div className="space-y-6">
       <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Ketua Yayasan</h1>
          <p className="text-muted-foreground">
            Validasi dan persetujuan pengangkatan Kepala Madrasah.
          </p>
        </div>

        {/* --- GLOBAL SETTINGS CARD --- */}
        <Card className="bg-slate-50/50 border-blue-100">
            <CardHeader className="pb-3 border-b bg-slate-50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                    <FileText className="h-4 w-4 text-blue-600"/> Pengaturan Surat Keputusan (Global Kamad)
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid sm:grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                    <Label className="text-xs font-semibold text-slate-600 uppercase">Format Nomor Surat (Otomatis)</Label>
                    <div className="flex gap-2">
                         <Input 
                            className="w-24 bg-white font-mono text-center"
                            value={nomorStart}
                            onChange={e => setNomorStart(e.target.value)}
                            placeholder="0001"
                        />
                        <Input 
                            value={nomorFormat}
                            onChange={e => setNomorFormat(e.target.value)}
                            placeholder="Format..."
                            className="flex-1 bg-white font-mono"
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Kode: {'{NOMOR}, {BULAN}, {TAHUN}, {BL_ROMA}'}</p>
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-xs font-semibold text-slate-600 uppercase">Tanggal Penetapan</Label>
                    <Input 
                        value={tanggalPenetapan}
                        onChange={e => setTanggalPenetapan(e.target.value)}
                        placeholder="Contoh: 01 Juli 2025"
                        className="bg-white"
                    />
                </div>
                 <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600 uppercase">No. Surat Permohonan</Label>
                    <Input 
                        value={nomorSuratMasuk}
                        onChange={e => setNomorSuratMasuk(e.target.value)}
                        placeholder="Contoh: 005/MWC/..."
                        className="bg-white"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600 uppercase">Tgl. Surat Permohonan</Label>
                    <Input 
                        value={tanggalSuratMasuk}
                        onChange={e => setTanggalSuratMasuk(e.target.value)}
                        placeholder="Contoh: 20 Juni 2025"
                        className="bg-white"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600 uppercase">Kecamatan (Default)</Label>
                    <Input 
                        value={defaultKecamatan}
                        onChange={e => setDefaultKecamatan(e.target.value)}
                        placeholder="Isi jika data sekolah kosong"
                        className="bg-white"
                    />
                </div>
                 <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600 uppercase">Tahun Ajaran</Label>
                    <Input 
                        value={tahunAjaran}
                        onChange={e => setTahunAjaran(e.target.value)}
                        placeholder="2024/2025"
                        className="bg-white"
                    />
                </div>
            </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pengajuan Masuk</CardTitle>
          <CardDescription>
             Menunggu persetujuan Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Calon</TableHead>
                  <TableHead>Madrasah Tujuan</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>TMT - Berakhir</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!allRequests ? (
                    <TableRow><TableCell colSpan={6} className="text-center h-24">Memuat...</TableCell></TableRow>
                ) : requests.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Tidak ada pengajuan pending.</TableCell></TableRow>
                ) : (
                  paginatedRequests.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                          {item.teacher?.nama}
                          <div className="text-xs text-muted-foreground">NIP: {item.teacher?.nip || '-'}</div>
                      </TableCell>
                      <TableCell>{item.school?.nama}</TableCell>
                      <TableCell>
                          <Badge variant="outline">Ke-{item.periode}</Badge>
                      </TableCell>
                      <TableCell>
                          {new Date(item.tmt).toLocaleDateString("id-ID")} s.d. <br/>
                          {new Date(item.endDate).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell>
                         <StatusBadge status={item.status} />

                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {/* Approve/Reject buttons for pending submissions */}
                        {['pending', 'submitted', 'verified', 'Submitted', 'Verified'].includes(item.status) && (
                            <>
                                 <Button size="sm" variant="destructive" onClick={() => openRejectModal(item.id)}>
                                     <XCircle className="w-4 h-4 mr-1" /> Tolak
                                 </Button>
                                {/* Direct approve button (signature disabled) */}
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleDirectApprove(item.id)}>
                                    <CheckCircle className="w-4 h-4 mr-1" /> Setujui
                                </Button>
                            </>
                        )}
                        {/* ACTION: UPLOAD SK FINAL (Manual) */}
                        {['pending', 'submitted', 'verified', 'approved', 'active', 'Submitted', 'Verified', 'Approved', 'Active'].includes(item.status) && (
                             <Button size="sm" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50" onClick={() => {
                                setUploadTargetId(item.id)
                                setIsUploadModalOpen(true)
                            }}>
                                <Upload className="w-4 h-4 mr-1" /> {item.skUrl ? "Update SK Final" : "Upload SK Final"}
                            </Button>
                        )}

                        {/* Show "Cetak SK" button for approved status */}
                        {['approved', 'Approved'].includes(item.status) && (
                             <div className="flex items-center justify-end space-x-2">
                                <BadgeCheck className="w-5 h-5 text-green-600"/> 
                                <span className="mr-2 hidden sm:inline">Disetujui</span>
                                 {item.teacher?.suratPermohonanUrl && (
                                     <Button size="sm" variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-50" onClick={() => window.open(item.teacher?.suratPermohonanUrl, '_blank')}>
                                         <FileText className="w-4 h-4 mr-1"/> Lihat Surat
                                     </Button>
                                 )}

                                 <Button size="sm" variant="outline" onClick={async () => {
                                    try {
                                        toast.info("Memproses SK...");
                                        
                                        // 1. Smart Selection
                                        let templateBlob: string | null = null;
                                        // Fix fallback type issue
                                        const teacher = item.teacher || { jabatan: "", nip: "", statusKepegawaian: "" } as any;
                                        const jabatan = (teacher.jabatan || "Kepala Madrasah").toLowerCase();
                                        const nip = (teacher.nip || "").replace(/[^0-9]/g, "");
                                        const isPlt = jabatan.includes("plt") || jabatan.includes("pelaksana");
                                        const isPns = nip.length > 10 || (teacher.statusKepegawaian || "").includes("PNS");

                                        if (isPlt) {
                                            templateBlob = localStorage.getItem("sk_template_kamad_plt_blob") || localStorage.getItem("sk_template_kamad_blob");
                                        } else if (isPns) {
                                            templateBlob = localStorage.getItem("sk_template_kamad_pns_blob") || localStorage.getItem("sk_template_kamad_blob");
                                        } else {
                                            templateBlob = localStorage.getItem("sk_template_kamad_nonpns_blob") || localStorage.getItem("sk_template_kamad_blob");
                                        }
                                        
                                        if (templateBlob) {
                                            const { generateSkDocx } = await import("@/lib/sk-generator");
                                            const { saveAs } = await import("file-saver");
                                            const savedSettings = localStorage.getItem("app_settings");
                                            const settings = savedSettings ? JSON.parse(savedSettings) : {};
                                            
                                            // --- ROBUST DATA MAPPING ---
                                            // --- QR CODE GENERATION ---
                                            let qrDataUrl = "";
                                            try {
                                                const verificationUrl = `${window.location.origin}/verify/${item.id}`;
                                                qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 400, margin: 1 });
                                            } catch (err) {
                                                console.error("QR Fail", err);
                                            }

                                            const dateObj = parseDateSimple(tanggalPenetapan)
                                            const dd = String(dateObj.getDate()).padStart(2, '0')
                                            const mmAngka = String(dateObj.getMonth() + 1)
                                            const mmRoma = toRoman(dateObj.getMonth() + 1)
                                            const yyyy = dateObj.getFullYear()
                                            
                                            // Use Global State for SK Numbering components
                                            // Fallback: If DB doesn't have nomorSk, use the global input 'nomorStart'
                                            const rawNomor = nomorStart; 

                                            const generatedNomor = nomorFormat
                                              .replace(/{NOMOR}/g, rawNomor) 
                                              .replace(/{TANGGAL}/g, dd)
                                              .replace(/{BULAN}/g, mmAngka)
                                              .replace(/{BL_ROMA}/g, mmRoma)
                                              .replace(/{TAHUN}/g, String(yyyy))

                                            const finalTmt = new Date(item.endDate).getFullYear() > 1970 
                                                ? new Date(item.tmt).toLocaleDateString("id-ID", {day: 'numeric', month: 'long', year: 'numeric'})
                                                : "-";
                                            
                                            // Handle invalid dates gracefully
                                            let finalValid = "-";
                                            try {
                                                finalValid = new Date(item.endDate).toLocaleDateString("id-ID", {day: 'numeric', month: 'long', year: 'numeric'})
                                            } catch(e) {}
                                            
                                            const finalPenetapan = tanggalPenetapan || new Date().toLocaleDateString("id-ID", {day: 'numeric', month: 'long', year: 'numeric'})

                                            // Construct Data Object
                                            const data = {
                                                // --- QR CODE ---
                                                qrcode: qrDataUrl, 
                                                
                                                // --- STANDARD FIELDS ---
                                                NAMA: item.teacher?.nama || "",
                                                NIP: item.teacher?.nip || "-",
                                                NUPTK: item.teacher?.nuptk || "-",
                                                JABATAN: "Kepala Madrasah",
                                                STATUS: "Tetap",
                                                PENDIDIKAN: item.teacher?.pendidikanTerakhir || "-", 
                                                ALAMAT: item.teacher?.address || "-",
                                                KABUPATEN: "Cilacap",
                                                TENTANG: "PENGANGKATAN KEPALA MADRASAH",
                                                TAHUN_AJARAN: tahunAjaran,
                                                KETUA_NAMA: settings.signerKetuaName || ".....",
                                                SEKRETARIS_NAMA: settings.signerSekretarisName || ".....",
                                                MASA_BHAKTI: `${new Date(item.tmt).getFullYear()} - ${new Date(item.endDate).getFullYear()}`,
                                                TANGGAL_BERAKHIR: finalValid,
                                                
                                                // --- DATES ---
                                                TMT: finalTmt,
                                                "Tanggal Penetapan": finalPenetapan,
                                                "TANGGAL PENETAPAN": finalPenetapan,
                                                
                                                // --- NUMBERS & MONTHS ---
                                                NOMOR: rawNomor, 
                                                "NOMOR SURAT": generatedNomor,
                                                "NOMOR_SK": generatedNomor,
                                                BULAN: String(new Date(finalPenetapan).getMonth() + 1), 
                                                TAHUN: String(yyyy),
                                                "BULAN_ROMA": mmRoma, 

                                                // --- SURAT PERMOHONAN (From Inputs) ---
                                                "NOMOR SURAT PERMOHONAN": nomorSuratMasuk || "-",
                                                "TANGGAL SURAT PERMOHONAN": tanggalSuratMasuk || "-",

                                                // --- LOCATION / SCHOOL ---
                                                UNIT_KERJA: item.school?.nama || "",
                                                "Unit Kerja": item.school?.nama || "",
                                                "UNIT KERJA": item.school?.nama || "", 
                                                MADRASAH: item.school?.nama || "",
                                                LEMBAGA: item.school?.nama || "",
                                                
                                                KECAMATAN: item.school?.district || defaultKecamatan || ".....",
                                                "Kecamatan": item.school?.district || defaultKecamatan || ".....",

                                                // --- PERSONAL IDENTITY / TTL ---
                                                TTL: (item.teacher?.birthPlace && item.teacher?.birthDate) 
                                                    ? `${item.teacher.birthPlace}, ${new Date(item.teacher.birthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
                                                    : "-",
                                                "TEMPAT_TANGGAL_LAHIR": (item.teacher?.birthPlace && item.teacher?.birthDate) 
                                                    ? `${item.teacher.birthPlace}, ${new Date(item.teacher.birthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
                                                    : "-",
                                                "TEMPAT, TANGGAL LAHIR": (item.teacher?.birthPlace && item.teacher?.birthDate) 
                                                    ? `${item.teacher.birthPlace}, ${new Date(item.teacher.birthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` 
                                                    : "-",
                                                "Tempat Tanggal Lahir": (item.teacher?.birthPlace && item.teacher?.birthDate) 
                                                    ? `${item.teacher.birthPlace}, ${new Date(item.teacher.birthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
                                                    : "-",
                                                "Tempat/Tanggal Lahir": (item.teacher?.birthPlace && item.teacher?.birthDate) 
                                                    ? `${item.teacher.birthPlace}, ${new Date(item.teacher.birthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
                                                    : "-",
                                                
                                                // --- MA'ARIF ID ---
                                                "NOMOR INDUK MA'ARIF": item.teacher?.nuptk || "-", 
                                                "NOMOR INDUK MA’ARIF": item.teacher?.nuptk || "-", 
                                                "NOMOR INDUK MAARIF": item.teacher?.nuptk || "-",  
                                                "Nomor Induk Maarif": item.teacher?.nuptk || "-",

                                                // --- ALIASES ---
                                                nama: item.teacher?.nama,
                                                nip: item.teacher?.nip || "-",
                                                nuptk: item.teacher?.nuptk || "-",
                                                jabatan: "Kepala Madrasah",
                                                unit_kerja: item.school?.nama,
                                                madrasah: item.school?.nama,
                                                lembaga: item.school?.nama,
                                                tmt: finalTmt,
                                                ttl: (item.teacher?.birthPlace && item.teacher?.birthDate) 
                                                    ? `${item.teacher.birthPlace}, ${new Date(item.teacher.birthDate).toLocaleDateString('id-ID')}`
                                                    : "-",
                                                alamat: item.teacher?.address || "-",
                                                
                                                "Nama": item.teacher?.nama,
                                                "Jabatan": "Kepala Madrasah",
                                                "Madrasah": item.school?.nama,
                                                
                                                "Nomor Surat Permohonan": nomorSuratMasuk || "-",
                                                "Tanggal Surat Permohonan": tanggalSuratMasuk || "-",
                                                "Tahun Ajaran": tahunAjaran
                                            };

                                            console.log("DEBUG SK ITEM:", item);
                                            console.log("DEBUG SK DATA:", data);
                                            
                                            const blob = await generateSkDocx(templateBlob, data); // Await async wrapper if needed, but generateSkDocx is sync in basic version? 
                                            // Actually generateSkDocx usually async if it handles images/QR. 
                                            // IMPORTANT: We need to make sure generateSkDocx handles QR!
                                            // The simple one imported from @/lib/sk-generator might NOT handle images.
                                            // I must replicate the image module logic HERE or update the lib.
                                            // For safety, I will implement a local 'generateSkWithQr' logic here or assume 'generateSkDocx' needs update.
                                            // Let's assume for now I need to INLINE the generation logic similar to SkGeneratorPage because passing 'qrcode' string to standard templater won't work without ImageModule.
                                            
                                            // INLINE REPLACEMENT FOR GENERATION TO SUPPORT IMAGE MODULE
                                            const { default: PizZip } = await import("pizzip");
                                            const { default: Docxtemplater } = await import("docxtemplater");
                                            const { default: ImageModule } = await import("docxtemplater-image-module-free");

                                            const zip = new PizZip(templateBlob);
                                            
                                            const imageOpts = {
                                                getImage: function (tagValue: string) {
                                                    const base64Regex = /^data:image\/(png|jpg|svg|svg\+xml);base64,/;
                                                    if (!base64Regex.test(tagValue)) return false;
                                                    const stringBase64 = tagValue.replace(base64Regex, "");
                                                    let binaryString;
                                                    if (typeof window !== "undefined") binaryString = window.atob(stringBase64);
                                                    else binaryString = new Buffer(stringBase64, "base64").toString("binary");
                                                    const len = binaryString.length;
                                                    const bytes = new Uint8Array(len);
                                                    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
                                                    return bytes.buffer;
                                                },
                                                getSize: function (img: any, tagValue: string, tagName: string) {
                                                    if (tagName === "qrcode") return [100, 100];
                                                    return [100, 100];
                                                },
                                            };

                                            const doc = new Docxtemplater(zip, {
                                                modules: [new ImageModule(imageOpts)],
                                                paragraphLoop: true,
                                                linebreaks: true,
                                                nullGetter: () => ""
                                            });

                                            doc.render(data);

                                            const out = doc.getZip().generate({
                                                type: "blob",
                                                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                            });
                                            saveAs(out, `SK_Kepala_${item.teacher?.nama || 'Madrasah'}.docx`);
                                            toast.success("SK Berhasil diunduh");

                                        } else {
                                            // Fallback
                                            const blob = await api.downloadSkHeadmaster(item.id);
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `SK_Kepala_${item.teacher?.nama || 'Madrasah'}.pdf`;
                                            a.click();
                                            window.URL.revokeObjectURL(url);
                                            toast.success("SK PDF Berhasil diunduh");
                                        }

                                    } catch(e) {
                                        console.error(e);
                                        toast.error("Gagal: " + (e as Error).message);
                                    }
                                }}>
                                    <Download className="w-4 h-4 mr-1" /> Cetak SK
                                </Button>
                            </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {allRequests && requests.length > itemsPerPage && (
            <div className="flex items-center justify-end space-x-2 py-4 px-2">
              <div className="flex-1 text-sm text-muted-foreground">
                Halaman {currentPage} dari {totalPages} ({requests.length} data)
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signature modal removed - feature disabled */}
      
      {/* Upload Final SK Dialog */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload SK Final (Manual)</DialogTitle>
            <DialogDescription>
              Upload file SK yang sudah ditandatangani (PDF). Status akan berubah menjadi Approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
              <div className="grid gap-2">
                 <Label>File SK Final (PDF)</Label>
                 <Input 
                    type="file" 
                    accept=".pdf"
                    onChange={(e) => {
                        if(e.target.files?.[0]) handleUploadAndApprove(e.target.files[0])
                    }} 
                 />
              </div>
          </div>
         </DialogContent>
       </Dialog>
      
       {/* Rejection Modal */}
       <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle className="text-red-600">Tolak SK Pengangkatan</DialogTitle>
             <DialogDescription>
               Masukkan alasan penolakan SK. Alasan ini akan dikirimkan ke pengaju.
             </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
               <div className="grid gap-2">
                  <Label htmlFor="rejectReason">Alasan Penolakan *</Label>
                  <textarea 
                     id="rejectReason"
                     className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                     placeholder="Contoh: Data calon tidak lengkap, dokumen pendukung kurang, dll..."
                     value={rejectReason}
                     onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                     Minimal 10 karakter
                  </p>
               </div>
               <div className="flex gap-2 justify-end">
                   <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>
                       Batal
                   </Button>
                   <Button 
                       variant="destructive" 
                       onClick={handleReject}
                       disabled={!rejectReason.trim() || rejectReason.trim().length < 10}
                   >
                       <XCircle className="w-4 h-4 mr-1" /> Konfirmasi Penolakan
                   </Button>
               </div>
           </div>
         </DialogContent>
       </Dialog>
     </div>
   )
 }
 
 function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        'Draft': 'bg-gray-100 text-gray-800',
        'Submitted': 'bg-blue-100 text-blue-800',
        'Verified': 'bg-purple-100 text-purple-800',
        'Approved': 'bg-green-100 text-green-800',
        'Rejected': 'bg-red-100 text-red-800',
        'Active': 'bg-emerald-100 text-emerald-800',
        'Expired': 'bg-orange-100 text-orange-800',
    }
    return (
        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border", map[status] || map['Draft'])}>
            {status}
        </span>
    )
}

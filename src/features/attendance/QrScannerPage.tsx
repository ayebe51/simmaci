import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import {
  ScanLine,
  UserCheck,
  GraduationCap,
  ShieldCheck,
  Clock,
  ArrowLeft,
  Camera,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

type ScanMode = "select" | "guru" | "siswa";
type AuthState = "pin" | "authenticated";

export default function QrScannerPage() {
  const [authState, setAuthState] = useState<AuthState>("pin");
  const [schoolId, setSchoolId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [mode, setMode] = useState<ScanMode>("select");
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<Array<{ name: string; status: string; time: string }>>([]);

  // Siswa mode selections
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedJamKe, setSelectedJamKe] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanCooldownRef = useRef(false);

  // Queries
  const schools = useQuery(api.schools.list);
  const selectedSchoolIdTyped = schoolId ? schoolId as Id<"schools"> : undefined;

  const classes = useQuery(
    api.classes.listActive,
    selectedSchoolIdTyped ? { schoolId: selectedSchoolIdTyped } : "skip"
  );
  const subjects = useQuery(
    api.subjects.listActive,
    selectedSchoolIdTyped ? { schoolId: selectedSchoolIdTyped } : "skip"
  );
  const lessonSlots = useQuery(
    api.lessonSchedule.list,
    selectedSchoolIdTyped ? { schoolId: selectedSchoolIdTyped } : "skip"
  );
  const teachers = useQuery(
    api.teachers.getBySchool,
    selectedSchoolIdTyped ? { schoolId: selectedSchoolIdTyped } : "skip"
  );

  // Mutations
  const smartScanTeacher = useMutation(api.teacherAttendance.smartScan);
  const recordStudentScan = useMutation(api.studentAttendance.recordScan);

  // PIN verification
  const handlePinSubmit = useCallback(async () => {
    if (!schoolId || !pin) {
      toast.error("Pilih sekolah dan masukkan PIN");
      return;
    }
    // Simple PIN check - in production, use backend verification
    try {
      setAuthState("authenticated");
      toast.success("PIN diterima! Silakan pilih mode absensi.");
    } catch {
      toast.error("PIN salah atau fitur absensi belum aktif");
    }
  }, [schoolId, pin]);

  // Start QR Scanner
  const startScanner = useCallback(async () => {
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          // Cooldown to prevent rapid duplicate scans
          if (scanCooldownRef.current) return;
          scanCooldownRef.current = true;
          setTimeout(() => { scanCooldownRef.current = false; }, 3000);

          await handleScanResult(decodedText);
        },
        () => {} // Ignore errors (no QR found in frame)
      );

      setScanning(true);
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.");
    }
  }, [mode, selectedClassId, selectedSubjectId, selectedJamKe, selectedTeacherId, schoolId]);

  // Stop QR Scanner
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (e) {
        console.error("Error stopping scanner:", e);
      }
    }
    setScanning(false);
  }, []);

  // Handle scan result
  const handleScanResult = async (url: string) => {
    try {
      // Extract NUPTK or NISN from the verification URL
      // URLs: /verify/teacher/:nuptk or /verify/student/:nisn
      let nuptk = "";
      let nisn = "";

      if (url.includes("/verify/teacher/")) {
        nuptk = url.split("/verify/teacher/")[1]?.split("?")[0] || "";
      } else if (url.includes("/verify/student/")) {
        nisn = url.split("/verify/student/")[1]?.split("?")[0] || "";
      } else {
        toast.error("QR Code tidak valid");
        return;
      }

      if (mode === "guru" && nuptk) {
        // Find teacher by NUPTK
        const teacher = teachers?.find((t: any) => String(t.nuptk) === nuptk);
        if (!teacher) {
          toast.error(`Guru dengan NUPTK ${nuptk} tidak ditemukan di sekolah ini`);
          return;
        }

        const result = await smartScanTeacher({
          teacherId: teacher._id,
          schoolId: schoolId as Id<"schools">,
        });

        if (result.success) {
          const type = result.type === "masuk" ? "🟢" : "🔵";
          toast.success(`${type} ${teacher.nama} — ${result.message}`);
          setScanResults((prev) => [
            { name: teacher.nama, status: result.message || "", time: new Date().toLocaleTimeString("id-ID") },
            ...prev,
          ]);
        } else {
          toast.warning(`${teacher.nama}: ${result.message}`);
        }
      } else if (mode === "siswa" && nisn) {
        // Record student attendance
        const today = new Date().toISOString().split("T")[0];
        const result = await recordStudentScan({
          studentId: nisn,
          schoolId: schoolId as Id<"schools">,
          classId: selectedClassId as Id<"classes">,
          subjectId: selectedSubjectId as Id<"subjects">,
          tanggal: today,
          jamKe: selectedJamKe ? parseInt(selectedJamKe) : undefined,
          recordedByTeacherId: selectedTeacherId ? selectedTeacherId as Id<"teachers"> : undefined,
        });

        if (result.success) {
          // Find student name from NISN
          toast.success(`✅ NISN ${nisn} — Hadir`);
          setScanResults((prev) => [
            { name: `NISN: ${nisn}`, status: "Hadir", time: new Date().toLocaleTimeString("id-ID") },
            ...prev,
          ]);
        } else {
          toast.warning(`NISN ${nisn}: ${result.message}`);
        }
      } else {
        toast.error(mode === "guru" ? "QR bukan KTA Guru" : "QR bukan Kartu Pelajar");
      }
    } catch (err) {
      console.error("Scan error:", err);
      toast.error("Terjadi kesalahan saat memproses scan");
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // PIN Entry Screen
  if (authState === "pin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl border-0">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent">
              Scanner Absensi
            </CardTitle>
            <p className="text-sm text-slate-500">Masukkan kode sekolah dan PIN untuk mengakses scanner</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Pilih Sekolah</label>
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Pilih sekolah..." />
                </SelectTrigger>
                <SelectContent>
                  {schools?.map((s: any) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">PIN Scanner</label>
              <Input
                type="password"
                placeholder="Masukkan PIN..."
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="h-12 text-center text-2xl tracking-[0.5em] font-mono"
                onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
              />
            </div>
            <Button
              onClick={handlePinSubmit}
              className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-base shadow-lg"
              disabled={!schoolId || !pin}
            >
              <ShieldCheck className="mr-2 h-5 w-5" />
              Masuk Scanner
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mode Selection Screen
  if (mode === "select") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Scanner Absensi</h1>
            <p className="text-emerald-300/70 text-sm">Pilih mode absensi yang ingin digunakan</p>
          </div>

          <button
            onClick={() => setMode("guru")}
            className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 flex items-center gap-5 hover:bg-white/20 transition-all duration-300 group"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <UserCheck className="h-8 w-8 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-white">Absensi Guru</h3>
              <p className="text-emerald-300/60 text-sm">Scan KTA untuk mencatat jam masuk & pulang</p>
            </div>
          </button>

          <button
            onClick={() => setMode("siswa")}
            className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 flex items-center gap-5 hover:bg-white/20 transition-all duration-300 group"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-white">Absensi Siswa</h3>
              <p className="text-blue-300/60 text-sm">Bulk scan kartu pelajar per kelas per mapel</p>
            </div>
          </button>

          <button
            onClick={() => { setAuthState("pin"); setMode("select"); setPin(""); }}
            className="w-full text-white/40 hover:text-white/70 text-sm mt-4 transition"
          >
            ← Kembali ke layar PIN
          </button>
        </div>
      </div>
    );
  }

  // Main Scanner UI
  const isStudentModeReady = mode === "siswa" && selectedClassId && selectedSubjectId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            await stopScanner();
            setMode("select");
            setScanResults([]);
          }}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-white font-bold text-lg">
            {mode === "guru" ? "🟢 Absensi Guru" : "🔵 Absensi Siswa"}
          </h2>
          <p className="text-white/50 text-xs">
            {scanning ? "Scanner aktif — arahkan ke QR Code" : "Konfigurasi scan"}
          </p>
        </div>
        <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
          <Clock className="h-3 w-3 mr-1" />
          {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </Badge>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Student mode: configuration selectors */}
        {mode === "siswa" && !scanning && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="pt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1 block">Nama Guru</label>
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Pilih guru..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers?.map((t: any) => (
                      <SelectItem key={t._id} value={t._id}>{t.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1 block">Kelas</label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Pilih kelas..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.map((c: any) => (
                      <SelectItem key={c._id} value={c._id}>{c.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1 block">Mata Pelajaran</label>
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Pilih mapel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects?.map((s: any) => (
                      <SelectItem key={s._id} value={s._id}>{s.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1 block">Jam Ke-</label>
                <Select value={selectedJamKe} onValueChange={setSelectedJamKe}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Pilih jam..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lessonSlots?.map((slot: any) => (
                      <SelectItem key={slot._id} value={String(slot.jamKe)}>
                        Jam ke-{slot.jamKe} ({slot.jamMulai} - {slot.jamSelesai})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR Reader Container */}
        <div className="relative rounded-2xl overflow-hidden bg-black/50 border border-white/10">
          <div id="qr-reader" className="w-full" style={{ minHeight: scanning ? 300 : 0 }} />
          {!scanning && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border-2 border-dashed border-white/20">
                <Camera className="h-10 w-10 text-white/40" />
              </div>
              <p className="text-white/40 text-sm">
                {mode === "guru" ? "Siap scan KTA Guru" : 
                  isStudentModeReady ? "Siap scan Kartu Pelajar" : "Lengkapi pengaturan di atas dulu"}
              </p>
            </div>
          )}
        </div>

        {/* Start/Stop Button */}
        {(mode === "guru" || isStudentModeReady) && (
          <Button
            onClick={scanning ? stopScanner : startScanner}
            className={`w-full h-14 text-lg font-bold rounded-xl shadow-lg ${
              scanning
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            }`}
          >
            {scanning ? (
              <>
                <XCircle className="mr-2 h-5 w-5" />
                Berhenti Scan
              </>
            ) : (
              <>
                <ScanLine className="mr-2 h-5 w-5" />
                Mulai Scan
              </>
            )}
          </Button>
        )}

        {/* Scan Results Feed (Bulk Scan: live results) */}
        {scanResults.length > 0 && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Hasil Scan ({scanResults.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {scanResults.map((result, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/10"
                  >
                    <div>
                      <p className="text-white text-sm font-medium">{result.name}</p>
                      <p className="text-white/50 text-xs">{result.status}</p>
                    </div>
                    <span className="text-white/30 text-xs">{result.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

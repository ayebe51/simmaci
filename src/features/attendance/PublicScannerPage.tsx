import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";
import {
  ShieldCheck, UserCheck, GraduationCap, ScanLine, Save,
  ChevronLeft, ChevronRight, Camera, CheckCircle2, XCircle,
  Clock, ArrowLeft, Loader2, LogOut, Download, ExternalLink,
  BookOpen, School, ClipboardList, BarChart2, Settings,
  CalendarDays, Users, AlertTriangle, ScanFace, QrCode
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { publicAttendanceApi, staffAttendanceApi, API_URL } from "@/lib/api";
import axios from "axios";
import * as faceapi from 'face-api.js';

// ── Public Meeting Scanner API ─────────────────────────────────────────────

const publicMeetingApi = {
  verifyPin: async (pin: string) => {
    const res = await axios.post(`${API_URL}/public/meetings/verify-pin`, { pin });
    return res.data;
  },
  activeList: async (pin: string) => {
    const res = await axios.get(`${API_URL}/public/meetings/active`, { params: { pin } });
    return res.data?.data ?? res.data;
  },
  scan: async (pin: string, qrUrl: string) => {
    const res = await axios.post(`${API_URL}/public/meetings/scan`, { pin, qr_url: qrUrl });
    return res.data;
  },
};

// ── PWA Install Hook ───────────────────────────────────────────────────────

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      setPrompt(null);
      setIsInstalled(true);
    }
  };

  return { canInstall: !!prompt && !isInstalled, isInstalled, install };
}

// ── Types ──────────────────────────────────────────────────────────────────

type Screen = "login" | "mode" | "manual" | "scanner-teacher" | "scanner-student" | "meeting-scanner" | "staff-scanner";
type LoginMode = "operator" | "yayasan" | "staff";

interface Session {
  schoolId: number;
  schoolName: string;
  pin: string;
  loginMode: LoginMode;
}

const STATUS_COLORS: Record<string, string> = {
  Hadir: "bg-emerald-500 text-white border-emerald-500",
  Sakit: "bg-yellow-400 text-white border-yellow-400",
  Izin:  "bg-blue-500 text-white border-blue-500",
  Alpa:  "bg-red-500 text-white border-red-500",
};

const STATUS_OUTLINE: Record<string, string> = {
  Hadir: "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
  Sakit: "border-yellow-300 text-yellow-700 hover:bg-yellow-50",
  Izin:  "border-blue-300 text-blue-700 hover:bg-blue-50",
  Alpa:  "border-red-300 text-red-700 hover:bg-red-50",
};

// ── Login Screen ───────────────────────────────────────────────────────────

function LoginScreen({ onSuccess }: { onSuccess: (session: Session) => void }) {
  const [loginMode, setLoginMode] = useState<LoginMode>("operator");
  const [schoolId, setSchoolId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const { canInstall, isInstalled, install } = useInstallPrompt();

  const { data: schools = [], isLoading: loadingSchools } = useQuery({
    queryKey: ["public-schools"],
    queryFn: publicAttendanceApi.schools,
  });

  const handleSubmit = async () => {
    if (loginMode === "operator") {
      if (!schoolId || !pin) { toast.error("Pilih sekolah dan masukkan PIN"); return; }
      setLoading(true);
      try {
        const res = await publicAttendanceApi.verifyPin(Number(schoolId), pin);
        if (res.success) {
          toast.success(`Selamat datang di ${res.school_name}`);
          onSuccess({ schoolId: Number(schoolId), schoolName: res.school_name, pin, loginMode: "operator" });
        } else {
          toast.error(res.message || "PIN salah");
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Gagal verifikasi PIN");
      } finally {
        setLoading(false);
      }
    } else if (loginMode === "yayasan") {
      // Yayasan mode — verify meeting scanner PIN
      if (!pin) { toast.error("Masukkan PIN Panitia Rapat"); return; }
      setLoading(true);
      try {
        const res = await publicMeetingApi.verifyPin(pin);
        if (res.success) {
          toast.success("Selamat datang, Panitia Rapat");
          onSuccess({ schoolId: 0, schoolName: "LP Ma'arif NU Cilacap", pin, loginMode: "yayasan" });
        } else {
          toast.error(res.message || "PIN salah");
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || "PIN salah atau belum dikonfigurasi");
      } finally {
        setLoading(false);
      }
    } else if (loginMode === "staff") {
      onSuccess({ schoolId: 0, schoolName: "Staff LP Ma'arif NU Cilacap", pin: "", loginMode: "staff" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-3">
        {/* Install Banner */}
        {canInstall && (
          <button onClick={install}
            className="w-full bg-emerald-600/20 border border-emerald-500/30 rounded-2xl px-4 py-3 flex items-center gap-3 text-left hover:bg-emerald-600/30 transition">
            <Download className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-emerald-300 text-sm font-bold">Install sebagai App</p>
              <p className="text-emerald-500 text-xs">Tambahkan ke layar utama HP Anda</p>
            </div>
          </button>
        )}
        {isInstalled && (
          <div className="w-full bg-emerald-600/10 border border-emerald-500/20 rounded-2xl px-4 py-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-emerald-400 text-xs font-medium">App sudah terinstall ✓</p>
          </div>
        )}

        <Card className="bg-white border-0 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="text-center space-y-3 pb-2 pt-8">
            <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-emerald-600" />
            </div>
            <CardTitle className="text-xl font-black text-slate-800">Scanner SIMMACI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {/* Mode toggle */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => { setLoginMode("operator"); setPin(""); }}
                className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${loginMode === "operator" ? "bg-white shadow text-emerald-700" : "text-slate-500"}`}
              >
                <School className="h-3.5 w-3.5 inline mr-1" />
                Operator
              </button>
              <button
                onClick={() => { setLoginMode("yayasan"); setPin(""); setSchoolId(""); }}
                className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${loginMode === "yayasan" ? "bg-white shadow text-purple-700" : "text-slate-500"}`}
              >
                <CalendarDays className="h-3.5 w-3.5 inline mr-1" />
                Panitia
              </button>
              <button
                onClick={() => { setLoginMode("staff"); setPin(""); setSchoolId(""); }}
                className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${loginMode === "staff" ? "bg-white shadow text-blue-700" : "text-slate-500"}`}
              >
                <Users className="h-3.5 w-3.5 inline mr-1" />
                Staff
              </button>
            </div>

            {loginMode === "operator" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unit Sekolah</label>
                <Select value={schoolId} onValueChange={setSchoolId} disabled={loadingSchools}>
                  <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-0">
                    <SelectValue placeholder={loadingSchools ? "Memuat..." : "Pilih sekolah..."} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-60">
                    {schools.map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        <span className="font-medium">{s.nama}</span>
                        {s.jenjang && <span className="text-slate-400 text-xs ml-1">({s.jenjang})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {loginMode === "yayasan" && (
              <div className="p-3 bg-purple-50 rounded-xl text-xs text-purple-700">
                <CalendarDays className="h-3.5 w-3.5 inline mr-1" />
                Mode Panitia Rapat — untuk scan QR peserta rapat yayasan
              </div>
            )}

            {loginMode === "staff" && (
              <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
                <Users className="h-3.5 w-3.5 inline mr-1" />
                Mode Absensi Staff — scan QR Code di ID Card tanpa login
              </div>
            )}

            {loginMode !== "staff" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {loginMode === "operator" ? "PIN Scanner" : "PIN Panitia Rapat"}
                </label>
                <Input
                  type="password"
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="h-12 text-center text-2xl tracking-[0.5em] font-mono rounded-xl bg-slate-50 border-0"
                  maxLength={8}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={(loginMode === "operator" ? (!schoolId || !pin) : loginMode === "yayasan" ? !pin : false) || loading}
              className={`w-full h-12 font-bold rounded-xl mt-2 ${
                loginMode === "yayasan" ? "bg-purple-600 hover:bg-purple-700" : 
                loginMode === "staff" ? "bg-blue-600 hover:bg-blue-700" :
                "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : loginMode === "staff" ? "Buka Scanner →" : "Masuk →"}
            </Button>
          </CardContent>
        </Card>

        {!canInstall && !isInstalled && (
          <p className="text-center text-slate-600 text-xs px-4">
            Di iPhone: tap <strong className="text-slate-400">Share</strong> → <strong className="text-slate-400">Add to Home Screen</strong> untuk install
          </p>
        )}
      </div>
    </div>
  );
}

// ── Mode Selection ─────────────────────────────────────────────────────────

function ModeScreen({
  session,
  onSelect,
  onLogout,
}: {
  session: Session;
  onSelect: (mode: "manual" | "scanner-teacher" | "scanner-student" | "meeting-scanner") => void;
  onLogout: () => void;
}) {
  const isYayasan = session.loginMode === "yayasan";

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-8">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">
            {isYayasan ? "Panitia Rapat" : "Sekolah"}
          </p>
          <h1 className="text-2xl font-black text-white">{session.schoolName}</h1>
          <p className="text-slate-500 text-sm mt-1">Pilih cara absensi</p>
        </div>

        {/* Yayasan: hanya scanner rapat */}
        {isYayasan && (
          <button
            onClick={() => onSelect("meeting-scanner")}
            className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 flex items-center gap-5 hover:bg-slate-750 transition-all group border-b-4 border-b-purple-600/60"
          >
            <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <CalendarDays className="h-7 w-7 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-black text-white">Scanner Rapat</h3>
              <p className="text-slate-400 text-xs mt-0.5">Scan QR peserta rapat yayasan</p>
            </div>
          </button>
        )}

        {/* Operator: absensi manual + scan QR guru */}
        {!isYayasan && (
          <>
            <button
              onClick={() => onSelect("manual")}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 flex items-center gap-5 hover:bg-slate-750 transition-all group border-b-4 border-b-emerald-600/60"
            >
              <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <GraduationCap className="h-7 w-7 text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-white">Absensi Manual</h3>
                <p className="text-slate-400 text-xs mt-0.5">Tandai hadir/sakit/izin per siswa</p>
              </div>
            </button>

            <button
              onClick={() => onSelect("scanner-teacher")}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 flex items-center gap-5 hover:bg-slate-750 transition-all group border-b-4 border-b-blue-600/60"
            >
              <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <ScanLine className="h-7 w-7 text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-white">Scan QR Guru</h3>
                <p className="text-slate-400 text-xs mt-0.5">Scan KTA guru untuk absensi masuk</p>
              </div>
            </button>

            <button
              onClick={() => onSelect("scanner-student")}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 flex items-center gap-5 hover:bg-slate-750 transition-all group border-b-4 border-b-sky-600/60"
            >
              <div className="w-14 h-14 bg-sky-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <QrCode className="h-7 w-7 text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-white">Scan QR Siswa</h3>
                <p className="text-slate-400 text-xs mt-0.5">Scan KTA siswa untuk absensi masuk</p>
              </div>
            </button>
          </>
        )}

        <button
          onClick={onLogout}
          className="w-full text-slate-600 hover:text-slate-400 text-xs font-bold uppercase tracking-widest mt-4 flex items-center justify-center gap-2 transition"
        >
          <LogOut className="h-3.5 w-3.5" /> Keluar
        </button>

        {/* Dashboard Links — operator only */}
        {!isYayasan && (
          <div className="mt-6 border-t border-slate-800 pt-5 space-y-2">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-center mb-3">Kelola dari Dashboard</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Mata Pelajaran", icon: BookOpen, href: "/dashboard/attendance/subjects" },
                { label: "Kelas / Rombel", icon: School, href: "/dashboard/attendance/classes" },
                { label: "Jadwal Jam", icon: ClipboardList, href: "/dashboard/attendance/schedule" },
                { label: "Laporan Absensi", icon: BarChart2, href: "/dashboard/attendance/report" },
                { label: "Absensi Guru", icon: UserCheck, href: "/dashboard/attendance/teacher" },
                { label: "Pengaturan", icon: Settings, href: "/dashboard/attendance/settings" },
              ].map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-slate-800/60 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:text-white transition-all group">
                  <link.icon className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                  <span className="truncate">{link.label}</span>
                  <ExternalLink className="h-2.5 w-2.5 text-slate-600 ml-auto shrink-0" />
                </a>
              ))}
            </div>
            <p className="text-[10px] text-slate-700 text-center pt-1">Butuh login operator untuk mengakses</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manual Attendance Screen ───────────────────────────────────────────────

function ManualScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedJamKe, setSelectedJamKe] = useState<number | undefined>();
  const [statuses, setStatuses] = useState<Record<number, string>>({});

  const { data: classes = [] } = useQuery({
    queryKey: ["pub-classes", session.schoolId],
    queryFn: () => publicAttendanceApi.classes(session.schoolId),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["pub-subjects", session.schoolId],
    queryFn: () => publicAttendanceApi.subjects(session.schoolId),
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["pub-schedules", session.schoolId],
    queryFn: () => publicAttendanceApi.schedules(session.schoolId),
  });

  const selectedClass = classes.find((c: any) => c.id === Number(selectedClassId));

  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ["pub-students", session.schoolId, selectedClassId],
    queryFn: () => publicAttendanceApi.students(session.schoolId, Number(selectedClassId)),
    enabled: !!selectedClassId,
  });

  // Load existing attendance
  const { data: existingLog } = useQuery({
    queryKey: ["pub-log", session.schoolId, selectedClassId, selectedSubjectId, selectedDate],
    queryFn: () =>
      publicAttendanceApi.studentLogShow(
        session.schoolId,
        Number(selectedClassId),
        Number(selectedSubjectId),
        selectedDate
      ),
    enabled: !!selectedClassId && !!selectedSubjectId && !!selectedDate,
  });

  useEffect(() => {
    if (existingLog?.logs?.length) {
      const s: Record<number, string> = {};
      existingLog.logs.forEach((l: any) => { s[l.student_id] = l.status; });
      setStatuses(s);
    } else {
      setStatuses({});
    }
  }, [existingLog]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => publicAttendanceApi.studentLogStore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pub-log"] });
      toast.success("Absensi berhasil disimpan!");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Gagal menyimpan absensi");
    },
  });

  const handleSave = () => {
    if (!selectedClassId || !selectedSubjectId) {
      toast.warning("Pilih kelas dan mata pelajaran terlebih dahulu");
      return;
    }
    const logs = Object.entries(statuses).map(([id, status]) => ({
      student_id: Number(id),
      status,
    }));
    if (logs.length === 0) {
      toast.warning("Belum ada siswa yang ditandai");
      return;
    }
    saveMutation.mutate({
      school_id: session.schoolId,
      pin: session.pin,
      class_id: Number(selectedClassId),
      subject_id: Number(selectedSubjectId),
      tanggal: selectedDate,
      jam_ke: selectedJamKe,
      logs,
    });
  };

  const navigateDate = (d: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + d);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const markedCount = Object.keys(statuses).length;
  const totalCount = students.length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl h-9 w-9">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-slate-800 text-base leading-tight truncate">Absensi Siswa</h1>
          <p className="text-xs text-slate-400 truncate">{session.schoolName}</p>
        </div>
        {markedCount > 0 && (
          <Badge className="bg-emerald-100 text-emerald-700 text-xs">
            {markedCount}/{totalCount}
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto pb-32">
        {/* Filters */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 space-y-3">
            {/* Date */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={() => navigateDate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 rounded-xl text-sm flex-1"
              />
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={() => navigateDate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Class */}
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="h-10 rounded-xl text-sm">
                <SelectValue placeholder="Pilih kelas..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {classes.map((c: any) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Subject */}
            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
              <SelectTrigger className="h-10 rounded-xl text-sm">
                <SelectValue placeholder="Pilih mata pelajaran..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {subjects.map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Jam ke (optional) */}
            {schedules.length > 0 && (
              <Select
                value={selectedJamKe?.toString() ?? ""}
                onValueChange={(v) => setSelectedJamKe(v ? Number(v) : undefined)}
              >
                <SelectTrigger className="h-10 rounded-xl text-sm">
                  <SelectValue placeholder="Jam pelajaran (opsional)..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {schedules.map((s: any) => (
                    <SelectItem key={s.id} value={s.jam_ke.toString()}>
                      Jam ke-{s.jam_ke} ({s.jam_mulai?.substring(0, 5)} – {s.jam_selesai?.substring(0, 5)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Student List */}
        {selectedClassId && selectedSubjectId ? (
          loadingStudents ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <GraduationCap className="h-10 w-10 mx-auto opacity-20 mb-2" />
              <p className="text-sm">Tidak ada siswa di kelas {selectedClass?.nama}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {students.map((student: any, i: number) => {
                const currentStatus = statuses[student.id];
                return (
                  <Card key={student.id} className="border-0 shadow-sm rounded-2xl overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3 mb-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{student.nama}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{student.nisn || "—"}</p>
                        </div>
                        {currentStatus && (
                          <Badge className={`text-[10px] px-2 ${STATUS_COLORS[currentStatus]}`}>
                            {currentStatus}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {["Hadir", "Sakit", "Izin", "Alpa"].map((s) => (
                          <button
                            key={s}
                            onClick={() => setStatuses((prev) => ({ ...prev, [student.id]: s }))}
                            className={`h-9 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${
                              currentStatus === s
                                ? STATUS_COLORS[s]
                                : `bg-white ${STATUS_OUTLINE[s]}`
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        ) : (
          <div className="text-center py-12 text-slate-400">
            <GraduationCap className="h-10 w-10 mx-auto opacity-20 mb-2" />
            <p className="text-sm">Pilih kelas dan mata pelajaran</p>
          </div>
        )}
      </div>

      {/* Sticky Save Button */}
      {selectedClassId && selectedSubjectId && students.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <div className="max-w-lg mx-auto">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || markedCount === 0}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl text-base"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Save className="h-5 w-5 mr-2" />
              )}
              Simpan Absensi ({markedCount}/{totalCount} siswa)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Camera Error Helper ────────────────────────────────────────────────────

function getCameraErrorMessage(err: unknown): { title: string; detail: string } {
  const name = (err as any)?.name ?? "";
  const message = ((err as any)?.message ?? "").toLowerCase();

  if (!window.isSecureContext) {
    return {
      title: "Koneksi tidak aman (HTTP)",
      detail: "Akses kamera hanya diizinkan di HTTPS. Hubungi admin untuk mengaktifkan HTTPS.",
    };
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || message.includes("permission") || message.includes("denied")) {
    return {
      title: "Izin kamera ditolak",
      detail: "Ketuk ikon kunci/info di address bar browser → izinkan Kamera → muat ulang halaman.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || message.includes("not found") || message.includes("no camera")) {
    return {
      title: "Kamera tidak ditemukan",
      detail: "Perangkat ini tidak memiliki kamera yang dapat diakses.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError" || message.includes("not readable") || message.includes("could not start")) {
    return {
      title: "Kamera sedang digunakan",
      detail: "Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera/video lain lalu coba lagi.",
    };
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return {
      title: "Kamera tidak kompatibel",
      detail: "Resolusi kamera tidak didukung. Coba lagi — sistem akan mencoba pengaturan yang lebih sederhana.",
    };
  }
  // Include raw error name/message to help diagnose unknown errors
  const rawInfo = name ? ` (${name})` : message ? ` (${message})` : "";
  return {
    title: `Gagal membuka kamera${rawInfo}`,
    detail: "Pastikan izin kamera sudah diberikan di pengaturan browser, lalu coba lagi.",
  };
}

// Attempt to start Html5Qrcode with progressively simpler constraints.
// Each attempt creates a fresh instance to avoid stale internal state.
async function startHtml5QrcodeWithFallback(
  elementId: string,
  onScan: (code: string) => void,
  config: Html5QrcodeCameraScanConfig
): Promise<Html5Qrcode> {
  const attempts = [
    // 1. Rear camera with resolution cap (ideal for most Android)
    { facingMode: "environment", width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } },
    // 2. Rear camera only, no resolution constraints
    { facingMode: "environment" },
    // 3. Any camera (covers devices where "environment" is not enumerated)
    { facingMode: { ideal: "environment" } },
    // 4. Absolute fallback — let browser pick any camera
    true as unknown as MediaTrackConstraints,
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    const scanner = new Html5Qrcode(elementId);
    try {
      await scanner.start(constraints as any, config, onScan, () => {});
      return scanner; // success
    } catch (err) {
      lastError = err;
      // Clean up this failed instance before trying next
      try { await scanner.stop(); } catch {}
      try { scanner.clear(); } catch {}
    }
  }
  throw lastError;
}

// ── QR Scanner Screen ──────────────────────────────────────────────────────

function ScannerScreen({ session, type, onBack }: { session: Session; type: "teacher" | "student"; onBack: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<{ title: string; detail: string } | null>(null);
  const [scanResults, setScanResults] = useState<Array<{ name: string; time: string }>>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(false);

  const startScanner = async () => {
    setCameraError(null);

    // Guard: camera API requires a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      const err = getCameraErrorMessage(null);
      setCameraError(err);
      toast.error(err.title);
      return;
    }

    const onScan = async (code: string) => {
      if (cooldownRef.current) return;
      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 2500);
      try {
        const res = await publicAttendanceApi.qrScan(session.schoolId, session.pin, code, type);
        if (res.success) {
          toast.success(res.message);
          setScanResults((prev) => [
            { name: res.user_name || code, time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) },
            ...prev,
          ]);
        } else {
          toast.error(res.message || "Gagal memproses QR");
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || (type === "teacher" ? "Guru tidak ditemukan" : "Siswa tidak ditemukan"));
      }
    };

    const config = { fps: 15, qrbox: { width: 260, height: 260 } };

    try {
      const scanner = await startHtml5QrcodeWithFallback("pub-qr-reader", onScan, config);
      scannerRef.current = scanner;
      setScanning(true);
    } catch (err: unknown) {
      const errInfo = getCameraErrorMessage(err);
      setCameraError(errInfo);
      toast.error(errInfo.title);
      scannerRef.current = null;
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => { scannerRef.current?.stop().catch(() => {}); }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost" size="icon"
          onClick={async () => { await stopScanner(); onBack(); }}
          className="text-white hover:bg-slate-800 rounded-xl h-9 w-9"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-black text-base">SCAN QR {type === "teacher" ? "GURU" : "SISWA"}</h2>
          <p className="text-slate-400 text-xs">{session.schoolName}</p>
        </div>
        <div className="bg-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-mono text-emerald-400 text-sm">
          <Clock className="h-3.5 w-3.5" />
          {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-sm mx-auto">
        {/* Camera */}
        <div className="relative rounded-3xl overflow-hidden bg-black border-4 border-slate-800 shadow-2xl">
          <div id="pub-qr-reader" className="w-full" style={{ minHeight: scanning ? 300 : 0 }} />
          {!scanning && !cameraError && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-700">
                <Camera className="h-9 w-9 text-slate-600" />
              </div>
              <p className="text-slate-500 text-sm">Kamera siap</p>
            </div>
          )}
          {!scanning && cameraError && (
            <div className="flex flex-col items-center justify-center py-10 px-5 gap-3 text-center">
              <div className="w-16 h-16 bg-red-950/50 rounded-2xl flex items-center justify-center border-2 border-red-800/50">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <p className="text-red-400 font-bold text-sm">{cameraError.title}</p>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">{cameraError.detail}</p>
              </div>
            </div>
          )}
          {scanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-56 h-56 border-2 border-emerald-500/40 rounded-2xl relative">
                <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />
              </div>
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <Button
          onClick={scanning ? stopScanner : startScanner}
          className={`w-full h-14 text-lg font-black rounded-2xl transition-all active:scale-95 ${
            scanning ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {scanning ? (
            <><XCircle className="mr-2 h-6 w-6" /> Berhenti</>
          ) : cameraError ? (
            <><Camera className="mr-2 h-6 w-6" /> Coba Lagi</>
          ) : (
            <><ScanLine className="mr-2 h-6 w-6" /> Mulai Scan</>
          )}
        </Button>

        {/* Results */}
        {scanResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Tercatat hari ini ({scanResults.length})
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {scanResults.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-900 rounded-xl px-4 py-3 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 font-bold text-xs">
                      {r.name.charAt(0)}
                    </div>
                    <span className="text-white font-semibold text-sm">{r.name}</span>
                  </div>
                  <span className="text-slate-500 font-mono text-xs">{r.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Meeting Scanner Screen ─────────────────────────────────────────────────

function MeetingScannerScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<{ title: string; detail: string } | null>(null);
  const [scanResults, setScanResults] = useState<Array<{ name: string; jabatan: string; instansi: string; time: string; status: 'success' | 'error'; message: string }>>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(false);

  const startScanner = async () => {
    setCameraError(null);

    // Guard: camera API requires a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      const err = getCameraErrorMessage(null);
      setCameraError(err);
      toast.error(err.title);
      return;
    }

    const onScan = async (code: string) => {
      if (cooldownRef.current) return;
      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 3000);
      try {
        const res = await publicMeetingApi.scan(session.pin, code);
        if (res.success || res.code === 'SUCCESS') {
          const d = res.data ?? res;
          toast.success(res.message || `Check-in ${d.participant_name} berhasil`);
          setScanResults((prev) => [{
            name: d.participant_name ?? 'Peserta',
            jabatan: d.jabatan ?? '',
            instansi: d.instansi ?? '',
            time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
            status: 'success',
            message: res.message ?? 'Berhasil',
          }, ...prev.slice(0, 19)]);
        } else {
          toast.error(res.message || "Gagal memproses QR");
          setScanResults((prev) => [{
            name: '—', jabatan: '', instansi: '',
            time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
            status: 'error',
            message: res.message ?? 'Gagal',
          }, ...prev.slice(0, 19)]);
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || "QR tidak valid atau sudah digunakan";
        const status = err.response?.status;
        const debugInfo = err.response?.data?.debug || '';
        if (status === 409) {
          toast.info(msg);
        } else {
          toast.error(`${msg}${debugInfo ? ` [${debugInfo}]` : ''}`);
        }
        setScanResults((prev) => [{
          name: '—', jabatan: '', instansi: '',
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          status: 'error',
          message: `${msg} (HTTP ${status ?? '?'})`,
        }, ...prev.slice(0, 19)]);
      }
    };

    const config = { fps: 15, qrbox: { width: 260, height: 260 } };

    try {
      const scanner = await startHtml5QrcodeWithFallback("meeting-qr-reader", onScan, config);
      scannerRef.current = scanner;
      setScanning(true);
    } catch (err: unknown) {
      const errInfo = getCameraErrorMessage(err);
      setCameraError(errInfo);
      toast.error(errInfo.title);
      scannerRef.current = null;
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => { scannerRef.current?.stop().catch(() => {}); }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon"
          onClick={async () => { await stopScanner(); onBack(); }}
          className="text-white hover:bg-slate-800 rounded-xl h-9 w-9">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-black text-base">SCAN QR PESERTA RAPAT</h2>
          <p className="text-slate-400 text-xs">LP Ma'arif NU Cilacap</p>
        </div>
        <div className="bg-purple-900/50 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-mono text-purple-300 text-sm">
          <Clock className="h-3.5 w-3.5" />
          {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-sm mx-auto">
        {/* Instructions */}
        <div className="bg-purple-900/30 border border-purple-800/50 rounded-2xl p-3 text-xs text-purple-300">
          <p className="font-bold mb-1">Cara penggunaan:</p>
          <p>Minta peserta menunjukkan QR code dari WA undangan mereka, lalu arahkan kamera ke QR tersebut.</p>
        </div>

        {/* Camera */}
        <div className="relative rounded-3xl overflow-hidden bg-black border-4 border-slate-800 shadow-2xl">
          <div id="meeting-qr-reader" className="w-full" style={{ minHeight: scanning ? 300 : 0 }} />
          {!scanning && !cameraError && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-700">
                <Camera className="h-9 w-9 text-slate-600" />
              </div>
              <p className="text-slate-500 text-sm">Kamera siap</p>
            </div>
          )}
          {!scanning && cameraError && (
            <div className="flex flex-col items-center justify-center py-10 px-5 gap-3 text-center">
              <div className="w-16 h-16 bg-red-950/50 rounded-2xl flex items-center justify-center border-2 border-red-800/50">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <p className="text-red-400 font-bold text-sm">{cameraError.title}</p>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">{cameraError.detail}</p>
              </div>
            </div>
          )}
          {scanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-56 h-56 border-2 border-purple-500/40 rounded-2xl relative">
                <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-purple-500 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-purple-500 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-purple-500 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-purple-500 rounded-br-xl" />
              </div>
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <Button
          onClick={scanning ? stopScanner : startScanner}
          className={`w-full h-14 text-lg font-black rounded-2xl transition-all active:scale-95 ${
            scanning ? "bg-red-600 hover:bg-red-700" : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          {scanning ? (
            <><XCircle className="mr-2 h-6 w-6" /> Berhenti</>
          ) : cameraError ? (
            <><Camera className="mr-2 h-6 w-6" /> Coba Lagi</>
          ) : (
            <><ScanLine className="mr-2 h-6 w-6" /> Mulai Scan</>
          )}
        </Button>

        {/* Results */}
        {scanResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-purple-500" />
              Riwayat Scan ({scanResults.length})
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {scanResults.map((r, i) => (
                <div key={i} className={`flex items-start justify-between rounded-xl px-4 py-3 border ${
                  r.status === 'success'
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-red-950/30 border-red-900/50'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      r.status === 'success' ? 'bg-purple-500/20 text-purple-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {r.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{r.name}</p>
                      {r.jabatan && <p className="text-slate-400 text-xs">{r.jabatan} · {r.instansi}</p>}
                      {r.status === 'error' && <p className="text-red-400 text-xs mt-0.5">{r.message}</p>}
                    </div>
                  </div>
                  <span className="text-slate-500 font-mono text-xs shrink-0 ml-2">{r.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Staff Scanner Screen ───────────────────────────────────────────────────

function StaffScannerScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<{ title: string; detail: string } | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  
  // GPS
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');

  // Face Recognition & Geolocation
  const [isFaceVerificationEnabled, setIsFaceVerificationEnabled] = useState(false);
  const [isPhotoEnabled, setIsPhotoEnabled] = useState(false);
  const [isGeolocationEnabled, setIsGeolocationEnabled] = useState(false);
  const [faceVerificationStatus, setFaceVerificationStatus] = useState<'idle'|'scanning'|'verified'|'failed'>('idle');
  const [attendanceType, setAttendanceType] = useState<'Kantor'|'Dinas Luar'>('Kantor');
  const videoRef = useRef<HTMLVideoElement>(null);

  const { data: staffSettings } = useQuery({
    queryKey: ['staff-settings'],
    queryFn: staffAttendanceApi.getSettings,
  });

  useEffect(() => {
    if (staffSettings) {
      const faceEnabled = staffSettings.face_recognition_enabled === 'true' || staffSettings.face_recognition_enabled === true;
      setIsFaceVerificationEnabled(faceEnabled);
      setIsPhotoEnabled(staffSettings.staff_photo_enabled === 'true' || staffSettings.staff_photo_enabled === true);
      setIsGeolocationEnabled(staffSettings.staff_geolocation_enabled === 'true' || staffSettings.staff_geolocation_enabled === true);
      if (faceEnabled) {
        loadFaceModels();
      }
    }
  }, [staffSettings]);

  const loadFaceModels = async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
    } catch (e) {
      console.error('Failed to load face models', e);
      toast.error('Gagal memuat model pengenalan wajah. Hubungi administrator.');
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => setLocationError('Gagal mendapatkan lokasi GPS. Pastikan izin lokasi aktif.'),
        { enableHighAccuracy: true }
      );
    } else {
      setLocationError('Browser Anda tidak mendukung Geolocation.');
    }
  }, []);

  const startScanner = async () => {
    if (isGeolocationEnabled && attendanceType === 'Kantor') {
      if (!location && !locationError) {
        toast.warning('Menunggu lokasi GPS... Coba lagi dalam beberapa detik.');
        return;
      }
      if (locationError) {
        toast.error(locationError);
        return;
      }
    }

    setCameraError(null);
    if (!window.isSecureContext) {
      const err = getCameraErrorMessage(null);
      setCameraError(err);
      toast.error(err.title);
      return;
    }

    const onScan = async (code: string) => {
      // Stop scanner immediately upon detection to prevent multiple reads
      await stopScanner();
      setScanResult(code);
      
      if (isFaceVerificationEnabled && attendanceType === 'Kantor') {
        startFaceVerification(code);
      } else {
        submitAttendance(code);
      }
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    try {
      const scanner = await startHtml5QrcodeWithFallback("staff-qr-reader", onScan, config);
      scannerRef.current = scanner;
      setScanning(true);
    } catch (err: unknown) {
      const errInfo = getCameraErrorMessage(err);
      setCameraError(errInfo);
      toast.error(errInfo.title);
      scannerRef.current = null;
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      try { scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => { stopScanner(); }, []);

  const startFaceVerification = async (qrCode: string) => {
    setFaceVerificationStatus('scanning');
    try {
      // 1. Cek QR Code dan ambil data face_descriptor staff
      const res = await staffAttendanceApi.checkQr({ qr_code: qrCode });
      const staffData = res.data;

      if (!staffData.face_descriptor) {
        toast.error('Wajah staf belum terdaftar di sistem. Silakan daftarkan wajah di dashboard Staff terlebih dahulu.');
        setFaceVerificationStatus('failed');
        return;
      }

      // 2. Mulai Kamera
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // 3. Buat Face Matcher
      const storedDescriptor = new Float32Array(staffData.face_descriptor);
      const faceMatcher = new faceapi.FaceMatcher(
        [new faceapi.LabeledFaceDescriptors(staffData.nama, [storedDescriptor])],
        0.5 // Jarak maksimal (threshold), bisa disesuaikan
      );

      let isVerified = false;
      let stopLoop = false;

      const stopCamera = () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
      };

      const verifyLoop = async () => {
        if (stopLoop || isVerified || !videoRef.current) return;
        
        try {
          const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            const match = faceMatcher.findBestMatch(detection.descriptor);
            if (match.label !== 'unknown') {
              isVerified = true;
              stopLoop = true;
              stopCamera();
              setFaceVerificationStatus('verified');
              submitAttendance(qrCode, true);
              return;
            }
          }
        } catch (e) {
          console.error("Face detection error:", e);
        }

        // Lanjut loop
        setTimeout(verifyLoop, 800);
      };

      // 4. Set Timeout untuk deteksi wajah (misal 15 detik)
      setTimeout(() => {
        if (!isVerified) {
          stopLoop = true;
          stopCamera();
          setFaceVerificationStatus('failed');
          toast.error('Waktu verifikasi habis atau wajah tidak cocok.');
        }
      }, 15000);

      // Mulai loop setelah video diputar sebentar
      setTimeout(verifyLoop, 1500);

    } catch (e: any) {
      setFaceVerificationStatus('failed');
      const msg = e?.response?.data?.message || e?.message || 'Terjadi kesalahan saat verifikasi.'
      toast.error(msg)
      // Reset setelah 3 detik agar scanner bisa digunakan lagi
      setTimeout(() => {
        setScanResult(null)
        setFaceVerificationStatus('idle')
      }, 3000)
    }
  };

  const submitAttendance = async (qrCode: string, faceVerified: boolean = false) => {
    if (!location && attendanceType === 'Kantor' && isGeolocationEnabled) {
      toast.error('Lokasi GPS belum terdeteksi. Aktifkan izin lokasi dan coba lagi.')
      setScanResult(null)
      setFaceVerificationStatus('idle')
      // Restart scanner otomatis agar user tidak perlu tekan tombol lagi
      setTimeout(() => startScanner(), 500)
      return;
    }

    // Capture photo if needed
    let photoData: string | undefined = undefined;
    if (isPhotoEnabled || isFaceVerificationEnabled) {
       if (!videoRef.current) {
          videoRef.current = document.querySelector('#reader-staff video') as HTMLVideoElement;
       }
       if (videoRef.current) {
           try {
             const canvas = document.createElement('canvas');
             canvas.width = videoRef.current.videoWidth;
             canvas.height = videoRef.current.videoHeight;
             const ctx = canvas.getContext('2d');
             if (ctx) {
                 ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                 photoData = canvas.toDataURL('image/jpeg', 0.8);
             }
           } catch(e) {
             console.error("Failed to capture photo", e);
           }
       }
    }

    try {
      const res = await staffAttendanceApi.scan({
        qr_code: qrCode,
        latitude: location?.lat || 0,
        longitude: location?.lng || 0,
        photo: photoData,
        jenis_absen: attendanceType
      });
      toast.success(res.message || 'Absen berhasil dicatat.')
    } catch (error: any) {
      // Tampilkan pesan spesifik dari server, atau pesan generik yang lebih informatif
      const status = error?.response?.status
      const serverMsg = error?.response?.data?.message
      if (status === 422) {
        toast.error(serverMsg || 'Data tidak valid. Pastikan QR Code Anda belum kadaluarsa.')
      } else if (status === 404) {
        toast.error('Staff tidak ditemukan. Pastikan ID Card Anda terdaftar di sistem.')
      } else if (status === 409 || serverMsg?.toLowerCase().includes('sudah')) {
        toast.warning(serverMsg || 'Anda sudah melakukan absensi hari ini.')
      } else if (!navigator.onLine) {
        toast.error('Tidak ada koneksi internet. Periksa jaringan Anda dan coba lagi.')
      } else {
        toast.error(serverMsg || 'Gagal melakukan absensi. Coba lagi beberapa saat.')
      }
    } finally {
      setScanResult(null);
      setFaceVerificationStatus('idle');
      // Restart scanner otomatis setelah selesai (sukses maupun gagal)
      // agar user tidak perlu tekan tombol "Mulai Scan" lagi
      setTimeout(() => startScanner(), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={async () => { await stopScanner(); onBack(); }} className="text-white hover:bg-slate-800 rounded-xl h-9 w-9">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-black text-base">ABSENSI STAFF LP MA'ARIF NU CILACAP</h2>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 max-w-sm mx-auto w-full space-y-4">
        {locationError && (
          <div className="bg-red-900/30 border border-red-800/50 rounded-2xl p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{locationError}</p>
          </div>
        )}

        {!location && !locationError && (
          <div className="bg-blue-900/30 border border-blue-800/50 rounded-2xl p-3 text-xs text-blue-300 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <p>Mendeteksi Lokasi GPS...</p>
          </div>
        )}

        <div className="relative rounded-3xl overflow-hidden bg-black border-4 border-slate-800 shadow-2xl flex-1 flex flex-col justify-center min-h-[300px]">
          <div id="staff-qr-reader" className="w-full shrink-0" style={{ minHeight: scanning ? 300 : 0 }} />

          {/* Default Screen */}
          {!scanning && !scanResult && faceVerificationStatus === 'idle' && (
            <div className="flex flex-col items-center justify-center p-6 text-center gap-4">
              <div className="flex bg-slate-900 p-1 rounded-xl w-full border border-slate-800">
                <button
                  onClick={() => setAttendanceType('Kantor')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${attendanceType === 'Kantor' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Di Kantor
                </button>
                <button
                  onClick={() => setAttendanceType('Dinas Luar')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${attendanceType === 'Dinas Luar' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Dinas Luar
                </button>
              </div>

              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border-2 border-dashed ${attendanceType === 'Kantor' ? 'bg-slate-900 border-slate-700' : 'bg-amber-900/20 border-amber-800/50'}`}>
                {attendanceType === 'Kantor' ? (
                  <Users className="h-9 w-9 text-blue-500" />
                ) : (
                  <ScanLine className="h-9 w-9 text-amber-500" />
                )}
              </div>
              <div>
                <p className="text-white font-bold mb-1">Siapkan ID Card Anda</p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  {attendanceType === 'Kantor' ? 'Pastikan Anda berada di area kantor LP Ma\'arif NU Cilacap.' : 'Absen dinas luar tanpa verifikasi wajah dan lokasi.'}
                </p>
              </div>
              <Button
                onClick={startScanner}
                disabled={attendanceType === 'Kantor' && (!location && !locationError)}
                className={`w-full mt-2 h-12 font-bold rounded-xl ${attendanceType === 'Kantor' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                <ScanLine className="mr-2 h-5 w-5" /> Mulai Scan
              </Button>
            </div>
          )}

          {/* Face Verification Overlay */}
          {faceVerificationStatus === 'scanning' && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 gap-4 z-10">
              <div className="relative w-full aspect-square rounded-full overflow-hidden border-4 border-blue-500">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-[4px] border-dashed border-blue-400 animate-spin-slow rounded-full pointer-events-none" />
              </div>
              <p className="text-blue-400 font-bold animate-pulse text-sm">Memverifikasi Wajah...</p>
            </div>
          )}

          {faceVerificationStatus === 'failed' && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 gap-4 z-10">
              <div className="w-16 h-16 bg-red-950/50 rounded-full flex items-center justify-center border-2 border-red-800/50">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <div className="text-center">
                <p className="text-red-400 font-bold">Verifikasi Gagal</p>
                <p className="text-slate-500 text-xs mt-1">Wajah tidak cocok.</p>
              </div>
              <Button variant="outline" className="mt-2 text-slate-300 border-slate-700" onClick={() => {
                setScanResult(null);
                setFaceVerificationStatus('idle');
                startScanner();
              }}>Coba Lagi</Button>
            </div>
          )}
          
          {scanResult && faceVerificationStatus === 'verified' && (
             <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 gap-4 z-10">
               <div className="w-16 h-16 bg-emerald-950/50 rounded-full flex items-center justify-center border-2 border-emerald-800/50">
                 <CheckCircle2 className="h-8 w-8 text-emerald-500" />
               </div>
               <p className="text-emerald-400 font-bold">Wajah Cocok</p>
               <p className="text-slate-500 text-xs">Memproses absensi...</p>
             </div>
          )}
        </div>

        {/* Cancel Button during scanning */}
        {scanning && (
          <Button variant="outline" onClick={stopScanner} className="w-full h-12 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800">
            Batal
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PublicScannerPage() {
  const [screen, setScreen] = useState<Screen>("login");
  const [session, setSession] = useState<Session | null>(null);

  const handleLogin = (s: Session) => {
    setSession(s);
    if (s.loginMode === "yayasan") {
      setScreen("meeting-scanner");
    } else if (s.loginMode === "staff") {
      setScreen("staff-scanner");
    } else {
      setScreen("mode");
    }
  };

  const handleLogout = () => {
    setSession(null);
    setScreen("login");
  };

  if (screen === "login" || !session) {
    return <LoginScreen onSuccess={handleLogin} />;
  }

  if (screen === "mode") {
    return (
      <ModeScreen
        session={session}
        onSelect={(mode) => setScreen(mode)}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === "manual") {
    return <ManualScreen session={session} onBack={() => setScreen("mode")} />;
  }

  if (screen === "scanner-teacher") {
    return <ScannerScreen session={session} type="teacher" onBack={() => setScreen("mode")} />;
  }

  if (screen === "scanner-student") {
    return <ScannerScreen session={session} type="student" onBack={() => setScreen("mode")} />;
  }

  if (screen === "meeting-scanner") {
    return (
      <MeetingScannerScreen
        session={session}
        onBack={() => {
          if (session.loginMode === "yayasan") {
            handleLogout();
          } else {
            setScreen("mode");
          }
        }}
      />
    );
  }

  if (screen === "staff-scanner") {
    return <StaffScannerScreen session={session} onBack={handleLogout} />;
  }

  return null;
}

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { School, Users, UserCheck, Save, RefreshCw, FileText } from "lucide-react";
import { useEffect } from "react";

export default function ClassesPage() {
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const schoolId = user?.schoolId as Id<"schools"> | undefined;

  // Auto-populated kelas list from student data
  const kelasList = useQuery(api.students.getDistinctKelas, schoolId ? { schoolId } : "skip");
  // Wali kelas assignments from classes table
  const waliKelasData = useQuery(api.classes.getWaliKelas, schoolId ? { schoolId } : "skip");
  // Teachers list for dropdown
  const teachers = useQuery(api.teachers.getBySchool, schoolId ? { schoolId } : "skip");
  const setWaliKelasMutation = useMutation(api.classes.setWaliKelas);
  const syncClassesMutation = useMutation(api.classes.autoSyncFromStudents);

  useEffect(() => {
    if (schoolId) syncClassesMutation({ schoolId }).catch(console.error);
  }, [schoolId, syncClassesMutation]);

  const [editingKelas, setEditingKelas] = useState<string | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [saving, setSaving] = useState(false);

  const currentTahunAjaran = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  })();

  // Find wali kelas for a given class name
  const getWaliKelasForClass = (kelasNama: string) => {
    return waliKelasData?.find((c: any) => c.nama === kelasNama);
  };

  const getTeacherName = (teacherId: string) => {
    const t = teachers?.find((t: any) => t._id === teacherId);
    return t ? t.nama : "-";
  };

  const handleSaveWaliKelas = async (kelasNama: string) => {
    if (!schoolId) return;
    setSaving(true);
    try {
      // Extract tingkat from kelas name (e.g., "5A" -> "5", "VI-B" -> "VI")
      const tingkat = kelasNama.replace(/[^0-9IVX]/gi, "") || kelasNama;
      await setWaliKelasMutation({
        schoolId,
        nama: kelasNama,
        tingkat,
        waliKelasId: selectedTeacher ? (selectedTeacher as Id<"teachers">) : undefined,
        tahunAjaran: currentTahunAjaran,
      });
      toast.success(`Wali kelas ${kelasNama} berhasil disimpan!`);
      setEditingKelas(null);
      setSelectedTeacher("");
    } catch {
      toast.error("Gagal menyimpan wali kelas");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Kelas / Rombel</h1>
        <p className="text-slate-500 text-sm mt-1">
          Daftar kelas otomatis dari data siswa — TA {currentTahunAjaran}
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <RefreshCw className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm text-blue-800 font-medium">Kelas otomatis tersinkronisasi dari Data Siswa</p>
          <p className="text-xs text-blue-600 mt-0.5">Tidak perlu menambahkan kelas manual. Cukup pastikan kolom "kelas" terisi saat import data siswa.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <School className="h-4 w-4" />
            Daftar Kelas ({kelasList?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {kelasList?.map((item: any) => {
              const waliKelas = getWaliKelasForClass(item.kelas);
              const isEditing = editingKelas === item.kelas;

              return (
                <div
                  key={item.kelas}
                  className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border hover:border-emerald-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-bold text-base px-3 py-1">
                      {item.kelas}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <Users className="h-3.5 w-3.5" />
                      {item.count} siswa
                    </div>
                    {waliKelas?.waliKelasId && !isEditing && (
                      <div className="flex items-center gap-1 text-sm text-emerald-600">
                        <UserCheck className="h-3.5 w-3.5" />
                        {getTeacherName(waliKelas.waliKelasId)}
                      </div>
                    )}
                  </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Pilih Wali Kelas" />
                            </SelectTrigger>
                            <SelectContent>
                              {teachers?.map((t: any) => (
                                <SelectItem key={t._id} value={t._id}>{t.nama}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => handleSaveWaliKelas(item.kelas)}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Simpan
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingKelas(null); setSelectedTeacher(""); }}
                          >
                            Batal
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => navigate(`/dashboard/attendance/report?className=${encodeURIComponent(item.kelas)}`)}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            Laporan
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingKelas(item.kelas);
                              setSelectedTeacher(waliKelas?.waliKelasId || "");
                            }}
                          >
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            {waliKelas?.waliKelasId ? "Ubah Wali" : "Set Wali Kelas"}
                          </Button>
                        </>
                      )}
                    </div>
                </div>
              );
            })}

            {(!kelasList || kelasList.length === 0) && (
              <p className="text-center text-slate-400 py-8 text-sm">
                Belum ada data kelas. Import data siswa terlebih dahulu dengan kolom "kelas" terisi.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

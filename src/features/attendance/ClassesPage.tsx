import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { School, Users, UserCheck, Save, RefreshCw, FileText, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceApi, teacherApi } from "@/lib/api";

export default function ClassesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 🔥 REST API QUERIES
  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({ 
    queryKey: ['classes'], 
    queryFn: attendanceApi.classList 
  });
  
  const { data: teachersData } = useQuery({ 
    queryKey: ['teachers', 'all'], 
    queryFn: () => teacherApi.list({ per_page: 100 })
  });

  const updateMutation = useMutation({
    queryFn: ({ id, data }: { id: number, data: any }) => attendanceApi.classUpdate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setEditingClassId(null);
      toast.success("Wali kelas berhasil disimpan!");
    }
  });

  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");

  const teachers = teachersData?.data || [];

  const currentTahunAjaran = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  })();

  const handleSaveWaliKelas = (classId: number) => {
    updateMutation.mutate({ 
      id: classId, 
      data: { wali_kelas_id: selectedTeacherId ? Number(selectedTeacherId) : null } 
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Kelas / Rombel</h1>
        <p className="text-slate-500 text-sm mt-1">
          Daftar kelas dan penugasan wali kelas — TA {currentTahunAjaran}
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <RefreshCw className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm text-blue-800 font-medium">Pengelolaan Kelas & Wali</p>
          <p className="text-xs text-blue-600 mt-0.5">Pastikan setiap kelas memiliki wali kelas yang bertugas untuk rekapitulasi laporan.</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-3 bg-slate-50/50">
          <CardTitle className="text-base flex items-center gap-2">
            <School className="h-4 w-4 text-emerald-600" />
            Daftar Kelas ({classes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {isLoadingClasses ? (
               <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
            ) : classes.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">Belum ada data kelas.</p>
            ) : (
                classes.map((item: any) => {
                  const isEditing = editingClassId === item.id;
                  const waliKelas = teachers.find((t: any) => t.id === item.wali_kelas_id);

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-100 hover:border-emerald-200 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-bold text-base px-3 py-1 bg-white border-slate-200 text-slate-700">
                          {item.nama}
                        </Badge>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Users className="h-3.5 w-3.5" />
                          {item.students_count || 0} Siswa
                        </div>
                        {waliKelas && !isEditing && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold ml-2">
                            <UserCheck className="h-3.5 w-3.5" />
                            {waliKelas.nama}
                          </div>
                        )}
                      </div>

                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                                <SelectTrigger className="w-48 h-9 rounded-lg">
                                  <SelectValue placeholder="Pilih Wali Kelas" />
                                </SelectTrigger>
                                <SelectContent>
                                  {teachers.map((t: any) => (
                                    <SelectItem key={t.id} value={t.id.toString()}>{t.nama}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => handleSaveWaliKelas(item.id)}
                                disabled={updateMutation.isPending}
                                className="bg-emerald-600 h-9"
                              >
                                {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                Simpan
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9"
                                onClick={() => { setEditingClassId(null); setSelectedTeacherId(""); }}
                              >
                                Batal
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50 h-9 rounded-lg"
                                onClick={() => navigate(`/dashboard/attendance/report?classId=${item.id}`)}
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                Laporan
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 rounded-lg text-slate-600 hover:border-emerald-400"
                                onClick={() => {
                                  setEditingClassId(item.id);
                                  setSelectedTeacherId(item.wali_kelas_id?.toString() || "");
                                }}
                              >
                                <UserCheck className="h-3.5 w-3.5 mr-1" />
                                {item.wali_kelas_id ? "Ubah Wali" : "Set Wali"}
                              </Button>
                            </>
                          )}
                        </div>
                    </div>
                  );
                })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

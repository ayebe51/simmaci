import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Clock, Plus, Save, Trash2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "@/lib/api";

interface SlotRow {
  jam_ke: number;
  jam_mulai: string;
  jam_selesai: string;
}

export default function LessonSchedulePage() {
  const queryClient = useQueryClient();
  
  // 🔥 REST API QUERIES
  const { data: schedule = [], isLoading } = useQuery({ 
      queryKey: ['lesson-schedules'], 
      queryFn: attendanceApi.scheduleList 
  });

  const saveBatchMutation = useMutation({
    queryFn: (slots: SlotRow[]) => attendanceApi.scheduleStore({ slots }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-schedules'] });
      toast.success("Jadwal jam pelajaran berhasil disimpan!");
    }
  });

  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [hasInit, setHasInit] = useState(false);

  useEffect(() => {
    if (!isLoading && schedule) {
      if (schedule.length > 0) {
        setSlots(schedule.map((s: any) => ({
          jam_ke: s.jam_ke,
          jam_mulai: s.jam_mulai?.substring(0, 5) || "",
          jam_selesai: s.jam_selesai?.substring(0, 5) || ""
        })));
      } else if (!hasInit) {
        // Default slots if empty
        setSlots([
          { jam_ke: 1, jam_mulai: "07:00", jam_selesai: "07:45" },
          { jam_ke: 2, jam_mulai: "07:45", jam_selesai: "08:30" },
          { jam_ke: 3, jam_mulai: "08:30", jam_selesai: "09:15" },
          { jam_ke: 4, jam_mulai: "09:15", jam_selesai: "10:00" },
        ]);
        setHasInit(true);
      }
    }
  }, [schedule, isLoading, hasInit]);

  const updateSlot = (index: number, field: keyof SlotRow, value: any) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    setSlots([...slots, { jam_ke: (lastSlot?.jam_ke || 0) + 1, jam_mulai: lastSlot?.jam_selesai || "07:00", jam_selesai: "" }]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    saveBatchMutation.mutate(slots);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Jadwal Jam Pelajaran</h1>
        <p className="text-slate-500 text-sm mt-1">Atur jam pelajaran untuk validasi waktu absensi</p>
      </div>

      <Card className="border-0 shadow-sm rounded-xl">
        <CardHeader className="pb-3 px-6 bg-slate-50/50">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600" />
            Pengaturan Jam Mengajar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          <div className="grid grid-cols-[80px_1fr_1fr_48px] gap-3 mb-2 text-[10px] font-bold text-slate-400 uppercase px-1 tracking-wider">
            <span className="text-center">Jam Ke</span>
            <span>Mulai</span>
            <span>Selesai</span>
            <span></span>
          </div>
          
          {isLoading ? (
             <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
          ) : (
            <div className="space-y-3">
              {slots.map((slot, i) => (
                <div key={i} className="grid grid-cols-[80px_1fr_1fr_48px] gap-3 items-center group">
                  <div className="bg-emerald-50 text-emerald-700 font-extrabold text-center py-2.5 rounded-xl border border-emerald-100 shadow-sm">
                    {slot.jam_ke}
                  </div>
                  <Input 
                    type="time" 
                    value={slot.jam_mulai} 
                    onChange={(e) => updateSlot(i, "jam_mulai", e.target.value)} 
                    className="h-11 rounded-xl focus:ring-emerald-500"
                  />
                  <Input 
                    type="time" 
                    value={slot.jam_selesai} 
                    onChange={(e) => updateSlot(i, "jam_selesai", e.target.value)} 
                    className="h-11 rounded-xl focus:ring-emerald-500"
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-11 w-11 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={() => removeSlot(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-6 border-t mt-6">
            <Button variant="outline" onClick={addSlot} className="flex-1 h-11 rounded-xl border-dashed border-2 hover:border-emerald-500 hover:text-emerald-600">
              <Plus className="h-4 w-4 mr-2" /> Tambah Jam
            </Button>
            <Button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-11 rounded-xl" disabled={saveBatchMutation.isPending}>
              {saveBatchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} 
              Simpan Jadwal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

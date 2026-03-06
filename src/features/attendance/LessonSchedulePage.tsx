import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Clock, Plus, Save, Trash2 } from "lucide-react";


interface SlotRow {
  jamKe: number;
  jamMulai: string;
  jamSelesai: string;
}

export default function LessonSchedulePage() {
  const userStr = localStorage.getItem('user');
const user = userStr ? JSON.parse(userStr) : null;
  const schoolId = user?.schoolId as Id<"schools"> | undefined;
  const schedule = useQuery(api.lessonSchedule.list, schoolId ? { schoolId } : "skip");
  const saveBulk = useMutation(api.lessonSchedule.saveBulk);

  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (schedule && !loaded) {
      if (schedule.length > 0) {
        setSlots(schedule.map((s: any) => ({ jamKe: s.jamKe, jamMulai: s.jamMulai, jamSelesai: s.jamSelesai })));
      } else {
        // Default 8 slots
        setSlots([
          { jamKe: 1, jamMulai: "07:00", jamSelesai: "07:45" },
          { jamKe: 2, jamMulai: "07:45", jamSelesai: "08:30" },
          { jamKe: 3, jamMulai: "08:30", jamSelesai: "09:15" },
          { jamKe: 4, jamMulai: "09:15", jamSelesai: "10:00" },
          { jamKe: 5, jamMulai: "10:15", jamSelesai: "11:00" },
          { jamKe: 6, jamMulai: "11:00", jamSelesai: "11:45" },
          { jamKe: 7, jamMulai: "12:30", jamSelesai: "13:15" },
          { jamKe: 8, jamMulai: "13:15", jamSelesai: "14:00" },
        ]);
      }
      setLoaded(true);
    }
  }, [schedule, loaded]);

  const updateSlot = (index: number, field: keyof SlotRow, value: string) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    setSlots([...slots, { jamKe: (lastSlot?.jamKe || 0) + 1, jamMulai: lastSlot?.jamSelesai || "07:00", jamSelesai: "" }]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!schoolId) return;
    try {
      await saveBulk({ schoolId, slots });
      toast.success("Jadwal jam pelajaran berhasil disimpan!");
    } catch { toast.error("Gagal menyimpan"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Jadwal Jam Pelajaran</h1>
        <p className="text-slate-500 text-sm mt-1">Atur jam pelajaran untuk validasi waktu absensi</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pengaturan Jam
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[60px_1fr_1fr_40px] gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase px-1">
            <span>Jam Ke</span>
            <span>Mulai</span>
            <span>Selesai</span>
            <span></span>
          </div>
          {slots.map((slot, i) => (
            <div key={i} className="grid grid-cols-[60px_1fr_1fr_40px] gap-2 items-center">
              <div className="bg-emerald-50 text-emerald-700 font-bold text-center py-2 rounded-lg text-sm">
                {slot.jamKe}
              </div>
              <Input type="time" value={slot.jamMulai} onChange={(e) => updateSlot(i, "jamMulai", e.target.value)} />
              <Input type="time" value={slot.jamSelesai} onChange={(e) => updateSlot(i, "jamSelesai", e.target.value)} />
              <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => removeSlot(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={addSlot} className="flex-1">
              <Plus className="h-4 w-4 mr-1" /> Tambah Jam
            </Button>
            <Button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              <Save className="h-4 w-4 mr-1" /> Simpan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

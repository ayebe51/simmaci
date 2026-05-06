import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { schoolApi, type School } from "@/lib/api";
import type { RecipientCategory, Jenjang } from "../types/waBlast.types";

interface RecipientSelectorProps {
  category: RecipientCategory;
  onCategoryChange: (category: RecipientCategory) => void;
  jenjang: Jenjang[];
  onJenjangChange: (jenjang: Jenjang[]) => void;
  schoolIds: number[];
  onSchoolIdsChange: (schoolIds: number[]) => void;
}

const jenjangOptions: { value: Jenjang; label: string }[] = [
  { value: "MI", label: "MI" },
  { value: "MTs", label: "MTs" },
  { value: "MA", label: "MA" },
];

export function RecipientSelector({
  category,
  onCategoryChange,
  jenjang,
  onJenjangChange,
  schoolIds,
  onSchoolIdsChange,
}: RecipientSelectorProps) {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSchools = async () => {
      setLoading(true);
      try {
        const data = await schoolApi.list();
        // Ensure data is an array
        setSchools(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch schools:", error);
        setSchools([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchSchools();
  }, []);

  const handleJenjangToggle = (value: Jenjang) => {
    if (jenjang.includes(value)) {
      onJenjangChange(jenjang.filter((j) => j !== value));
    } else {
      onJenjangChange([...jenjang, value]);
    }
  };

  const handleAllJenjangToggle = () => {
    if (jenjang.length === jenjangOptions.length) {
      onJenjangChange([]);
    } else {
      onJenjangChange(jenjangOptions.map((opt) => opt.value));
    }
  };

  const handleSchoolChange = (value: string) => {
    if (value === "all") {
      onSchoolIdsChange([]);
    } else {
      const schoolId = parseInt(value);
      if (schoolIds.includes(schoolId)) {
        onSchoolIdsChange(schoolIds.filter((id) => id !== schoolId));
      } else {
        onSchoolIdsChange([...schoolIds, schoolId]);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Kategori Penerima */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Kategori Penerima</Label>
        <RadioGroup value={category} onValueChange={(value) => onCategoryChange(value as RecipientCategory)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="kepala_sekolah" id="kepala_sekolah" />
            <Label htmlFor="kepala_sekolah" className="font-normal cursor-pointer">
              Kepala Sekolah
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="gtk" id="gtk" />
            <Label htmlFor="gtk" className="font-normal cursor-pointer">
              Guru (GTK)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="both" id="both" />
            <Label htmlFor="both" className="font-normal cursor-pointer">
              Keduanya
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Filter Jenjang */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Filter Jenjang</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="all-jenjang"
              checked={jenjang.length === jenjangOptions.length}
              onCheckedChange={handleAllJenjangToggle}
            />
            <Label htmlFor="all-jenjang" className="font-normal cursor-pointer">
              Semua Jenjang
            </Label>
          </div>
          {jenjangOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`jenjang-${option.value}`}
                checked={jenjang.includes(option.value)}
                onCheckedChange={() => handleJenjangToggle(option.value)}
              />
              <Label htmlFor={`jenjang-${option.value}`} className="font-normal cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Sekolah */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Filter Sekolah</Label>
        <Select value={schoolIds.length === 0 ? "all" : schoolIds[0]?.toString()} onValueChange={handleSchoolChange}>
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Memuat..." : "Pilih sekolah atau semua sekolah"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Sekolah</SelectItem>
            {schools.map((school) => (
              <SelectItem key={school.id} value={school.id.toString()}>
                {school.nama} {school.jenjang ? `(${school.jenjang})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {schoolIds.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {schoolIds.length} sekolah dipilih
          </div>
        )}
      </div>
    </div>
  );
}

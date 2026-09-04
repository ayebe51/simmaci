import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ppdbService } from '@/services/ppdbService';
import { 
  Building2, 
  User, 
  Users, 
  Upload, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight, 
  FileText, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle,
  Download,
  Printer,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, label: 'Lembaga & Jalur', icon: Building2 },
  { id: 2, label: 'Data Calon Siswa', icon: User },
  { id: 3, label: 'Data Orang Tua / Wali', icon: Users },
  { id: 4, label: 'Unggah Berkas', icon: Upload },
  { id: 5, label: 'Bukti Pendaftaran', icon: CheckCircle2 },
];

const TRACK_OPTIONS = [
  { id: 'reguler', label: 'Jalur Reguler', desc: 'Seleksi umum berdasarkan kelengkapan berkas dan nilai rapor/tes.' },
  { id: 'prestasi', label: 'Jalur Prestasi', desc: 'Bagi siswa berprestasi akademik maupun non-akademik (Olahraga, Seni, MTQ).' },
  { id: 'tahfidz', label: 'Jalur Tahfidz Qur\'an', desc: 'Khusus calon santri/siswa penghafal Al-Qur\'an minimal 1 Juz.' },
  { id: 'afirmasi', label: 'Jalur Afirmasi / KIP', desc: 'Bantuan keringanan biaya bagi keluarga pemegang KIP / PKH / Yatim.' },
];

export default function PpdbRegistrationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialSchoolId = searchParams.get('school_id');

  const [currentStep, setCurrentStep] = useState(1);
  const [copied, setCopied] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    school_id: initialSchoolId ? Number(initialSchoolId) : 0,
    period_id: 0,
    track: 'reguler',
    nisn: '',
    nik: '',
    nama_lengkap: '',
    jenis_kelamin: 'L',
    tempat_lahir: '',
    tanggal_lahir: '',
    asal_sekolah: '',
    no_whatsapp: '',
    email: '',
    alamat: '',
    provinsi: 'Jawa Tengah',
    kabupaten: 'Cilacap',
    kecamatan: 'Cilacap Tengah',
    kelurahan: '',
    rt_rw: '',
    kode_pos: '',
    nama_ayah: '',
    pekerjaan_ayah: '',
    nama_ibu: '',
    pekerjaan_ibu: '',
    nama_wali: '',
    no_whatsapp_wali: '',
  });

  const [files, setFiles] = useState<{
    foto?: File;
    kk?: File;
    akta?: File;
    ijazah?: File;
    prestasi?: File;
  }>({});

  const [registeredResult, setRegisteredResult] = useState<any>(null);

  // Query Schools List
  const { data: schoolsData } = useQuery({
    queryKey: ['ppdb-schools-selector'],
    queryFn: () => ppdbService.getPublicSchools({ per_page: 100 }),
  });

  const schools = schoolsData?.data?.items || schoolsData?.data || [];

  // Query Selected School Detail (including its active periods)
  const { data: selectedSchool, isLoading: isLoadingSchool } = useQuery({
    queryKey: ['ppdb-selected-school', formData.school_id],
    queryFn: () => ppdbService.getPublicSchoolDetail(formData.school_id),
    enabled: !!formData.school_id && formData.school_id > 0,
  });

  // Automatically select the first active period when school is loaded
  useEffect(() => {
    if (selectedSchool?.ppdb_periods?.length > 0) {
      setFormData(prev => ({
        ...prev,
        period_id: selectedSchool.ppdb_periods[0].id,
      }));
    }
  }, [selectedSchool]);

  // Submit Mutation
  const registerMutation = useMutation({
    mutationFn: (data: FormData) => ppdbService.registerOnline(data),
    onSuccess: (res) => {
      setRegisteredResult(res.data);
      setCurrentStep(5);
      toast.success('Pendaftaran PPDB Berhasil Terkirim!');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Gagal mengirim pendaftaran. Periksa kembali isian formulir Anda.';
      toast.error(msg);
    },
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [field]: e.target.files![0] }));
    }
  };

  // Step Navigations & Validations
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!formData.school_id || formData.school_id === 0) {
        toast.error('Pilih Madrasah / Sekolah tujuan terlebih dahulu.');
        return;
      }
      if (!formData.period_id || formData.period_id === 0) {
        toast.error('Madrasah ini belum membuka gelombang PPDB yang aktif.');
        return;
      }
    } else if (currentStep === 2) {
      if (!formData.nama_lengkap.trim()) {
        toast.error('Nama lengkap calon siswa wajib diisi.');
        return;
      }
      if (!formData.nik.trim()) {
        toast.error('NIK calon siswa wajib diisi.');
        return;
      }
      if (!formData.tanggal_lahir) {
        toast.error('Tanggal lahir wajib diisi.');
        return;
      }
      if (!formData.asal_sekolah.trim()) {
        toast.error('Asal sekolah wajib diisi.');
        return;
      }
      if (!formData.no_whatsapp.trim()) {
        toast.error('Nomor WhatsApp aktif wajib diisi.');
        return;
      }
    } else if (currentStep === 3) {
      if (!formData.alamat.trim()) {
        toast.error('Alamat domisili wajib diisi.');
        return;
      }
      if (!formData.kecamatan.trim()) {
        toast.error('Kecamatan wajib diisi.');
        return;
      }
    }

    setCurrentStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submission = new FormData();
    Object.entries(formData).forEach(([key, val]) => {
      if (val !== null && val !== undefined) {
        submission.append(key, String(val));
      }
    });

    Object.entries(files).forEach(([key, file]) => {
      if (file) {
        submission.append(key, file);
      }
    });

    registerMutation.mutate(submission);
  };

  const copyRegNumber = () => {
    if (registeredResult?.registration_number) {
      navigator.clipboard.writeText(registeredResult.registration_number);
      setCopied(true);
      toast.success('Nomor Registrasi disalin ke clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* ── Top Bar ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ppdb')}
            className="text-slate-600 hover:text-emerald-800 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Kembali ke Beranda
          </Button>

          <div className="text-center">
            <span className="font-extrabold text-emerald-950 text-sm tracking-tight block">
              FORMULIR PENDAFTARAN PPDB
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 tracking-wider block">
              LP MA'ARIF NU CILACAP
            </span>
          </div>

          <div className="w-20" /> {/* Spacer */}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-8">
        {/* ── Stepper Navigation ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 z-0" />
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-600 z-0 transition-all duration-300"
              style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
            />

            {STEPS.map((step) => {
              const isActive = currentStep === step.id;
              const isPassed = currentStep > step.id;

              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs transition-all shadow-sm ${
                    isActive 
                      ? 'bg-emerald-700 text-white ring-4 ring-emerald-100 scale-110' 
                      : isPassed 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-white text-slate-400 border-2 border-slate-200'
                  }`}>
                    {isPassed ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[11px] font-semibold mt-2 hidden sm:block ${
                    isActive ? 'text-emerald-900 font-bold' : isPassed ? 'text-emerald-700' : 'text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Step 1: School & Track Selection ── */}
        {currentStep === 1 && (
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl font-extrabold text-slate-900">
                Pilih Madrasah & Jalur Pendaftaran
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Tentukan lembaga tujuan dan jalur masuk yang sesuai dengan calon siswa.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Select School */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Pilih Madrasah / Sekolah Tujuan *</Label>
                <Select
                  value={formData.school_id ? String(formData.school_id) : ''}
                  onValueChange={(val) => handleInputChange('school_id', Number(val))}
                >
                  <SelectTrigger className="rounded-xl h-11 text-sm bg-slate-50">
                    <SelectValue placeholder="-- Pilih Madrasah / Sekolah --" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {schools.map((sch: any) => (
                      <SelectItem key={sch.id} value={String(sch.id)}>
                        [{sch.jenjang || 'Madrasah'}] {sch.nama} - {sch.kecamatan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* School PPDB Period Info */}
              {selectedSchool && (
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">Gelombang Aktif:</span>
                    <Badge className="bg-emerald-700 text-white text-[10px]">
                      {selectedSchool.ppdb_periods?.[0]?.wave_name || 'Gelombang 1 - Reguler'}
                    </Badge>
                  </div>
                  <p className="text-xs text-emerald-800/80">
                    Tahun Ajaran: {selectedSchool.ppdb_periods?.[0]?.academic_year || '2026/2027'} • 
                    Alamat: {selectedSchool.alamat || selectedSchool.kecamatan}
                  </p>
                </div>
              )}

              {/* Track Selection */}
              <div className="space-y-3 pt-2">
                <Label className="text-xs font-bold text-slate-700">Pilihan Jalur Pendaftaran *</Label>
                <RadioGroup 
                  value={formData.track} 
                  onValueChange={(val) => handleInputChange('track', val)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {TRACK_OPTIONS.map((track) => (
                    <label
                      key={track.id}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        formData.track === track.id
                          ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-sm text-slate-900">{track.label}</span>
                        <RadioGroupItem value={track.id} id={track.id} />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                        {track.desc}
                      </p>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  onClick={handleNextStep}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-6 font-semibold text-xs h-11"
                >
                  Lanjut: Data Calon Siswa
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Student Biodata ── */}
        {currentStep === 2 && (
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl font-extrabold text-slate-900">
                Biodata Calon Siswa Baru
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Masukkan identitas lengkap sesuai dengan dokumen Akta Kelahiran dan Kartu Keluarga (KK).
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Nama Lengkap Siswa *</Label>
                  <Input
                    value={formData.nama_lengkap}
                    onChange={(e) => handleInputChange('nama_lengkap', e.target.value)}
                    placeholder="Contoh: Muhammad Azka Pratama"
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Jenis Kelamin *</Label>
                  <Select
                    value={formData.jenis_kelamin}
                    onValueChange={(val) => handleInputChange('jenis_kelamin', val)}
                  >
                    <SelectTrigger className="rounded-xl h-11 text-sm bg-slate-50">
                      <SelectValue placeholder="Pilih Jenis Kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Nomor Induk Kependudukan (NIK) *</Label>
                  <Input
                    value={formData.nik}
                    onChange={(e) => handleInputChange('nik', e.target.value)}
                    placeholder="16 digit NIK sesuai KK"
                    maxLength={16}
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">NISN (Nomor Induk Siswa Nasional)</Label>
                  <Input
                    value={formData.nisn}
                    onChange={(e) => handleInputChange('nisn', e.target.value)}
                    placeholder="10 digit NISN (jika sudah ada)"
                    maxLength={10}
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Tempat Lahir *</Label>
                  <Input
                    value={formData.tempat_lahir}
                    onChange={(e) => handleInputChange('tempat_lahir', e.target.value)}
                    placeholder="Kota / Kabupaten Kelahiran"
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Tanggal Lahir *</Label>
                  <Input
                    type="date"
                    value={formData.tanggal_lahir}
                    onChange={(e) => handleInputChange('tanggal_lahir', e.target.value)}
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Asal Sekolah Sebelumnya *</Label>
                  <Input
                    value={formData.asal_sekolah}
                    onChange={(e) => handleInputChange('asal_sekolah', e.target.value)}
                    placeholder="Contoh: RA / TK / MI / SD / SMP asal"
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">No. WhatsApp Calon Siswa / Wali *</Label>
                  <Input
                    value={formData.no_whatsapp}
                    onChange={(e) => handleInputChange('no_whatsapp', e.target.value)}
                    placeholder="Contoh: 081234567890 (untuk notifikasi pendaftaran)"
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="rounded-xl px-5 text-xs h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali
                </Button>
                <Button
                  onClick={handleNextStep}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-6 font-semibold text-xs h-11"
                >
                  Lanjut: Data Orang Tua
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Parents / Guardian Data ── */}
        {currentStep === 3 && (
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl font-extrabold text-slate-900">
                Data Orang Tua / Wali & Domisili
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Informasi keluarga dan alamat tempat tinggal calon siswa saat ini.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Nama Ayah Kandung</Label>
                  <Input
                    value={formData.nama_ayah}
                    onChange={(e) => handleInputChange('nama_ayah', e.target.value)}
                    placeholder="Nama lengkap ayah"
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Pekerjaan Ayah</Label>
                  <Input
                    value={formData.pekerjaan_ayah}
                    onChange={(e) => handleInputChange('pekerjaan_ayah', e.target.value)}
                    placeholder="PNS / Wiraswasta / Buruh / dll"
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Nama Ibu Kandung</Label>
                  <Input
                    value={formData.nama_ibu}
                    onChange={(e) => handleInputChange('nama_ibu', e.target.value)}
                    placeholder="Nama lengkap ibu"
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Pekerjaan Ibu</Label>
                  <Input
                    value={formData.pekerjaan_ibu}
                    onChange={(e) => handleInputChange('pekerjaan_ibu', e.target.value)}
                    placeholder="Ibu Rumah Tangga / Guru / dll"
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>
              </div>

              {/* Address Fields */}
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-bold text-slate-700">Alamat Tempat Tinggal / Domisili *</Label>
                <Input
                  value={formData.alamat}
                  onChange={(e) => handleInputChange('alamat', e.target.value)}
                  placeholder="Nama jalan, nomor rumah, dusun"
                  className="rounded-xl h-11 text-sm bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Kecamatan *</Label>
                  <Input
                    value={formData.kecamatan}
                    onChange={(e) => handleInputChange('kecamatan', e.target.value)}
                    placeholder="Kecamatan"
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Desa / Kelurahan *</Label>
                  <Input
                    value={formData.kelurahan}
                    onChange={(e) => handleInputChange('kelurahan', e.target.value)}
                    placeholder="Desa / Kelurahan"
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">RT / RW</Label>
                  <Input
                    value={formData.rt_rw}
                    onChange={(e) => handleInputChange('rt_rw', e.target.value)}
                    placeholder="Contoh: RT 02 / RW 04"
                    className="rounded-xl h-11 text-sm bg-slate-50"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="rounded-xl px-5 text-xs h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali
                </Button>
                <Button
                  onClick={handleNextStep}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-6 font-semibold text-xs h-11"
                >
                  Lanjut: Unggah Dokumen
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Upload Documents ── */}
        {currentStep === 4 && (
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl font-extrabold text-slate-900">
                Unggah Dokumen Persyaratan
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Format file didukung: JPG, PNG, atau PDF (Maks. 5 MB per berkas). Dokumen dapat dilengkapi nanti jika belum tersedia saat ini.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pas Foto */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <Label className="text-xs font-bold text-slate-800 block">1. Pas Foto Formal (3x4)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange('foto', e)}
                    className="text-xs bg-white rounded-xl"
                  />
                  {files.foto && <span className="text-[11px] text-emerald-700 font-medium block">✓ {files.foto.name}</span>}
                </div>

                {/* Kartu Keluarga */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <Label className="text-xs font-bold text-slate-800 block">2. Kartu Keluarga (KK)</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange('kk', e)}
                    className="text-xs bg-white rounded-xl"
                  />
                  {files.kk && <span className="text-[11px] text-emerald-700 font-medium block">✓ {files.kk.name}</span>}
                </div>

                {/* Akta Kelahiran */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <Label className="text-xs font-bold text-slate-800 block">3. Akta Kelahiran</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange('akta', e)}
                    className="text-xs bg-white rounded-xl"
                  />
                  {files.akta && <span className="text-[11px] text-emerald-700 font-medium block">✓ {files.akta.name}</span>}
                </div>

                {/* Ijazah / SKL */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <Label className="text-xs font-bold text-slate-800 block">4. Ijazah / SKL / Surat Keterangan</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange('ijazah', e)}
                    className="text-xs bg-white rounded-xl"
                  />
                  {files.ijazah && <span className="text-[11px] text-emerald-700 font-medium block">✓ {files.ijazah.name}</span>}
                </div>
              </div>

              {/* Piagam Prestasi jika jalur prestasi */}
              {formData.track === 'prestasi' && (
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-2 mt-3">
                  <Label className="text-xs font-bold text-amber-900 block">5. Sertifikat / Piagam Prestasi (Wajib Jalur Prestasi)</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange('prestasi', e)}
                    className="text-xs bg-white rounded-xl"
                  />
                  {files.prestasi && <span className="text-[11px] text-emerald-700 font-medium block">✓ {files.prestasi.name}</span>}
                </div>
              )}

              <div className="p-4 rounded-2xl bg-slate-100 text-xs text-slate-600 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  Dengan mengirim formulir ini, Anda menyatakan bahwa seluruh data yang diisikan adalah benar dan dapat dipertanggungjawabkan untuk keperluan PPDB LP Ma'arif NU Cilacap.
                </span>
              </div>

              <div className="pt-4 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                  className="rounded-xl px-5 text-xs h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={registerMutation.isPending}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-8 font-bold text-xs h-11 shadow-md shadow-emerald-700/20"
                >
                  {registerMutation.isPending ? 'Mengirim Data...' : 'Kirim Pendaftaran Sekarang'}
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 5: Success & Registration Card ── */}
        {currentStep === 5 && registeredResult && (
          <Card className="rounded-3xl border-emerald-200 shadow-xl bg-white overflow-hidden text-center p-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs px-3 py-1 font-bold mb-2">
              Pendaftaran Berhasil Dikirim
            </Badge>

            <h2 className="text-2xl font-black text-slate-900 mb-1">
              Alhamdulillah, Data Anda Telah Diterima!
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
              Simpan Nomor Registrasi berikut untuk melacak status seleksi dan verifikasi berkas oleh panitia madrasah.
            </p>

            {/* Registration Number Box */}
            <div className="max-w-md mx-auto p-5 rounded-2xl bg-emerald-50/80 border-2 border-dashed border-emerald-300 mb-6 text-left space-y-3">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Nomor Registrasi Resmi
              </span>
              <div className="flex items-center justify-between">
                <span className="text-xl sm:text-2xl font-black text-emerald-950 tracking-wider font-mono">
                  {registeredResult.registration_number}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyRegNumber}
                  className="rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-100 h-9"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              <div className="border-t border-emerald-200/60 pt-3 text-xs text-slate-700 space-y-1">
                <p>• <strong>Nama:</strong> {registeredResult.nama_lengkap}</p>
                <p>• <strong>Madrasah Tujuan:</strong> {registeredResult.school_name}</p>
                <p>• <strong>Jalur:</strong> {registeredResult.track?.toUpperCase()}</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => navigate(`/ppdb/status?reg=${registeredResult.registration_number}`)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-6 font-semibold text-xs h-11"
              >
                <FileText className="w-4 h-4 mr-2" />
                Buka Status Pendaftaran
              </Button>
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="rounded-xl px-5 text-xs h-11 border-slate-300"
              >
                <Printer className="w-4 h-4 mr-2 text-slate-600" />
                Cetak Halaman Ini
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

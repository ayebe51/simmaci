import React, { useState } from 'react';
import { useDebounce } from "@/hooks/useDebounce"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { Edit, Trash, Trash2, QrCode, Plus, Camera, Loader2, CheckCircle2, Search } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as faceapi from 'face-api.js';

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isFaceOpen, setIsFaceOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);

  const [formData, setFormData] = useState({
    nama: '',
    nomor_id: '',
    jabatan: '',
    divisi: '',
    telepon: '',
    email: '',
    password: '',
    is_active: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['staffs', { search: debouncedSearch, page }],
    queryFn: () => staffApi.list({ search: debouncedSearch, page }),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => selectedStaff ? staffApi.update(selectedStaff.id, data) : staffApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffs'] });
      setIsFormOpen(false);
      toast.success('Data staff berhasil disimpan');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Terjadi kesalahan'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => staffApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffs'] });
      toast.success('Staff berhasil dihapus');
    },
  });

  const generateQrMutation = useMutation({
    mutationFn: (id: number) => staffApi.generateQr(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffs'] });
      toast.success('QR Code baru berhasil di-generate');
      setIsQrOpen(false);
    },
  });

  const openForm = (staff: any = null) => {
    setSelectedStaff(staff);
    if (staff) {
      setFormData({
        nama: staff.nama,
        nomor_id: staff.nomor_id || '',
        jabatan: staff.jabatan || '',
        divisi: staff.divisi || '',
        telepon: staff.telepon || '',
        email: staff.user?.email || '',
        password: '',
        is_active: staff.is_active,
      });
    } else {
      setFormData({
        nama: '',
        nomor_id: '',
        jabatan: '',
        divisi: '',
        telepon: '',
        email: '',
        password: '',
        is_active: true,
      });
    }
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const openQr = (staff: any) => {
    setSelectedStaff(staff);
    setIsQrOpen(true);
  };

  const openFace = (staff: any) => {
    setSelectedStaff(staff);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  return (
    <div className="space-y-6 pb-10">
      <SoftPageHeader
        title="Manajemen Staff"
        description="Kelola data staff PCNU / LP Ma'arif Cilacap"
        actions={[
          { label: 'Tambah Staff', onClick: () => openForm(), variant: 'default', icon: <Plus className="h-4 w-4" /> }
        ]}
      />

      <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="p-6 border-b border-slate-100">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-4 top-3 h-4 w-4 text-emerald-500" />
            <Input 
              placeholder="Cari nama staff..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="pl-11 h-10 rounded-2xl bg-white border-slate-200 focus-visible:ring-emerald-500 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead className="py-3 px-4 font-bold text-emerald-800">Nama</TableHead>
                <TableHead className="py-3 px-4 font-bold text-emerald-800">Nomor ID</TableHead>
                <TableHead className="py-3 px-4 font-bold text-emerald-800">Jabatan / Divisi</TableHead>
                <TableHead className="py-3 px-4 font-bold text-emerald-800">Kontak</TableHead>
                <TableHead className="py-3 px-4 font-bold text-emerald-800">Akun</TableHead>
                <TableHead className="py-3 px-4 font-bold text-emerald-800">Status</TableHead>
                <TableHead className="py-3 px-4 font-bold text-emerald-800 text-right rounded-tr-xl">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-emerald-500" /></TableCell></TableRow>
              ) : data?.data?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-48 text-center text-slate-500 font-semibold">Tidak ada data staff</TableCell></TableRow>
              ) : (
                data?.data?.map((staff: any) => (
                  <TableRow key={staff.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-4 py-3 font-semibold text-slate-900 text-sm">{staff.nama}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-600">{staff.nomor_id || '-'}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{staff.jabatan}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{staff.divisi}</div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-600">{staff.telepon}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-600">{staff.user?.email || '-'}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge className={staff.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold px-2.5 py-0.5" : "bg-slate-50 text-slate-600 border-slate-200 text-xs font-semibold px-2.5 py-0.5"}>
                        {staff.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex gap-1 items-center justify-end">
                        <Button variant="ghost" size="icon-sm" onClick={() => openFace(staff)} title="Daftarkan Wajah" className={staff.face_descriptor ? "text-emerald-600" : "text-slate-600"}>
                          <Camera className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => openQr(staff)} title="QR Code">
                          <QrCode className="h-4 w-4 text-purple-600" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => openForm(staff)} title="Edit Staff">
                          <Edit className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(staff)} title="Hapus Staff">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Hapus Staff"
        description={`Apakah Anda yakin ingin menghapus ${confirmDelete?.nama}? Data yang dihapus tidak dapat dikembalikan.`}
        confirmText="Hapus"
        variant="destructive"
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedStaff ? 'Edit Staff' : 'Tambah Staff'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input required value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Nomor ID</Label>
              <div className="flex gap-2">
                <Input value={formData.nomor_id} onChange={(e) => setFormData({...formData, nomor_id: e.target.value})} placeholder="Contoh: NIK / NIPY" />
                <Button type="button" variant="outline" onClick={() => {
                  const prefix = "LPM-STF-";
                  const year = new Date().getFullYear();
                  const rnd = Math.floor(Math.random() * 9000 + 1000);
                  setFormData({...formData, nomor_id: `${prefix}${year}${rnd}`});
                }}>Auto</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jabatan</Label>
                <Input value={formData.jabatan} onChange={(e) => setFormData({...formData, jabatan: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Divisi</Label>
                <Input value={formData.divisi} onChange={(e) => setFormData({...formData, divisi: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nomor HP</Label>
              <Input value={formData.telepon} onChange={(e) => setFormData({...formData, telepon: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Email (Untuk Login)</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} disabled={!!selectedStaff && !!selectedStaff.user} />
            </div>
            {!selectedStaff && (
              <div className="space-y-2">
                <Label>Password Login</Label>
                <Input type="password" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({...formData, is_active: v})} />
              <Label>Status Aktif</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="sm:max-w-md flex flex-col items-center justify-center">
          <DialogHeader>
            <DialogTitle className="text-center no-print">QR Code Staff</DialogTitle>
          </DialogHeader>
          <div id="staff-qr-print" className="p-8 bg-white rounded-xl shadow-sm border flex flex-col items-center space-y-4">
            <style>
              {`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #staff-qr-print, #staff-qr-print * {
                    visibility: visible;
                  }
                  #staff-qr-print {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    border: 2px solid #e2e8f0 !important;
                    border-radius: 16px !important;
                    box-shadow: none !important;
                    width: 300px;
                    padding: 40px;
                    margin: 0;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `}
            </style>
            {selectedStaff?.qr_code ? (
              <>
                <QRCodeSVG value={selectedStaff.qr_code} size={256} level="H" />
                <p className="font-semibold">{selectedStaff.nama}</p>
                {selectedStaff.nomor_id && <p className="text-sm font-medium">{selectedStaff.nomor_id}</p>}
                <p className="text-sm text-muted-foreground">{selectedStaff.jabatan}</p>
              </>
            ) : (
              <p>QR Code belum di-generate.</p>
            )}
          </div>
          <DialogFooter className="w-full sm:justify-between flex-row no-print mt-4">
            <Button variant="outline" onClick={() => window.print()}>Cetak</Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (confirm('Generate ulang akan membuat QR Code lama tidak berlaku. Yakin?')) {
                  generateQrMutation.mutate(selectedStaff.id);
                }
              }}
              disabled={generateQrMutation.isPending}
            >
              Generate Ulang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Face Enrollment Dialog */}
      {isFaceOpen && selectedStaff && (
        <StaffFaceEnrollmentDialog 
          staff={selectedStaff} 
          onClose={() => setIsFaceOpen(false)} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['staffs'] });
            setIsFaceOpen(false);
          }} 
        />
      )}
    </div>
  );
}

function StaffFaceEnrollmentDialog({ staff, onClose, onSuccess }: { staff: any, onClose: () => void, onSuccess: () => void }) {
  const [status, setStatus] = useState<'loading_models'|'ready'|'scanning'|'success'|'error'>('loading_models');
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        if (mounted) {
          setStatus('ready');
        }
      } catch (err) {
        if (mounted) {
          setStatus('error');
          setErrorMsg('Gagal memuat model AI. Pastikan folder /models tersedia.');
        }
      }
    };
    loadModels();
    return () => {
      mounted = false;
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg('Gagal mengakses kamera. Periksa izin browser.');
    }
  };

  React.useEffect(() => {
    if (status === 'ready') {
      startCamera();
    }
  }, [status]);

  React.useEffect(() => {
    if (streamRef.current && videoRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  });

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const captureFace = async () => {
    if (!videoRef.current || status !== 'ready') return;
    setStatus('scanning');
    
    try {
      // Tunggu sebentar agar kamera stabil
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error('Wajah tidak terdeteksi. Pastikan pencahayaan cukup dan wajah terlihat jelas.');
        setStatus('ready');
        return;
      }

      // Format Descriptor to Array
      const descriptorArray = Array.from(detection.descriptor);
      
      // Kirim ke backend
      await staffApi.saveFace(staff.id, { face_descriptor: descriptorArray });
      toast.success('Wajah berhasil didaftarkan!');
      setStatus('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      toast.error('Gagal memproses wajah: ' + (err?.response?.data?.message || err.message));
      setStatus('ready');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md flex flex-col items-center">
        <DialogHeader>
          <DialogTitle>Daftarkan Wajah - {staff.nama}</DialogTitle>
        </DialogHeader>

        <div className="w-full flex flex-col items-center justify-center p-4 gap-4">
          {status === 'loading_models' && (
            <div className="flex flex-col items-center gap-2 text-slate-500 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p>Memuat Model AI Biometrik...</p>
            </div>
          )}
          
          {status === 'error' && (
            <div className="text-red-500 text-center py-10">
              <p className="font-bold">Error</p>
              <p className="text-sm">{errorMsg}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-2 text-emerald-500 py-10">
              <CheckCircle2 className="h-12 w-12" />
              <p className="font-bold">Wajah Tersimpan!</p>
            </div>
          )}

          {(status === 'ready' || status === 'scanning') && (
            <>
              <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-slate-200">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                {status === 'scanning' && (
                  <div className="absolute inset-0 border-4 border-blue-500 border-dashed rounded-full animate-spin-slow" />
                )}
              </div>
              <p className="text-sm text-slate-500 text-center">
                Posisikan wajah Anda di tengah lingkaran dan pastikan pencahayaan cukup terang.
              </p>
              <Button 
                onClick={captureFace} 
                disabled={status === 'scanning'}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 font-bold"
              >
                {status === 'scanning' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                {status === 'scanning' ? 'Memindai...' : 'Ambil Data Wajah'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

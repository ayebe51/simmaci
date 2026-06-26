import React, { useState } from 'react';
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
import { Edit, Trash, QrCode, Plus, Camera, Loader2, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as faceapi from 'face-api.js';

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
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
    queryKey: ['staffs', { search, page }],
    queryFn: () => staffApi.list({ search, page }),
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
    setIsFaceOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Staff</h1>
          <p className="text-muted-foreground">Kelola data staff PCNU / LP Ma'arif Cilacap</p>
        </div>
        <Button onClick={() => openForm()}><Plus className="mr-2 h-4 w-4" /> Tambah Staff</Button>
      </div>

      <div className="flex items-center space-x-2">
        <Input 
          placeholder="Cari nama staff..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Nomor ID</TableHead>
              <TableHead>Jabatan / Divisi</TableHead>
              <TableHead>Kontak</TableHead>
              <TableHead>Akun</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center">Loading...</TableCell></TableRow>
            ) : data?.data?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center">Tidak ada data staff</TableCell></TableRow>
            ) : (
              data?.data?.map((staff: any) => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">{staff.nama}</TableCell>
                  <TableCell>{staff.nomor_id || '-'}</TableCell>
                  <TableCell>
                    <div className="text-sm">{staff.jabatan}</div>
                    <div className="text-xs text-muted-foreground">{staff.divisi}</div>
                  </TableCell>
                  <TableCell>{staff.telepon}</TableCell>
                  <TableCell>{staff.user?.email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={staff.is_active ? 'default' : 'secondary'}>
                      {staff.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openFace(staff)} title="Daftarkan Wajah" className={staff.face_descriptor ? "text-emerald-500" : ""}>
                      <Camera className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openQr(staff)} title="QR Code">
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openForm(staff)} title="Edit">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => {
                      if (confirm('Yakin hapus staff ini?')) deleteMutation.mutate(staff.id);
                    }}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
          startCamera();
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

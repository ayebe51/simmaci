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
import { Edit, Trash, QrCode, Plus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);

  const [formData, setFormData] = useState({
    nama: '',
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
              <TableHead>Jabatan / Divisi</TableHead>
              <TableHead>Kontak</TableHead>
              <TableHead>Akun</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
            ) : data?.data?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center">Tidak ada data staff</TableCell></TableRow>
            ) : (
              data?.data?.map((staff: any) => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">{staff.nama}</TableCell>
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
                    <Button variant="outline" size="sm" onClick={() => openQr(staff)}>
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openForm(staff)}>
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
            <DialogTitle className="text-center">QR Code Staff</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-white rounded-xl shadow-sm border flex flex-col items-center space-y-4">
            {selectedStaff?.qr_code ? (
              <>
                <QRCodeSVG value={selectedStaff.qr_code} size={256} level="H" />
                <p className="font-semibold">{selectedStaff.nama}</p>
                <p className="text-sm text-muted-foreground">{selectedStaff.jabatan}</p>
              </>
            ) : (
              <p>QR Code belum di-generate.</p>
            )}
          </div>
          <DialogFooter className="w-full sm:justify-between flex-row">
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
    </div>
  );
}

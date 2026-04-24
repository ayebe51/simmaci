import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Search, Trash2, Edit, AlertTriangle, XCircle, UserX, Download, Loader2, ShieldCheck, UserCircle2 } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import * as XLSX from "xlsx"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { userApi, schoolApi } from "@/lib/api"

export default function UserListPage() {
  const [user] = useState<any>(() => {
    const u = localStorage.getItem("user_data")
    try {
      return u ? JSON.parse(u) : null
    } catch (e) {
      return null
    }
  })

  const navigate = useNavigate()

  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [confirmDelete, setConfirmDelete] = useState<any>(null)
  
  // 🔥 REST API QUERIES
  const { data: usersRes, isLoading, refetch } = useQuery({
    queryKey: ['users', searchTerm],
    queryFn: () => userApi.list({ search: searchTerm, per_page: 100 })
  })

  const { data: schoolsRes } = useQuery({
    queryKey: ['schools-light'],
    queryFn: () => schoolApi.list({ per_page: 500 })
  })

  const users = Array.isArray(usersRes) ? usersRes : (usersRes?.data || [])
  const schools = Array.isArray(schoolsRes) ? schoolsRes : (schoolsRes?.data || [])
  
  // Form State
  const [formData, setFormData] = useState({
      name: "",
      email: "",
      password: "",
      role: "operator",
      school_id: "" as string | number,
      is_active: true
  })

  // Strict check: only super_admin can access user management
  if (user?.role !== "super_admin") {
    navigate("/dashboard", { replace: true })
    return null
  }

  const handleSave = async () => {
      if (!formData.name || !formData.email) return toast.error("Nama dan Username wajib diisi")
      
      const payload = { ...formData }
      if (editingUser && !formData.password) delete (payload as any).password

      try {
          if (editingUser) {
              await userApi.update(editingUser.id, payload)
              toast.success("User diperbarui")
          } else {
              await userApi.create(payload)
              toast.success("User baru ditambahkan")
          }
          setIsDialogOpen(false)
          refetch()
      } catch (err: any) {
          toast.error(err.response?.data?.message || "Gagal menyimpan user")
      }
  }

  const handleDelete = async (user: any) => {
    try {
        await userApi.delete(user.id)
        toast.success("User dinonaktifkan")
        refetch()
    } catch (err: any) {
        toast.error("Gagal menghapus")
    }
  }

  const openEdit = (user: any) => {
      setEditingUser(user)
      setFormData({ 
        name: user.name, 
        email: user.email, 
        password: "", 
        role: user.role, 
        school_id: user.school_id || "", 
        is_active: !!user.is_active 
      })
      setIsDialogOpen(true)
  }

  const handleExportExcel = async () => {
    try {
      // Fetch ALL users without pagination limit for export
      const allUsersRes = await userApi.list({ per_page: 9999 })
      const allUsers = Array.isArray(allUsersRes) ? allUsersRes : (allUsersRes?.data || [])
      
      const exportData = allUsers.map((u: any, index: number) => ({
        "No": index + 1,
        "Nama": u.name,
        "Username / Email": u.email,
        "Password": u.role === 'operator' 
          ? (u.email?.split('@')[0] || '-')
          : '(tidak ditampilkan)',
        "Role": u.role,
        "Sekolah": u.school?.nama || "-",
        "Status": u.is_active ? "Aktif" : "Non-Aktif"
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
      XLSX.writeFile(workbook, `Akun_Users_SIMMACI.xlsx`);
      toast.success(`${allUsers.length} akun berhasil diexport`)
    } catch {
      toast.error("Gagal export data")
    }
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">Akses & Manajemen Akun</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
               <ShieldCheck className="w-3 h-3 text-emerald-500" /> Kontrol Keamanan & Hak Akses Hirarki Pengguna
            </p>
        </div>
        <div className="flex gap-4">
            <Button variant="outline" onClick={handleExportExcel} className="h-14 rounded-2xl px-8 border-slate-200 font-black uppercase text-[10px] tracking-widest shadow-sm">Export</Button>
            <Button onClick={() => { setEditingUser(null); setFormData({name:"", email:"", password:"", role:"operator", school_id:"", is_active:true}); setIsDialogOpen(true)}} className="h-14 rounded-2xl px-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-100">
                <Plus className="w-5 h-5 mr-2" /> Tambah Akun
            </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/20">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Cari filter nama / username..." className="h-12 pl-12 rounded-xl border-slate-200 bg-white font-bold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
        </div>
        <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                    <TableRow>
                        <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Identitas User</TableHead>
                        <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Akses Login</TableHead>
                        <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Role & Privilege</TableHead>
                        <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Unit Kerja</TableHead>
                        <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Manajemen</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-24 animate-pulse uppercase font-black text-slate-300 text-xs italic tracking-widest">Syncing Identity Data...</TableCell></TableRow>
                    ) : users.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-24 font-bold text-slate-300 text-xs italic">User database blank</TableCell></TableRow>
                    ) : users.map((u: any) => (
                        <TableRow key={u.id} className="hover:bg-slate-50/30 transition-colors group">
                            <TableCell className="p-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <UserCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-800 text-sm tracking-tight">{u.name}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{u.is_active ? 'Status: Aktif' : 'Status: Non-Aktif'}</div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="p-8 font-bold text-slate-500 text-xs tracking-tight">{u.email}</TableCell>
                            <TableCell className="p-8">
                                <Badge className={cn("rounded-lg text-[9px] font-black uppercase px-3 py-1", 
                                    u.role === 'super_admin' ? 'bg-rose-100 text-rose-700' : 
                                    u.role === 'admin_yayasan' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                                )}>{u.role}</Badge>
                            </TableCell>
                            <TableCell className="p-8 font-bold text-slate-400 text-[11px] italic uppercase tracking-wider">{u.school?.nama || 'Akses Global'}</TableCell>
                            <TableCell className="p-8 text-right">
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)} className="h-10 w-10 rounded-xl hover:bg-blue-50 text-blue-600"><Edit className="w-4 h-4" /></Button>
                                    {u.role !== 'super_admin' && (
                                        <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(u)} className="h-10 w-10 rounded-xl hover:bg-rose-50 text-rose-600"><Trash2 className="w-4 h-4" /></Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-xl rounded-[2.5rem] p-10 border-0 shadow-2xl">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">{editingUser ? "Modifikasi Akun" : "Akun Baru"}</DialogTitle>
                  <DialogDescription className="font-bold text-slate-400 text-[10px] uppercase">Konfigurasi Parameter Akses Engine</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-10">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Nama Tampilan</Label>
                          <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-slate-200 font-bold" />
                      </div>
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Username Login</Label>
                          <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-12 rounded-xl border-slate-200 font-bold" />
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Password Access</Label>
                      <Input type="password" placeholder={editingUser ? "Kosongkan jika tidak diubah" : "Password minimal 6 karakter"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="h-12 rounded-xl border-slate-200 font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Otoritas / Role</Label>
                          <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                              <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                  <SelectItem value="operator">Operator Sekolah</SelectItem>
                                  <SelectItem value="admin_yayasan">Admin Yayasan</SelectItem>
                                  <SelectItem value="super_admin">Super Administrator</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Lingkup Unit Kerja</Label>
                          <Select value={formData.school_id?.toString() || "none"} onValueChange={v => setFormData({...formData, school_id: v === 'none' ? "" : v})}>
                              <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold"><SelectValue placeholder="Pilih Sekolah" /></SelectTrigger>
                              <SelectContent className="rounded-xl max-h-64">
                                  <SelectItem value="none">Akses Global / Yayasan</SelectItem>
                                  {schools.map((s: any) => (
                                      <SelectItem key={s.id} value={s.id.toString()}>{s.nama}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400">Abort</Button>
                  <Button onClick={handleSave} className="h-14 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100">Simpan Akun</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      {/* ── Confirm Delete User ── */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}
        title="Hapus Akses User"
        description={`Yakin ingin menghapus akses untuk ${confirmDelete?.name}? User tidak akan bisa login lagi.`}
        confirmText="Hapus"
        variant="destructive"
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete)
          setConfirmDelete(null)
        }}
      />
    </div>
  )
}

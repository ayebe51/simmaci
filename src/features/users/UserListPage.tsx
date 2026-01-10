import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Search, Trash2, Edit, Save, X } from "lucide-react"
import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import SoftPageHeader from "@/components/ui/SoftPageHeader"

interface User {
  id: string
  name: string
  email: string // Acts as username for login
  password?: string
  role: 'super_admin' | 'admin' | 'operator'
  status: 'active' | 'inactive'
  unitKerja?: string
}

import { api } from "@/lib/api"

export default function UserListPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  // Form State
  const [formData, setFormData] = useState<Partial<User>>({
      name: "",
      email: "",
      password: "",
      role: "operator",
      unitKerja: "",
      status: "active"
  })

  const fetchUsers = async () => {
      try {
          const data = await api.getUsers() // Returns backend user entities
          console.log("DEBUG: Users Data:", data);

          if (!Array.isArray(data)) {
             console.error("Data users is not array:", data);
             // handle edge case where data might be wrapped
             const realData = (data as any).data || data;
             if(Array.isArray(realData)) {
                 // proceed with realData
                 const mapped: User[] = realData.map((u: any) => ({
                    id: u.id,
                    name: u.name || u.username,
                    email: u.username,
                    role: u.role,
                    status: "active",
                    unitKerja: u.unitKerja
                }))
                setUsers(mapped)
                return;
             }
             
             toast.error("Format data user salah (Not Array)");
             return;
          }

          // Map backend to frontend
          const mapped: User[] = data.map((u: any) => ({
              id: u.id,
              name: u.name || u.username, // Fallback
              email: u.username, // Username acts as email/login
              role: u.role,
              status: "active", // Default since backend doesn't have status yet
              unitKerja: u.unitKerja
          }))
          setUsers(mapped)
      } catch (err: any) {
          console.error("Fetch Users Error:", err)
          toast.error("Gagal load user: " + (err.response?.data?.message || err.message))
      }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Handle Add/Edit
  const handleSave = async () => {
      if (!formData.name || !formData.email) {
          toast.error("Nama dan Username wajib diisi")
          return
      }

      try {
          if (editingUser) {
              // Update logic (Implement PATCH api later)
              toast.info("Fitur Edit belum tersedia di Backend (Demo only)")
          } else {
              // Create logic
              if (!formData.password) {
                  toast.error("Password wajib untuk user baru")
                  return
              }
              await api.register({
                  username: formData.email,
                  password: formData.password,
                  name: formData.name,
                  unitKerja: formData.unitKerja,
                  role: formData.role
              })
          }
          setIsDialogOpen(false)
          fetchUsers() // Refresh
          setEditingUser(null)
          setFormData({ name: "", email: "", password: "", role: "operator", unitKerja: "", status: "active" })
          if (!editingUser) toast.success("User berhasil dibuat")
      } catch (err: any) {
         toast.error(err.message || "Gagal menyimpan user")
      }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Hapus user ini?")) {
        // Implement DELETE api later
         toast.info("Fitur Hapus belum tersedia di Backend (Demo only)")
    }
  }

  const openEdit = (user: User) => {
      setEditingUser(user)
      setFormData({ ...user, password: "" }) // Don't show password, require new one only if changing
      setIsDialogOpen(true)
  }

  const resetForm = () => {
      setEditingUser(null)
      setFormData({ name: "", email: "", password: "", role: "operator", unitKerja: "", status: "active" })
  }

  const filtered = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'super_admin': return <Badge variant="destructive">Super Admin</Badge>
      case 'admin': return <Badge variant="secondary">Admin</Badge>
      default: return <Badge variant="outline">Operator</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <SoftPageHeader
        title="Manajemen User"
        description="Kelola akses Operator Sekolah dan Admin"
      >
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger asChild>
            <button
              onClick={resetForm}
              className="group cursor-pointer rounded-lg bg-pastel-purple p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:bg-pastel-lavender"
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pastel-lavender">
                  <Plus className="h-5 w-5 text-gray-700" />
                </div>
                <span className="text-sm font-medium text-gray-700">Tambah User</span>
              </div>
            </button>
          </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle>
                        <DialogDescription>
                            Operator Sekolah membutuhkan akun untuk login dan mengajukan SK.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Nama Lengkap / Sekolah</Label>
                            <Input 
                                placeholder="Contoh: Operator MI Ma'arif 01" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Username / Email Login</Label>
                            <Input 
                                placeholder="operator.mi01" 
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>{editingUser ? "Password Baru (Biarkan kosong jika tetap)" : "Password"}</Label>
                            <Input 
                                type="password"
                                placeholder="***" 
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Role</Label>
                            <Select 
                                value={formData.role} 
                                onValueChange={(v: any) => setFormData({...formData, role: v})}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="operator">Operator Sekolah</SelectItem>
                                    <SelectItem value="admin">Admin Wilayah</SelectItem>
                                    <SelectItem value="super_admin">Super Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Unit Kerja (Opsional)</Label>
                            <Input 
                                placeholder="Nama Sekolah / Unit" 
                                value={formData.unitKerja}
                                onChange={e => setFormData({...formData, unitKerja: e.target.value})}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleSave}>Simpan User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SoftPageHeader>
      

      <Card>
        <CardHeader className="pb-3">
             <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari user (nama / username)..."
                className="pl-9 max-w-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Username / Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Unit Kerja</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                        <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.email}</TableCell>
                        <TableCell>{getRoleBadge(item.role)}</TableCell>
                        <TableCell>{item.unitKerja || "-"}</TableCell>
                        <TableCell className="text-right space-x-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            {/* Prevent deleting the last super admin or self? Simplified logic: just hide delete for super_admin for safety */}
                            {item.role !== 'super_admin' && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(item.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  )
}

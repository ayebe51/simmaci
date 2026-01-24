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
import { Plus, Search, Trash2, Edit } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
import { Doc, Id } from "../../../convex/_generated/dataModel"

interface User {
  id: string
  name: string
  email: string // Acts as username for login
  password?: string
  role: 'super_admin' | 'admin' | 'operator'
  status: 'active' | 'inactive'
  unitKerja?: string
}

export default function UserListPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  // 🔥 CONVEX QUERIES
  const convexUsers = useQuery(convexApi.auth.listUsers)
  const convexSchools = useQuery(convexApi.schools.list, {})
  const updateUserSchoolMutation = useMutation(convexApi.auth.updateUserSchool)
  
  // Map Convex users to frontend format
  const users: User[] = (convexUsers || []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as 'super_admin' | 'admin' | 'operator',
    status: u.isActive ? "active" : "inactive",
    unitKerja: u.unitKerja
  }))

  const schools = (convexSchools || []).map((s: Doc<"schools">) => s.nama)
  
  // Form State
  const [formData, setFormData] = useState<Partial<User>>({
      name: "",
      email: "",
      password: "",
      role: "operator",
      unitKerja: "",
      status: "active"
  })

  // Handle Add/Edit
  const handleSave = async () => {
      if (!formData.name || !formData.email) {
          toast.error("Nama dan Username wajib diisi")
          return
      }

      try {
          // TODO: Implement user creation via Convex mutation
          toast.info("Fitur tambah/edit user via UI coming soon. Gunakan Convex dashboard untuk sekarang.")
          
          setIsDialogOpen(false)
          setEditingUser(null)
          setFormData({ name: "", email: "", password: "", role: "operator", unitKerja: "", status: "active" })
      } catch (err) {
         toast.error((err as Error).message || "Gagal menyimpan user")
      }
  }

  const handleDelete = async (id?: string) => {
    // TODO: Implement delete via Convex mutation
    console.log("Deleting user", id)
    toast.info("Fitur hapus user coming soon")
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
                                onValueChange={(v) => setFormData({...formData, role: v as User['role']})}
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
                      <TableHead>Assign Sekolah</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                        <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.email}</TableCell>
                        <TableCell>{getRoleBadge(item.role)}</TableCell>
                        <TableCell>
                          {item.role === "operator" ? (
                            <Select 
                              value={item.unitKerja || ""} 
                              onValueChange={async (schoolName) => {
                                try {
                                  await updateUserSchoolMutation({ 
                                    userId: item.id as Id<"users">,
                                    schoolName: schoolName || undefined 
                                  })
                                  toast.success(`✅ ${item.name} di-assign ke ${schoolName}`)
                                } catch {
                                  toast.error("Gagal assign sekolah")
                                }
                              }}
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Pilih Sekolah..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">- Tidak Di-assign -</SelectItem>
                                {schools.map(school => (
                                  <SelectItem key={school} value={school}>{school}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
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

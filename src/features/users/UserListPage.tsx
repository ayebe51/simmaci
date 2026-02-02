import { useState } from "react";
import SoftPageHeader from "@/components/ui/SoftPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Edit, UserPlus, CheckCircle2, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function UserListPage() {
  // Pagination State
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]); // History of start cursors

  const results = useQuery(api.auth.listUsersPage, { 
    paginationOpts: { cursor: currentCursor, numItems: 20 } 
  });
  
  const users = results?.page;
  const filteredUsers = users?.filter((user) => // Note: Filter only applies to current page
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleNext = () => {
    if (results?.continueCursor) {
      setCursorStack([...cursorStack, currentCursor]);
      setCurrentCursor(results.continueCursor);
    }
  };

  const handlePrev = () => {
    if (cursorStack.length > 0) {
      const prevCursor = cursorStack[cursorStack.length - 1];
      setCursorStack(cursorStack.slice(0, -1));
      setCurrentCursor(prevCursor);
    }
  };
  const updateUser = useMutation(api.auth.updateUser);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Form states for editing
  const [editRole, setEditRole] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");

  const filteredUsers = users?.filter((user) =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditUnit(user.unitKerja || "");
    setEditIsActive(user.isActive);
    setEditPassword(""); // Blank default
    setIsEditOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    try {
      await updateUser({
        userId: editingUser.id as Id<"users">,
        role: editRole,
        unit: editUnit || undefined, // Send undefined if empty string
        isActive: editIsActive,
        password: editPassword || undefined, // Only update if typed
      });
      toast.success("User updated successfully");
      setIsEditOpen(false);
    } catch (error) {
      toast.error("Failed to update user");
      console.error(error);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin": return "bg-purple-100 text-purple-700 hover:bg-purple-100";
      case "admin": return "bg-blue-100 text-blue-700 hover:bg-blue-100";
      case "operator": return "bg-green-100 text-green-700 hover:bg-green-100";
      default: return "bg-gray-100 text-gray-700 hover:bg-gray-100";
    }
  };

  return (
    <div className="space-y-6">
      <SoftPageHeader
        title="Manajemen User"
        description="Kelola akses Operator Sekolah dan Admin"
      >
        {/* <Button><UserPlus className="mr-2 h-4 w-4" /> Tambah User</Button> */}
      </SoftPageHeader>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Daftar Pengguna</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Cari nama atau email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Unit Kerja / Sekolah</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.unitKerja || "-"}</TableCell>
                  <TableCell>
                    {user.isActive ? (
                        <div className="flex items-center text-green-600 text-sm">
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Aktif
                        </div>
                    ) : (
                        <div className="flex items-center text-red-500 text-sm">
                            <XCircle className="w-4 h-4 mr-1" /> Non-Aktif
                        </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(user)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Tidak ada user ditemukan
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls (Standard Previous/Next) */}
          <div className="flex justify-center items-center gap-4 py-4 border-t">
            <Button 
              variant="outline" 
              onClick={handlePrev}
              disabled={cursorStack.length === 0}
            >
              Sebelumnya
            </Button>
            <span className="text-sm text-gray-500">
               Halaman {cursorStack.length + 1}
            </span>
            <Button 
              variant="outline" 
              onClick={handleNext}
              disabled={!results?.isDone ? false : true} // isDone=true means no more items? Wait.
              // Convex paginate: isDone means "no more items AFTER this page".
              // But if page is full, continueCursor is present.
              // usually check !results.isDone
            >
              Selanjutnya
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Nama</Label>
                    <Input value={editingUser?.name || ""} disabled className="bg-gray-100" />
                </div>
                <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={editingUser?.email || ""} disabled className="bg-gray-100" />
                </div>
                <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={editRole} onValueChange={setEditRole}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="operator">Operator Sekolah</SelectItem>
                            <SelectItem value="admin">Admin Wilayah</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="viewer">Viewer (Read Only)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Unit Kerja (Nama Sekolah)</Label>
                    <Input 
                        placeholder="Misal: MI Maarif NU 1..." 
                        value={editUnit} 
                        onChange={(e) => setEditUnit(e.target.value)} 
                    />
                    <p className="text-xs text-gray-500">Kosongkan jika Admin Wilayah</p>
                </div>
                <div className="space-y-2">
                    <Label>Status Akun</Label>
                    <Select value={editIsActive ? "active" : "inactive"} onValueChange={(val) => setEditIsActive(val === "active")}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Aktif</SelectItem>
                            <SelectItem value="inactive">Non-Aktif (Blokir)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2 pt-2 border-t">
                    <Label>Reset Password (Opsional)</Label>
                    <Input 
                        type="password"
                        placeholder="Isi untuk ganti password..." 
                        value={editPassword} 
                        onChange={(e) => setEditPassword(e.target.value)} 
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
                <Button onClick={handleSaveUser}>Simpan Perubahan</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

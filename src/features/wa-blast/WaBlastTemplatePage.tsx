import { useState } from "react"
import { Plus, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TemplateForm } from "./components/TemplateForm"
import { useWaBlastTemplates } from "./hooks/useWaBlastTemplates"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function WaBlastTemplatePage() {
  const { data: templates, isLoading, refetch } = useWaBlastTemplates()
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [deletingTemplate, setDeletingTemplate] = useState<any>(null)

  const handleCreateSuccess = () => {
    setShowCreateSheet(false)
    refetch()
    toast.success("Template berhasil dibuat")
  }

  const handleEditSuccess = () => {
    setEditingTemplate(null)
    refetch()
    toast.success("Template berhasil diperbarui")
  }

  const handleDelete = async () => {
    if (!deletingTemplate) return

    try {
      // Delete mutation will be handled by the hook
      await fetch(
        `${import.meta.env.VITE_API_URL}/wa-blast-templates/${deletingTemplate.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        }
      )
      toast.success("Template berhasil dihapus")
      setDeletingTemplate(null)
      refetch()
    } catch (error) {
      toast.error("Gagal menghapus template")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Template Pesan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola template pesan untuk WA Blast
          </p>
        </div>
        <Button
          onClick={() => setShowCreateSheet(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Buat Template Baru
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !templates || templates.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">Belum ada template.</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setShowCreateSheet(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Buat Template Pertama
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Template</TableHead>
                  <TableHead>Cuplikan Isi</TableHead>
                  <TableHead>Terakhir Diubah</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template: any) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="text-slate-600">
                      {template.body.substring(0, 100)}
                      {template.body.length > 100 && "..."}
                    </TableCell>
                    <TableCell>
                      {format(new Date(template.updated_at), "dd MMM yyyy", {
                        locale: id,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingTemplate(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingTemplate(template)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Sheet */}
      <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Buat Template Baru</SheetTitle>
            <SheetDescription>
              Buat template pesan yang dapat digunakan ulang untuk WA Blast
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <TemplateForm
              onSuccess={handleCreateSuccess}
              onCancel={() => setShowCreateSheet(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet
        open={!!editingTemplate}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
      >
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Template</SheetTitle>
            <SheetDescription>
              Perbarui template pesan yang sudah ada
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {editingTemplate && (
              <TemplateForm
                template={editingTemplate}
                onSuccess={handleEditSuccess}
                onCancel={() => setEditingTemplate(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog
        open={!!deletingTemplate}
        onOpenChange={(open) => !open && setDeletingTemplate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Template</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus template "
              <strong>{deletingTemplate?.name}</strong>"? Tindakan ini tidak
              dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingTemplate(null)}
            >
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

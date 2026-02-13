import { useState, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

export default function SchoolSettingsPage() {
    const settings = useQuery(api.settings_tenant.get)
    const updateSettings = useMutation(api.settings_tenant.update)
    const generateUploadUrl = useMutation(api.settings_tenant.generateUploadUrl)

    const [isSaving, setIsSaving] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSaving(true)
        
        const formData = new FormData(e.currentTarget)
        const kepalaSekolahNama = formData.get("kepalaSekolahNama") as string
        const kepalaSekolahNip = formData.get("kepalaSekolahNip") as string
        const nomorSuratFormat = formData.get("nomorSuratFormat") as string
        
        let kopSuratId = undefined

        // Handle File Upload
        const file = fileInputRef.current?.files?.[0]
        if (file) {
            try {
                const postUrl = await generateUploadUrl()
                const result = await fetch(postUrl, {
                    method: "POST",
                    headers: { "Content-Type": file.type },
                    body: file,
                })
                const { storageId } = await result.json()
                kopSuratId = storageId
            } catch (err) {
                toast.error("Gagal upload gambar header")
                console.error(err)
                setIsSaving(false)
                return
            }
        }

        try {
            await updateSettings({
                kepalaSekolahNama,
                kepalaSekolahNip,
                nomorSuratFormat,
                kopSuratId, // Only updates if new file uploaded
            })
            toast.success("Pengaturan berhasil disimpan!")
            // Optional: Reload logic or clear file input
            if (fileInputRef.current) fileInputRef.current.value = ""
        } catch (err) {
            toast.error("Gagal menyimpan pengaturan")
            console.error(err)
        } finally {
            setIsSaving(false)
        }
    }

    const [userRole, setUserRole] = useState("")
    
    // Check Role
    useState(() => {
        const u = localStorage.getItem("user")
        if (u) {
            const user = JSON.parse(u)
            setUserRole(user.role)
        }
    })

    const canEdit = userRole === "admin_yayasan" || userRole === "super_admin"

    if (settings === undefined) return <div className="p-8"><Loader2 className="animate-spin" /> Loading settings...</div>

    return (
        <div className="space-y-6 container mx-auto p-4 max-w-4xl">
            <h1 className="text-3xl font-bold tracking-tight">Pengaturan Sekolah</h1>
            
            {!canEdit && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-md text-sm">
                    <strong>Mode Lihat Saja:</strong> Pengaturan identitas madrasah (Kop Surat & Tanda Tangan) dikelola oleh Admin Yayasan. Hubungi Admin Yayasan jika ada perubahan data.
                </div>
            )}

            <p className="text-muted-foreground">
                Kustomisasi kop surat, tanda tangan, dan format dokumen untuk sekolah Anda.
            </p>

            <form onSubmit={handleSubmit}>
                <div className="grid gap-6">
                    {/* Branding Section */}
                    <Card className={!canEdit ? "opacity-80 pointer-events-none" : ""}>
                        <CardHeader>
                            <CardTitle>Kop Surat & Branding</CardTitle>
                            <CardDescription>Upload gambar header untuk SK dan surat resmi.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Label htmlFor="kopSurat">Gambar Kop Surat (Header)</Label>
                                <Input id="kopSurat" type="file" accept="image/*" ref={fileInputRef} disabled={!canEdit} />
                                <p className="text-xs text-muted-foreground">Format: PNG/JPG. Ukuran rekomendasi: 800x200px (Transparan).</p>
                            </div>

                            {settings?.kopSuratUrl && (
                                <div className="mt-4 border p-2 rounded-md bg-white">
                                    <p className="text-xs text-muted-foreground mb-2">Preview Saat Ini:</p>
                                    <img src={settings.kopSuratUrl} alt="Kop Surat" className="h-24 object-contain" />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Signatures Section */}
                    <Card className={!canEdit ? "opacity-80 pointer-events-none" : ""}>
                        <CardHeader>
                            <CardTitle>Pejabat Penandatangan</CardTitle>
                            <CardDescription>Data Kepala Madrasah untuk tanda tangan SK.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="kepalaSekolahNama">Nama Kepala Madrasah</Label>
                                <Input 
                                    id="kepalaSekolahNama" 
                                    name="kepalaSekolahNama" 
                                    defaultValue={settings?.kepalaSekolahNama || ""} 
                                    placeholder="Contoh: H. Ahmad, S.Pd.I"
                                    disabled={!canEdit}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="kepalaSekolahNip">NIP / NIY</Label>
                                <Input 
                                    id="kepalaSekolahNip" 
                                    name="kepalaSekolahNip" 
                                    defaultValue={settings?.kepalaSekolahNip || ""} 
                                    placeholder="Contoh: 19800101..."
                                    disabled={!canEdit}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Customization Section */}
                    <Card className={!canEdit ? "opacity-80 pointer-events-none" : ""}>
                        <CardHeader>
                            <CardTitle>Format Dokumen</CardTitle>
                            <CardDescription>Format penomoran surat otomatis.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="nomorSuratFormat">Format Nomor SK</Label>
                                <Input 
                                    id="nomorSuratFormat" 
                                    name="nomorSuratFormat" 
                                    defaultValue={settings?.nomorSuratFormat || "{NO}/SK/MI-MAARIF/{TH}"} 
                                    placeholder="{NO}/SK/MI-MAARIF/{TH}"
                                    disabled={!canEdit}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Gunakan <code>{`{NO}`}</code> untuk nomor urut dan <code>{`{TH}`}</code> untuk tahun.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {canEdit && (
                        <div className="flex justify-end">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Simpan Perubahan
                            </Button>
                        </div>
                    )}
                </div>
            </form>
        </div>
    )
}

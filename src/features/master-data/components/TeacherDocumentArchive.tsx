import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { Id } from "../../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Trash2, FileText, Download, Upload } from "lucide-react"

interface TeacherDocumentArchiveProps {
    teacherId: Id<"teachers">
}

export default function TeacherDocumentArchive({ teacherId }: TeacherDocumentArchiveProps) {
    // MAINTENANCE MODE
    const isMaintenance = true;
    
    // @ts-expect-error - Backend type generation is pending
    // const documents = useQuery(api.documents.getDocuments, { teacherId })
    const documents: any[] | undefined = []
    
    // Upload State
    // @ts-expect-error - Backend type generation is pending
    // const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
    // @ts-expect-error - Backend type generation is pending
    // const saveDocument = useMutation(api.documents.saveDocument);
    const generateUploadUrl = async () => { throw new Error("Maintenance"); };
    const saveDocument = async () => {};
    // @ts-expect-error - Backend type generation is pending
    const deleteDocument = useMutation(api.documents.deleteDocument);
    
    const [file, setFile] = useState<File | null>(null);
    const [type, setType] = useState("SK");
    const [isUploading, setIsUploading] = useState(false);

    async function handleUpload() {
        if (!file) return;
        setIsUploading(true);

        try {
            // 1. Get URL
            const postUrl = await generateUploadUrl();
            
            // 2. Upload File
            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });
            const { storageId } = await result.json();

            // 3. Save Metadata
            await saveDocument({
                teacherId,
                type,
                blobId: storageId,
                notes: file.name
            });

            setFile(null);
        } catch (error) {
            console.error(error);
            alert("Gagal upload dokumen");
        } finally {
            setIsUploading(false);
        }
    }

    async function handleDelete(id: string) {
        if (confirm("Hapus dokumen ini?")) {
            // @ts-expect-error - id matching
            await deleteDocument({ id });
        }
    }

    return (
        <div className="space-y-6">
            {/* Upload Section */}
            <Card className="bg-slate-50 border-dashed">
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2 col-span-2">
                            <Label>Pilih Dokumen (PDF/Gambar)</Label>
                            <Input 
                                type="file" 
                                accept="application/pdf,image/*"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Jenis Dokumen</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SK">SK Mengajar</SelectItem>
                                    <SelectItem value="KTP">KTP</SelectItem>
                                    <SelectItem value="KK">Kartu Keluarga</SelectItem>
                                    <SelectItem value="IJAZAH">Ijazah</SelectItem>
                                    <SelectItem value="SERTIFIKAT">Sertifikat</SelectItem>
                                    <SelectItem value="LAINNYA">Lainnya</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button 
                            onClick={handleUpload} 
                            disabled={!file || isUploading}
                            className="w-full"
                        >
                            {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                            Upload
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* List Section */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {documents === undefined ? (
                    <p className="text-muted-foreground p-4">Memuat data...</p>
                ) : documents.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground border rounded-lg">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>Belum ada dokumen tersimpan.</p>
                    </div>
                ) : (
                    documents.map((doc) => (
                        <Card key={doc._id} className="group relative overflow-hidden">
                            <CardContent className="p-4 flex flex-col items-center justify-center min-h-[160px] text-center">
                                {/* Type Badge */}
                                <div className="absolute top-2 left-2 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded">
                                    {doc.type}
                                </div>
                                
                                {/* Icon or Preview */}
                                {doc.url ? (
                                    <a href={doc.url} target="_blank" rel="noreferrer" className="mb-3 block">
                                         <FileText className="w-12 h-12 text-primary/50 mx-auto" />
                                    </a>
                                ) : (
                                    <div className="w-12 h-12 bg-slate-100 rounded mb-3" />
                                )}
                                
                                <p className="text-sm font-medium truncate w-full" title={doc.notes}>
                                    {doc.notes || "Dokumen"}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {new Date(doc.uploadedAt).toLocaleDateString()}
                                </p>

                                {/* Hover Actions */}
                                <div className="absolute inset-x-0 bottom-0 bg-white/90 p-2 flex justify-center gap-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                                    {doc.url && (
                                        <Button variant="outline" size="sm" asChild>
                                            <a href={doc.url} target="_blank" rel="noreferrer">
                                                <Download className="w-3 h-3" />
                                            </a>
                                        </Button>
                                    )}
                                    <Button 
                                        variant="destructive" 
                                        size="sm"
                                        onClick={() => handleDelete(doc._id)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}

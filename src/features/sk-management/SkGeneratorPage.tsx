/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileDown, FileText, Loader2 } from "lucide-react"
import { useState } from "react"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import { saveAs } from "file-saver"
import ImageModule from "docxtemplater-image-module-free"
import JSZip from "jszip"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useDepartmentConfig } from "@/hooks/useDepartmentConfig"
// import { toast } from "sonner" // Ensure you have this or use another toast lib if needed.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Helper: Convert Base64 DataURL to ArrayBuffer (Required by ImageModule)
function base64DataURLToArrayBuffer(dataURL: string) {
  const base64Regex = /^data:image\/(png|jpg|svg|svg\+xml);base64,/;
  if (!base64Regex.test(dataURL)) {
    return false;
  }
  const stringBase64 = dataURL.replace(base64Regex, "");
  let binaryString;
  if (typeof window !== "undefined") {
    binaryString = window.atob(stringBase64);
  } else {
    throw new Error("Window not defined for base64 decoding");
  }
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function SkGeneratorPage() {
  const { config } = useDepartmentConfig()
  
  // -- State for Template & Excel --
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  
  // -- State for Mapped Data (Preview) --
  const [mappedData, setMappedData] = useState<any[]>([])

  // -- State for Processing --
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)


  // -- New: Dialog State for Feedback --
  const [dialogState, setDialogState] = useState({
    open: false,
    title: "",
    description: "",
    isError: false,
  })

  // -- Fetch Signer Data (Headmaster) --
  // Assuming we use the first headmaster found or filter by active
  const headmasters = useQuery(api.headmasters.get)
  const signer = headmasters?.[0]

  // New: Global Tanggal Penetapan
  const [tanggalPenetapan, setTanggalPenetapan] = useState("")
  // New: Global Kecamatan Fallback
  const [defaultKecamatan, setDefaultKecamatan] = useState("") 


  
  // -- Handlers --

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTemplateFile(e.target.files[0])
    }
  }

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
       const file = e.target.files[0];
       // Dynamic import to avoid build errors if missing
       try {
         const XLSX = await import("xlsx");
         const reader = new FileReader();
         reader.onload = (evt) => {
           const bstr = evt.target?.result;
           const wb = XLSX.read(bstr, { type: "binary" });
           const wsname = wb.SheetNames[0];
           const ws = wb.Sheets[wsname];
           const data = XLSX.utils.sheet_to_json(ws);
           // Auto-map initial data
           setMappedData(data); 
         };
         reader.readAsBinaryString(file);
       } catch (error) {
         console.error("XLSX load failed", error);
         setDialogState({
            open: true,
            title: "Error Module XLSX",
            description: "Gagal memuat modul xlsx. Pastikan sudah diinstall.",
            isError: true
         })
       }
    }
  }

  // Configuration for Docxtemplater Image Module
  const imageModuleOpts = {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                getImage: function (tagValue: string, _tagName: string) {
                    return base64DataURLToArrayBuffer(tagValue);
                },
                getSize: function (img: unknown, tagValue: string, _tagName: string) {
                    // Force 100x100px for QR Codes
                    if (_tagName === "qrcode") return [100, 100];
                    return [100, 100];
                },
  }

  // Generate Single SK
  const generateSk = async (data: any) => {
    if (!templateFile) return;
    
    try {
        const reader = new FileReader();
        reader.onload = function(evt) {
            if (evt.target?.result) {
                const content = evt.target.result;
                const zip = new PizZip(content as string | ArrayBuffer);
                
                const imageModule = new ImageModule(imageModuleOpts);

                const doc = new Docxtemplater(zip, {
                    modules: [imageModule],
                    paragraphLoop: true,
                    linebreaks: true,
                });

                // Helper to safe format date
                const formatDate = (date: string) => {
                    return date ? new Date(date).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric'
                    }) : "";
                }

                // Render document
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                doc.renderAsync({
                    ...data,
                    // Inject Global Config
                    nama_sekolah: config?.schoolName || "MAARIF",
                    alamat_sekolah: config?.schoolAddress || "",
                    kepala_sekolah: signer?.name || "Kepala Sekolah",
                    nip_kepala: signer?.nip || "",
                    // Inject Global Inputs
                    tanggal_penetapan: tanggalPenetapan ? formatDate(tanggalPenetapan) : formatDate(new Date().toISOString()),
                    kecamatan: defaultKecamatan || "Cilacap",
                    // Inject QR Code if signer has signature
                    qrcode: signer?.signature || "", // Base64 string expected
                    
                    // Dynamic fields from Excel are in 'data'
                }).then(() => {
                    const out = doc.getZip().generate({
                        type: "blob",
                        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    });
                    saveAs(out, `SK_${data.nama || "Document"}.docx`);
                })
            }
        };
        reader.readAsBinaryString(templateFile);
    } catch (error) {
        console.error("Generation Error", error);
        setDialogState({
            open: true,
            title: "Gagal Generate",
            description: "Terjadi kesalahan saat membuat dokumen.",
            isError: true
        })
    }
  }

  // Bulk Generate Logic
  const generateBulkSkZip = async () => {
     if (!templateFile || mappedData.length === 0) {
        setDialogState({
            open: true,
            title: "Data Tidak Lengkap",
            description: "Pastikan template dan data excel sudah diupload.",
            isError: true
        })
        return;
     }

     setIsProcessing(true);
     setProgress(0);
     const masterZip = new JSZip();

     try {
        // Read template once
        const templateArrayBuffer = await templateFile.arrayBuffer();
        
        // Loop data
        let completed = 0;
        for (const [index, item] of mappedData.entries()) {
             const zip = new PizZip(templateArrayBuffer);
             const imageModule = new ImageModule(imageModuleOpts);
             const doc = new Docxtemplater(zip, { modules: [imageModule], paragraphLoop: true, linebreaks: true });

            // Render
             await doc.renderAsync({
                 ...item,
                 //... globals
                 nama_sekolah: config?.schoolName,
                 kepala_sekolah: signer?.name,
                 nip_kepala: signer?.nip,
                 tanggal_penetapan: tanggalPenetapan || new Date().toLocaleDateString('id-ID'),
                 kecamatan: defaultKecamatan,
                 qrcode: signer?.signature
             });

             const blob = doc.getZip().generate({ type: "blob" });
             masterZip.file(`SK_${item.nama || index}.docx`, blob);

             completed++;
             setProgress(Math.round((completed / mappedData.length) * 100));
        }

        // Generate Master Zip
        const content = await masterZip.generateAsync({ type: "blob" });
        saveAs(content, "Bulk_SK_Generations.zip");

        setDialogState({
            open: true,
            title: "Berhasil!",
            description: `Berhasil membuat ${mappedData.length} dokumen dalam ZIP.`,
            isError: false
        })

     } catch (error) {
         console.error(error);
         setDialogState({
            open: true,
            title: "Error Bulk Generate",
            description: "Gagal memproses bulk generate.",
            isError: true
        })
     } finally {
         setIsProcessing(false);
     }
  }

  const handleReset = () => {
      setTemplateFile(null);
      // setExcelData([]); // unused in view
      setMappedData([]);
      setTanggalPenetapan("");
      setDefaultKecamatan("");
  }


  return (
    <div className="container mx-auto p-6 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Generator SK & Surat Tugas</h1>
        <p className="text-muted-foreground">
          Upload template, import data excel, dan generate SK secara massal.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Upload Section */}
        <Card>
            <CardHeader>
                <CardTitle>1. Upload Template & Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="template">Template Word (.docx)</Label>
                    <Input id="template" type="file" accept=".docx" onChange={handleTemplateUpload} />
                    <p className="text-xs text-muted-foreground">
                        Gunakan placeholder {'{nama}'}, {'{nip}'}, {'{qrcode}'} di dalam word.
                    </p>
                </div>

                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="excel">Data Peserta (.xlsx)</Label>
                    <Input id="excel" type="file" accept=".xlsx" onChange={handleExcelUpload} />
                </div>

                <div className="pt-4 border-t space-y-3">
                     <Label>Konfigurasi Global</Label>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs">Tanggal Penetapan</Label>
                            <Input 
                                type="date" 
                                value={tanggalPenetapan} 
                                onChange={(e) => setTanggalPenetapan(e.target.value)} 
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Kecamatan (Tempat)</Label>
                            <Input 
                                placeholder="Cth: Kesugihan" 
                                value={defaultKecamatan} 
                                onChange={(e) => setDefaultKecamatan(e.target.value)}
                            />
                        </div>
                     </div>
                </div>
            </CardContent>
        </Card>

        {/* Action Section */}
        <Card>
            <CardHeader>
                <CardTitle>2. Aksi & Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-3">
                    <Button 
                        disabled={!templateFile || mappedData.length === 0 || isProcessing}
                        onClick={generateBulkSkZip}
                        className="w-full"
                    >
                        {isProcessing ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses {progress}%</>
                        ) : (
                            <><FileDown className="mr-2 h-4 w-4" /> Download Semua (ZIP)</>
                        )}
                    </Button>

                    <Button variant="outline" onClick={handleReset} className="w-full text-red-600 hover:text-red-700">
                        Reset Data
                    </Button>
                </div>

                {isProcessing && (
                     <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                         <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }} />
                     </div>
                )}
                
                <div className="rounded-md border p-4 bg-muted/50 text-sm">
                    <p>Total Data: <strong>{mappedData.length}</strong> baris</p>
                    <p>Template: <strong>{templateFile ? templateFile.name : "Belum dipilih"}</strong></p>
                    <p>Penandatangan: <strong>{signer?.name || "Belum diset"}</strong></p>
                </div>
            </CardContent>
        </Card>

      </div>

      {/* Data Table */}
      {mappedData.length > 0 && (
          <Card>
              <CardHeader>
                  <CardTitle>Preview Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>No</TableHead>
                              {Object.keys(mappedData[0] || {}).slice(0, 5).map(key => (
                                  <TableHead key={key} className="capitalize">{key}</TableHead>
                              ))}
                              <TableHead>Aksi</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {mappedData.slice(0, 5).map((row, i) => (
                              <TableRow key={i}>
                                  <TableCell>{i + 1}</TableCell>
                                  {Object.values(row).slice(0, 5).map((val: any, idx) => (
                                      <TableCell key={idx}>{String(val)}</TableCell>
                                  ))}
                                  <TableCell>
                                      <Button size="sm" variant="ghost" onClick={() => generateSk(row)}>
                                          <FileText className="h-4 w-4 text-blue-600" />
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                </div>
                {mappedData.length > 5 && (
                    <p className="text-center text-xs text-muted-foreground mt-4">
                        Menampilkan 5 dari {mappedData.length} data.
                    </p>
                )}
              </CardContent>
          </Card>
      )}

      {/* Replacement for AlertDialog using Dialog */}
      <Dialog open={dialogState.open} onOpenChange={(open) => setDialogState(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className={dialogState.isError ? "text-red-600" : "text-green-600"}>
                {dialogState.title}
            </DialogTitle>
            <DialogDescription>
              {dialogState.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
                onClick={() => setDialogState(prev => ({ ...prev, open: false }))} 
                className={dialogState.isError ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              OK, Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface TeacherPhotoUploadProps {
  photoId?: Id<"_storage"> | string;
  onPhotoUploaded: (storageId: string | Id<"_storage">) => void;
  onRemovePhoto?: () => void; // Optional removal
  isEditing?: boolean;
}

export default function TeacherPhotoUpload({ photoId, onPhotoUploaded, onRemovePhoto }: TeacherPhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 🔥 USE DRIVE UPLOAD
  const uploadToDrive = useAction((api as any).drive.uploadFile);
  
  // Fetch Photo URL: If it's a Storage ID, fetch it. If it's a URL, use it directly.
  const isStorageId = photoId && !photoId.startsWith("http");
  const storageUrl = useQuery(api.teachers.getPhotoUrl, isStorageId ? { storageId: photoId as Id<"_storage"> } : "skip");
  
  // Final URL to display
  const displayUrl = isStorageId ? storageUrl : photoId;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate (Max 2MB, Image)
    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran foto maksimal 2MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Harap upload file gambar (JPG/PNG)");
      return;
    }

    try {
      setIsUploading(true);
      
      // 1. Convert to Base64
      const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
      });

      // 2. Upload to Google Drive
      const result: any = await uploadToDrive({
          fileData: base64,
          fileName: `FOTO_GURU_${Date.now()}.jpg`,
          mimeType: file.type
      });

      if (!result) throw new Error("Upload response empty");
      
      if (result.success === false) {
          throw new Error(result.error);
      }
      
      // 3. Callback to parent (Return URL or ID)
      // We prefer storing the "thumbnailLink" or "webContentLink" directly?
      // Or construct a clean public URL helper?
      // For now, let's use the 'thumbnail' provided by Drive which is usually public-friendly
      // OR use a standard proxy URL structure.
      // Let's store the `webContentLink` but we might need to process it to be embeddable.
      // ACTUALLY: `drive.ts` returns `downloadUrl` = `webContentLink`.
      
      onPhotoUploaded(result.downloadUrl as any); // Cast to any to bypass Id<"_storage"> strictness if parent allows
      
    } catch (error: any) {
      console.error("Upload error:", error);
      alert(`DEBUG: Gagal Upload Foto.\nError: ${error.message}\n\nMohon fotokan ini ke admin.`);
      // alert("Gagal mengupload foto: " + error.message);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3 items-center p-4 border rounded-lg bg-slate-50 border-dashed border-slate-300">
      <div className="relative w-32 h-40 bg-slate-200 rounded overflow-hidden flex items-center justify-center shadow-sm border">
        {displayUrl ? (
          <img 
            src={displayUrl} 
            alt="Foto Guru" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-slate-400 flex flex-col items-center">
            <ImageIcon className="h-10 w-10 mb-1" />
            <span className="text-xs">No Photo</span>
          </div>
        )}
        
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
         <Button 
            variant="outline" 
            size="sm" 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
         >
            <Upload className="h-4 w-4 mr-2" />
            {photoId ? "Ganti Foto" : "Upload Foto"}
         </Button>
         
         {photoId && onRemovePhoto && (
             <Button
                variant="destructive"
                size="icon"
                type="button"
                className="w-9 h-9"
                onClick={onRemovePhoto}
             >
                <X className="h-4 w-4" />
             </Button>
         )}
      </div>

      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        accept="image/png, image/jpeg, image/jpg"
        onChange={handleFileSelect}
        aria-label="Upload Foto Guru"
        title="Upload Foto Guru"
      />
      
      <p className="text-[10px] text-muted-foreground text-center">
        Format: JPG/PNG, Max 2MB. <br/>
        Rasio 3:4 (Pas Foto).
      </p>
    </div>
  );
}

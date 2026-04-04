import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { mediaApi } from "@/lib/api";

interface TeacherPhotoUploadProps {
  photoId?: string;
  onPhotoUploaded: (url: string) => void;
  onRemovePhoto?: () => void;
}

export default function TeacherPhotoUpload({ photoId, onPhotoUploaded, onRemovePhoto }: TeacherPhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate (Max 2MB, Image)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 2MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Harap upload file gambar (JPG/PNG)");
      return;
    }

    try {
      setIsUploading(true);
      const result = await mediaApi.upload(file, 'teachers');
      
      if (result.url) {
        onPhotoUploaded(result.url);
        toast.success("Foto berhasil diunggah!");
      } else {
        throw new Error("Gagal mendapatkan URL file");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Gagal Upload Foto: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3 items-center p-4 border rounded-lg bg-slate-50 border-dashed border-slate-300">
      <div className="relative w-32 h-40 bg-slate-200 rounded overflow-hidden flex items-center justify-center shadow-sm border">
        {photoId ? (
          <img 
            src={photoId} 
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

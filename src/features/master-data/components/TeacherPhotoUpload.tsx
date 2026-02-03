import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

interface TeacherPhotoUploadProps {
  photoId?: Id<"_storage">;
  onPhotoUploaded: (storageId: Id<"_storage">) => void;
  onRemovePhoto?: () => void; // Optional removal
  isEditing?: boolean;
}

export default function TeacherPhotoUpload({ photoId, onPhotoUploaded, onRemovePhoto, isEditing = false }: TeacherPhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch Photo URL if ID exists
  const photoUrl = useQuery(api.teachers.getPhotoUrl, photoId ? { storageId: photoId } : "skip");
  
  const generateUploadUrl = useMutation(api.teachers.generateUploadUrl);

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
      
      // 1. Get Upload URL
      const postUrl = await generateUploadUrl();
      
      // 2. Upload to Convex Storage
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error("Upload failed");

      const { storageId } = await result.json();
      
      // 3. Callback to parent
      onPhotoUploaded(storageId);
      
    } catch (error) {
      console.error("Upload error:", error);
      alert("Gagal mengupload foto. Silakan coba lagi.");
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3 items-center p-4 border rounded-lg bg-slate-50 border-dashed border-slate-300">
      <div className="relative w-32 h-40 bg-slate-200 rounded overflow-hidden flex items-center justify-center shadow-sm border">
        {photoUrl ? (
          <img 
            src={photoUrl} 
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
      />
      
      <p className="text-[10px] text-muted-foreground text-center">
        Format: JPG/PNG, Max 2MB. <br/>
        Rasio 3:4 (Pas Foto).
      </p>
    </div>
  );
}

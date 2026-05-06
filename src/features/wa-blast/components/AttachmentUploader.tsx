import { useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AttachmentUploaderProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  maxSizeMB?: number;
}

export function AttachmentUploader({ file, onFileChange, maxSizeMB = 10 }: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);

    // Validate file type
    if (selectedFile.type !== "application/pdf") {
      setError("File harus berformat PDF.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (selectedFile.size > maxSizeBytes) {
      setError(`Ukuran file maksimal ${maxSizeMB} MB.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    onFileChange(selectedFile);
  };

  const handleRemoveFile = () => {
    onFileChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">Lampiran PDF (Opsional)</Label>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!file ? (
        <div
          onClick={handleButtonClick}
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
        >
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <div className="text-sm font-medium mb-1">Klik untuk memilih file PDF</div>
          <div className="text-xs text-muted-foreground">
            Maksimal {maxSizeMB} MB • Format: PDF
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4 flex items-center justify-between bg-accent/30">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <div className="font-medium text-sm">{file.name}</div>
              <div className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemoveFile}
            title="Hapus file"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        File PDF akan dikirim bersama pesan WhatsApp ke setiap penerima.
      </div>
    </div>
  );
}

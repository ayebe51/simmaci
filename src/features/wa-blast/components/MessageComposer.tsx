import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { User, Building2 } from "lucide-react";

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

export function MessageComposer({ value, onChange, maxLength = 4096 }: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + variable + after;

    onChange(newText);

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variable.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const remainingChars = maxLength - value.length;
  const isOverLimit = remainingChars < 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="message-body" className="text-base font-semibold">
          Isi Pesan
        </Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => insertVariable("{{nama}}")}
            title="Sisipkan variabel nama penerima"
          >
            <User className="h-4 w-4 mr-1" />
            {"{{nama}}"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => insertVariable("{{nama_sekolah}}")}
            title="Sisipkan variabel nama sekolah"
          >
            <Building2 className="h-4 w-4 mr-1" />
            {"{{nama_sekolah}}"}
          </Button>
        </div>
      </div>

      <Textarea
        ref={textareaRef}
        id="message-body"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tulis pesan Anda di sini... Gunakan {{nama}} untuk nama penerima dan {{nama_sekolah}} untuk nama sekolah."
        className="min-h-[200px] font-mono text-sm"
        maxLength={maxLength}
      />

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Variabel yang tersedia: <code className="bg-muted px-1 py-0.5 rounded">{"{{nama}}"}</code>,{" "}
          <code className="bg-muted px-1 py-0.5 rounded">{"{{nama_sekolah}}"}</code>
        </div>
        <div className={isOverLimit ? "text-red-600 font-semibold" : "text-muted-foreground"}>
          {value.length} / {maxLength} karakter
          {isOverLimit && <span className="ml-2">(Melebihi batas!)</span>}
        </div>
      </div>
    </div>
  );
}

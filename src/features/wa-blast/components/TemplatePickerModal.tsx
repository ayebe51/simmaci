import { useState } from "react";
import { Search, FileText, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWaBlastTemplates } from "../hooks/useWaBlastTemplates";
import type { WaBlastTemplate } from "../types/waBlast.types";

interface TemplatePickerModalProps {
  onSelect: (templateBody: string) => void;
}

export function TemplatePickerModal({ onSelect }: TemplatePickerModalProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: templates, isLoading } = useWaBlastTemplates();

  const safeTemplates = Array.isArray(templates) ? templates : [];
  const filteredTemplates = safeTemplates.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectTemplate = (template: WaBlastTemplate) => {
    onSelect(template.body);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Gunakan Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Pilih Template Pesan</DialogTitle>
          <DialogDescription>
            Pilih template pesan yang sudah tersimpan untuk digunakan dalam blast ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari template berdasarkan nama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Template List */}
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat template...</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "Tidak ada template yang cocok dengan pencarian." : "Belum ada template tersimpan."}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full text-left p-4 border rounded-lg hover:bg-accent hover:border-primary transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm mb-1">{template.name}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {template.body.substring(0, 100)}
                          {template.body.length > 100 && "..."}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Dibuat: {new Date(template.created_at).toLocaleDateString("id-ID")}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { RecipientPreview } from "../types/waBlast.types";

interface RecipientPreviewTableProps {
  recipients: RecipientPreview[];
  onRemoveRecipient: (phoneNumber: string) => void;
}

export function RecipientPreviewTable({ recipients, onRemoveRecipient }: RecipientPreviewTableProps) {
  // Ensure recipients is always an array
  const safeRecipients = Array.isArray(recipients) ? recipients : [];
  
  const validCount = safeRecipients.filter((r) => r.is_valid).length;
  const invalidCount = safeRecipients.filter((r) => !r.is_valid).length;

  if (safeRecipients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Belum ada penerima. Pilih kategori dan filter untuk melihat daftar penerima.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <div className="text-sm text-muted-foreground">Total Penerima</div>
          <div className="text-2xl font-bold">{safeRecipients.length}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Valid</div>
          <div className="text-2xl font-bold text-green-600">{validCount}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Tidak Valid</div>
          <div className="text-2xl font-bold text-red-600">{invalidCount}</div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Sekolah</TableHead>
              <TableHead>Nomor WhatsApp</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeRecipients.map((recipient, index) => (
              <TableRow key={`${recipient.phone_number}-${index}`}>
                <TableCell className="font-medium">{recipient.recipient_name}</TableCell>
                <TableCell>{recipient.school_name}</TableCell>
                <TableCell className="font-mono text-sm">{recipient.phone_number}</TableCell>
                <TableCell>
                  {recipient.is_valid ? (
                    <Badge className="bg-green-100 text-green-700 border-green-300">Valid</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 border-red-300">Tidak Valid</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveRecipient(recipient.phone_number)}
                    title="Hapus penerima"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

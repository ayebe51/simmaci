import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge";
import type { WaBlastRecipient } from "../types/waBlast.types";

interface RecipientDetailTableProps {
  recipients: WaBlastRecipient[];
}

export function RecipientDetailTable({ recipients }: RecipientDetailTableProps) {
  if (recipients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg">
        Tidak ada data penerima.
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Nama Sekolah</TableHead>
            <TableHead>Nomor WhatsApp</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pesan Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipients.map((recipient) => (
            <TableRow key={recipient.id}>
              <TableCell className="font-medium">{recipient.recipient_name}</TableCell>
              <TableCell>{recipient.school_name}</TableCell>
              <TableCell className="font-mono text-sm">{recipient.phone_number}</TableCell>
              <TableCell>
                <DeliveryStatusBadge status={recipient.delivery_status} />
              </TableCell>
              <TableCell>
                {recipient.error_message ? (
                  <span className="text-sm text-red-600">{recipient.error_message}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

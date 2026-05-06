import { cva, type VariantProps } from "class-variance-authority";
import { Badge } from "@/components/ui/badge";
import type { DeliveryStatus } from "../types/waBlast.types";

const deliveryStatusVariants = cva("", {
  variants: {
    status: {
      pending: "bg-gray-100 text-gray-700 border-gray-300",
      sent: "bg-green-100 text-green-700 border-green-300",
      failed: "bg-red-100 text-red-700 border-red-300",
      invalid_number: "bg-orange-100 text-orange-700 border-orange-300",
    },
  },
  defaultVariants: {
    status: "pending",
  },
});

interface DeliveryStatusBadgeProps extends VariantProps<typeof deliveryStatusVariants> {
  status: DeliveryStatus;
  className?: string;
}

const statusLabels: Record<DeliveryStatus, string> = {
  pending: "Menunggu",
  sent: "Terkirim",
  failed: "Gagal",
  invalid_number: "Nomor Tidak Valid",
};

export function DeliveryStatusBadge({ status, className }: DeliveryStatusBadgeProps) {
  return (
    <Badge className={deliveryStatusVariants({ status, className })}>
      {statusLabels[status]}
    </Badge>
  );
}

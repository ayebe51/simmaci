import { cva, type VariantProps } from "class-variance-authority";
import { Badge } from "@/components/ui/badge";
import type { BlastStatus } from "../types/waBlast.types";

const blastStatusVariants = cva("", {
  variants: {
    status: {
      draft: "bg-gray-100 text-gray-700 border-gray-300",
      scheduled: "bg-blue-100 text-blue-700 border-blue-300",
      sending: "bg-yellow-100 text-yellow-700 border-yellow-300",
      completed: "bg-green-100 text-green-700 border-green-300",
      failed: "bg-red-100 text-red-700 border-red-300",
    },
  },
  defaultVariants: {
    status: "draft",
  },
});

interface BlastStatusBadgeProps extends VariantProps<typeof blastStatusVariants> {
  status: BlastStatus;
  className?: string;
}

const statusLabels: Record<BlastStatus, string> = {
  draft: "Draft",
  scheduled: "Terjadwal",
  sending: "Mengirim",
  completed: "Selesai",
  failed: "Gagal",
};

export function BlastStatusBadge({ status, className }: BlastStatusBadgeProps) {
  return (
    <Badge className={blastStatusVariants({ status, className })}>
      {statusLabels[status]}
    </Badge>
  );
}

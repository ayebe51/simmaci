import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { useWaBlastProgress } from "../hooks/useWaBlastProgress";
import type { BlastStatus } from "../types/waBlast.types";

interface BlastProgressBarProps {
  blastId: number;
  blastStatus: BlastStatus;
}

export function BlastProgressBar({ blastId, blastStatus }: BlastProgressBarProps) {
  const { data: progress, isLoading } = useWaBlastProgress(blastId, { blastStatus });

  if (!progress && !isLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Memuat progres...</span>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  const percentage = progress.total_count > 0 
    ? Math.round((progress.sent_count / progress.total_count) * 100) 
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Progres Pengiriman</span>
        <span className="text-muted-foreground">
          {progress.sent_count} / {progress.total_count} terkirim
        </span>
      </div>

      <Progress value={percentage} className="h-3" />

      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold text-primary">{percentage}%</div>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Menunggu:</span>{" "}
            <span className="font-semibold">{progress.pending_count}</span>
          </div>
          {progress.failed_count > 0 && (
            <div>
              <span className="text-muted-foreground">Gagal:</span>{" "}
              <span className="font-semibold text-red-600">{progress.failed_count}</span>
            </div>
          )}
          {progress.invalid_count > 0 && (
            <div>
              <span className="text-muted-foreground">Tidak Valid:</span>{" "}
              <span className="font-semibold text-orange-600">{progress.invalid_count}</span>
            </div>
          )}
        </div>
      </div>

      {blastStatus === "sending" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Sedang mengirim pesan... (diperbarui otomatis setiap 5 detik)</span>
        </div>
      )}
    </div>
  );
}

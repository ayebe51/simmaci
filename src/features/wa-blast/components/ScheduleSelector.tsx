import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface ScheduleSelectorProps {
  isScheduled: boolean;
  onScheduledChange: (scheduled: boolean) => void;
  scheduledAt: string;
  onScheduledAtChange: (datetime: string) => void;
}

export function ScheduleSelector({
  isScheduled,
  onScheduledChange,
  scheduledAt,
  onScheduledAtChange,
}: ScheduleSelectorProps) {
  // Get minimum datetime (current time + 5 minutes)
  const getMinDatetime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-base font-semibold">Penjadwalan Pengiriman</Label>
          <div className="text-sm text-muted-foreground">
            {isScheduled ? "Pesan akan dikirim pada waktu yang ditentukan" : "Pesan akan dikirim segera setelah dikonfirmasi"}
          </div>
        </div>
        <Switch checked={isScheduled} onCheckedChange={onScheduledChange} />
      </div>

      {isScheduled && (
        <div className="space-y-2 pl-4 border-l-2 border-primary/30">
          <Label htmlFor="scheduled-at" className="text-sm font-medium">
            Waktu Pengiriman
          </Label>
          <Input
            id="scheduled-at"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => onScheduledAtChange(e.target.value)}
            min={getMinDatetime()}
            className="max-w-xs"
          />
          <div className="text-xs text-muted-foreground">
            Pilih tanggal dan waktu pengiriman (minimal 5 menit dari sekarang)
          </div>
        </div>
      )}
    </div>
  );
}

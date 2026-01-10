import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

interface PDPKPNUCardProps {
  data: {
    sudah: number;
    belum: number;
    total: number;
    percentage: number;
  } | null;
}

export function PDPKPNUCard({ data }: PDPKPNUCardProps) {
  if (!data || data.total === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">PDPKPNU Progress</CardTitle>
          <BookOpen className="h-4 w-4 text-indigo-500" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Belum ada data</p>
        </CardContent>
      </Card>
    );
  }

  const getColorClass = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">PDPKPNU Progress</CardTitle>
        <BookOpen className="h-4 w-4 text-indigo-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {data.sudah} / {data.total}
        </div>
        <p className="text-xs text-muted-foreground">
          {data.percentage}% sudah mengikuti
        </p>
        <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${getColorClass(data.percentage)}`}
            style={{ width: `${data.percentage}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>Sudah: {data.sudah}</span>
          <span>Belum: {data.belum}</span>
        </div>
      </CardContent>
    </Card>
  );
}

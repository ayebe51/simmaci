import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface MonthlySKTrendChartProps {
  data: { month: string; count: number }[];
}

export function MonthlySKTrendChart({ data }: MonthlySKTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trend Pengajuan SK (6 Bulan Terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Belum ada data</p>
        </CardContent>
      </Card>
    );
  }

  // Format month for display (2026-01 -> Jan 2026)
  const formattedData = data.map(item => ({
    ...item,
    monthDisplay: new Date(item.month + '-01').toLocaleDateString('id-ID', { 
      month: 'short', 
      year: 'numeric' 
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trend Pengajuan SK (6 Bulan Terakhir)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="monthDisplay" 
              tick={{ fontSize: 12 }}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="count" 
              name="Pengajuan SK"
              stroke="#3b82f6" 
              strokeWidth={2}
              activeDot={{ r: 8 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

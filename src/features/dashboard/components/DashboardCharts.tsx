import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { useEffect, useState } from "react"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

interface DashboardChartsProps {
    data?: {
        status: { name: string, value: number }[]
        units: { name: string, jumlah: number }[]
    }
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  const [isClient, setIsClient] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Error boundary for chart rendering
  useEffect(() => {
    const handleError = () => setHasError(true)
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  if (!isClient) return null // Prevent hydration mismatch
  if (hasError) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-6">
        <Card className="col-span-7">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Charts unavailable. Dashboard stats are being loaded...
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusData = data?.status || []
  const unitData = data?.units || []

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-6">
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Distribusi Guru per Unit Kerja</CardTitle>
          <CardDescription>
             5 Lembaga dengan jumlah guru terbanyak.
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="h-[300px]">
            {unitData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={unitData}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                        <Tooltip />
                        <Bar dataKey="jumlah" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Belum ada data unit kerja.</div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Status Kepegawaian</CardTitle>
          <CardDescription>
             Proporsi guru berdasarkan status.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="h-[300px]">
             {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                            {statusData.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
             ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Belum ada data status.</div>
             )}
           </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

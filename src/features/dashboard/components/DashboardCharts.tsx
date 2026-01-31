import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { useEffect, useState } from "react"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

// ... imports remain same

interface DashboardChartsProps {
    data?: {
        status: { name: string, value: number }[]
        units: { name: string, jumlah: number }[]
        certification: { name: string, value: number }[]
        kecamatan: { name: string, jumlah: number }[]
    }
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  const [isClient, setIsClient] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    const handleError = () => setHasError(true)
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  if (!isClient) return null
  if (hasError) {
    return (
      <Card className="mt-6">
          <CardContent className="pt-6 text-center text-muted-foreground">
              Charts unavailable.
          </CardContent>
      </Card>
    )
  }

  const statusData = data?.status || []
  const unitData = data?.units || []
  const certData = data?.certification || []
  const kecData = data?.kecamatan || []

  return (
    <div className="space-y-6 mt-6">
        
        {/* ROW 1: Status & Unit Kerja */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
                <CardHeader>
                <CardTitle>Distribusi Guru per Unit Kerja</CardTitle>
                <CardDescription>5 Lembaga dengan jumlah guru terbanyak.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                <div className="h-[300px]">
                    {unitData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={unitData}>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Bar dataKey="jumlah" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="flex items-center justify-center h-full text-muted-foreground">No Data</div>}
                </div>
                </CardContent>
            </Card>
            
            <Card className="col-span-3">
                <CardHeader>
                <CardTitle>Status Kepegawaian</CardTitle>
                <CardDescription>Proporsi guru berdasarkan status.</CardDescription>
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
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {statusData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <div className="flex items-center justify-center h-full text-muted-foreground">No Data</div>}
                </div>
                </CardContent>
            </Card>
        </div>

        {/* ROW 2: Certification & Kecamatan */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
             <Card className="col-span-3">
                <CardHeader>
                <CardTitle>Status Sertifikasi</CardTitle>
                <CardDescription>Guru yang sudah vs belum sertifikasi.</CardDescription>
                </CardHeader>
                <CardContent>
                <div className="h-[300px]">
                    {certData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={certData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    dataKey="value"
                                    label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}
                                >
                                    {certData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name.includes("Belum") ? '#e5e7eb' : '#22c55e'} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <div className="flex items-center justify-center h-full text-muted-foreground">No Data</div>}
                </div>
                </CardContent>
            </Card>

            <Card className="col-span-4">
                <CardHeader>
                <CardTitle>Sebaran per Kecamatan</CardTitle>
                <CardDescription>Konsentrasi guru di setiap wilayah.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                <div className="h-[300px]">
                    {kecData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={kecData} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Bar dataKey="jumlah" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="flex items-center justify-center h-full text-muted-foreground">No Data</div>}
                </div>
                </CardContent>
            </Card>
        </div>

    </div>
  )
}

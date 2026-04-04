import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

const PASTEL_COLORS = ['#60a5fa', '#34d399', '#ffb74d', '#f472b6', '#a78bfa', '#818cf8']
const CERT_COLORS = { yes: '#4ade80', no: '#f87171' }

interface DashboardChartsProps {
    data?: {
        status?: { name: string, value: number }[]
        units?: { name: string, jumlah: number }[]
        certification?: { name: string, value: number }[]
        kecamatan?: { name: string, jumlah: number }[]
    }
    loading?: boolean
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-slate-100 shadow-md rounded-md text-xs">
          <p className="font-semibold mb-1">{label || payload[0].name}</p>
          <p className="text-blue-600">
             {payload[0].value} {payload[0].name.includes("Sekolah") ? "Sekolah" : "Guru"}
             {payload[0].payload.percent ? ` (${(payload[0].payload.percent * 100).toFixed(0)}%)` : ''}
          </p>
        </div>
      );
    }
    return null;
  };

export function DashboardCharts({ data, loading }: DashboardChartsProps) {
  const [isClient, setIsClient] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => { setIsClient(true) }, []) 
  
  if (!isClient) return null
  if (loading) return (
      <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-500" /></div>
  )
  if (hasError) return <Card className="mt-6"><CardContent className="p-10 text-center">Charts unavailable.</CardContent></Card>

  // Robust data defaults with array checks
  const statusData = (Array.isArray(data?.status) ? data.status : [])
    .filter(d => d && typeof d.value === 'number' && d.value > 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0))

  const unitData = Array.isArray(data?.units) ? data.units : []
  const certData = Array.isArray(data?.certification) ? data.certification : []
  const kecData = Array.isArray(data?.kecamatan) ? data.kecamatan : []

  const totalStatus = statusData.reduce((a, b) => a + (b.value || 0), 0)
  const totalCert = certData.reduce((a, b) => a + (b.value || 0), 0)
  const uncertifiedCount = certData.find(c => c.name?.includes("Belum"))?.value || 0
  const uncertifiedPercent = totalCert > 0 ? Math.round((uncertifiedCount / totalCert) * 100) : 0

  return (
    <div className="space-y-6 mt-6">
        {/* ROW 1: Donut Charts */}
        {(statusData.length > 0 || certData.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
                {statusData.length > 0 && (
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader>
                          <CardTitle>Status Kepegawaian</CardTitle>
                          <CardDescription>Proporsi SDM berdasarkan status.</CardDescription>
                        </CardHeader>
                        <CardContent>
                        <div className="h-[300px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={90}
                                        paddingAngle={4}
                                        cornerRadius={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PASTEL_COLORS[index % PASTEL_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend 
                                        verticalAlign="bottom" 
                                        height={36} 
                                        iconType="circle"
                                        formatter={(value, entry: any) => {
                                            const percent = totalStatus > 0 ? ((entry.payload.value / totalStatus) * 100).toFixed(0) : 0;
                                            return <span className="text-slate-600 font-medium ml-1 text-xs">{value}: {entry.payload.value} ({percent}%)</span>
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                                <p className="text-3xl font-bold text-slate-700">{totalStatus}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">TOTAL</p>
                            </div>
                        </div>
                        </CardContent>
                    </Card>
                )}

                {certData.length > 0 && (
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader>
                          <CardTitle>Status Sertifikasi</CardTitle>
                          <CardDescription>Sudah vs Belum Sertifikasi.</CardDescription>
                        </CardHeader>
                        <CardContent>
                        <div className="h-[300px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={certData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={90}
                                        paddingAngle={4}
                                        cornerRadius={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {certData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={entry.name.includes("Belum") ? CERT_COLORS.no : CERT_COLORS.yes} 
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend 
                                        verticalAlign="bottom" 
                                        height={36} 
                                        iconType="circle"
                                        formatter={(value, entry: any) => {
                                            const percent = totalCert > 0 ? ((entry.payload.value / totalCert) * 100).toFixed(0) : 0;
                                            return <span className="text-slate-600 font-medium ml-1 text-xs">{value}: {entry.payload.value} ({percent}%)</span>
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                                <p className="text-3xl font-bold text-slate-700">{totalCert}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">GURU</p>
                            </div>
                        </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        )}

        {/* ROW 2: Bar Breakdown */}
        <div className="grid gap-6 lg:grid-cols-2 mt-8">
            {kecData.length > 0 && (
                <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden relative">
                    <CardContent className="p-8">
                        <p className="text-xs font-bold tracking-widest text-emerald-600 uppercase mb-2">Regional Insights</p>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Sebaran Wilayah</h2>
                        
                        <div className="space-y-6 mt-6">
                            {kecData.slice(0, 5).map((kec, index) => {
                                const maxWidth = Math.max(...kecData.map(d => d.jumlah), 1);
                                const percent = (kec.jumlah / maxWidth) * 100;
                                return (
                                    <div key={index} className="space-y-2">
                                        <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                                            <span>{kec.name}</span>
                                            <span className="text-emerald-700">{kec.jumlah} Guru</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {unitData.length > 0 && (
                <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden relative">
                    <CardContent className="p-8">
                        <p className="text-xs font-bold tracking-widest text-blue-500 uppercase mb-2">Education Levels</p>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Distribusi Jenjang</h2>
                        
                        <div className="grid grid-cols-2 gap-4 mt-6">
                            {unitData.slice(0, 6).map((jenjang, index) => {
                                const totalJenjang = unitData.reduce((acc, curr) => acc + curr.jumlah, 0);
                                const percent = totalJenjang > 0 ? Math.round((jenjang.jumlah / totalJenjang) * 100) : 0;
                                
                                return (
                                    <div key={index} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                                        <p className="text-xs font-bold text-slate-500 mb-1">{jenjang.name}</p>
                                        <p className="text-2xl font-black text-blue-600">{percent}%</p>
                                        <p className="text-[10px] text-slate-400">{jenjang.jumlah} Guru</p>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    </div>
  )
}

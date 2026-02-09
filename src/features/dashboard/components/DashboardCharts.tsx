import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Label } from "recharts"
import { useEffect, useState } from "react"

const PASTEL_COLORS = ['#60a5fa', '#34d399', '#ffb74d', '#f472b6', '#a78bfa', '#818cf8']
const CERT_COLORS = { yes: '#4ade80', no: '#f87171' } // Green-400, Red-400

// ... imports remain same

interface DashboardChartsProps {
    data?: {
        status: { name: string, value: number }[]
        units: { name: string, jumlah: number }[]
        certification: { name: string, value: number }[]
        kecamatan: { name: string, jumlah: number }[]
    }
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-slate-100 shadow-md rounded-md text-xs">
          <p className="font-semibold mb-1">{label || payload[0].name}</p>
          <p className="text-blue-600">
             {payload[0].value} Guru 
             {payload[0].payload.percent ? ` (${(payload[0].payload.percent * 100).toFixed(0)}%)` : ''}
          </p>
        </div>
      );
    }
    return null;
  };

export function DashboardCharts({ data }: DashboardChartsProps) {
  const [isClient, setIsClient] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => { setIsClient(true) }, [])
  useEffect(() => {
    const handleError = () => setHasError(true)
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  if (!isClient) return null
  if (hasError) return <Card className="mt-6"><CardContent>Charts unavailable.</CardContent></Card>

  // Filter & Sort Data for Better Visualization
  const statusData = (data?.status || [])
    .filter(d => d.value > 0) // Hide 0 values
    .sort((a, b) => b.value - a.value) // Sort Largest to Smallest

  const unitData = data?.units || []
  const certData = data?.certification || []
  const kecData = data?.kecamatan || []

  // Calculate Totals for Center Text
  const totalStatus = statusData.reduce((a, b) => a + b.value, 0)
  const totalCert = certData.reduce((a, b) => a + b.value, 0)

  // Calculate Percentages for Insights
  const uncertifiedCount = certData.find(c => c.name.includes("Belum"))?.value || 0
  const uncertifiedPercent = totalCert > 0 ? Math.round((uncertifiedCount / totalCert) * 100) : 0

  return (
    <div className="space-y-6 mt-6">
        
        {/* ROW 1: Status & Unit Kerja */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Unit Kerja - Horizontal Bar */}
            <Card className="col-span-4">
                <CardHeader>
                <CardTitle>Distribusi Guru per Unit Kerja</CardTitle>
                <CardDescription>5 Lembaga dengan jumlah guru terbanyak.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                <div className="h-[300px] w-full">
                    {unitData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={unitData} layout="vertical" margin={{ left: 40, right: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    width={150} 
                                    tick={{fontSize: 11, fill: '#64748b'}} 
                                    axisLine={false} 
                                    tickLine={false}
                                />
                                <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip />} />
                                <Bar 
                                    dataKey="jumlah" 
                                    fill="#60a5fa" 
                                    radius={[0, 4, 4, 0]} 
                                    barSize={24}
                                    background={{ fill: '#f1f5f9', radius: 4 }} 
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="flex items-center justify-center h-full text-muted-foreground">No Data</div>}
                </div>
                </CardContent>
            </Card>
            
            {/* Status Kepegawaian - Donut */}
            <Card className="col-span-3">
                <CardHeader>
                <CardTitle>Status Kepegawaian</CardTitle>
                <CardDescription>Proporsi SDM berdasarkan status.</CardDescription>
                </CardHeader>
                <CardContent>
                <div className="h-[300px] relative">
                    {statusData.length > 0 ? (
                        <>
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
                                            const percent = ((entry.payload.value / totalStatus) * 100).toFixed(0);
                                            return <span className="text-slate-600 font-medium ml-1">{value}: {entry.payload.value} ({percent}%)</span>
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Label */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                                <span className="text-3xl font-bold text-slate-700">{totalStatus}</span>
                                <span className="block text-xs text-muted-foreground uppercase tracking-wider">TOTAL</span>
                            </div>
                        </>
                    ) : <div className="flex items-center justify-center h-full text-muted-foreground">No Data</div>}
                </div>
                </CardContent>
            </Card>
        </div>

        {/* ROW 2: Certification & Kecamatan */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
             {/* Status Sertifikasi - Donut */}
             <Card className="col-span-3">
                <CardHeader>
                <CardTitle>Status Sertifikasi</CardTitle>
                <CardDescription>Guru yang sudah vs belum sertifikasi.</CardDescription>
                </CardHeader>
                <CardContent>
                <div className="h-[300px] relative">
                    {certData.length > 0 ? (
                        <>
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
                                            const percent = ((entry.payload.value / totalCert) * 100).toFixed(0);
                                            return <span className="text-slate-600 font-medium ml-1">{value}: {entry.payload.value} ({percent}%)</span>
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Label */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                                <span className="text-3xl font-bold text-slate-700">{totalCert}</span>
                                <span className="block text-xs text-muted-foreground uppercase tracking-wider">GURU</span>
                            </div>
                        </>
                    ) : <div className="flex items-center justify-center h-full text-muted-foreground">No Data</div>}
                </div>
                {/* Insight Text */}
                {uncertifiedPercent > 50 && (
                    <div className="text-center mt-[-10px] pb-4 px-4 text-xs text-amber-600 font-medium bg-amber-50 rounded-md py-2 mx-8">
                        ⚠️ Perhatian: {uncertifiedPercent}% guru belum tersertifikasi.
                    </div>
                )}
                </CardContent>
            </Card>

            {/* Kecamatan - Horizontal Bar */}
            <Card className="col-span-4">
                <CardHeader>
                <CardTitle>Sebaran per Kecamatan</CardTitle>
                <CardDescription>Konsentrasi guru di setiap wilayah.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                <div className="h-[300px]">
                    {kecData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={kecData} layout="vertical" margin={{ left: 0, right: 30 }}>
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    width={100} 
                                    tick={{fontSize: 11, fill: '#64748b'}} 
                                    axisLine={false} 
                                    tickLine={false}
                                />
                                <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip />} />
                                <Bar 
                                    dataKey="jumlah" 
                                    fill="#facc15" 
                                    radius={[0, 4, 4, 0]} 
                                    barSize={20}
                                    background={{ fill: '#fefce8', radius: 4 }}
                                />
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

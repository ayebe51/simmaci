import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
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

  useEffect(() => { setIsClient(true) }, []) // eslint-disable-line react-hooks/set-state-in-effect
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
        
        {/* ROW 1: Donut Charts (Side-by-side) */}
        {(statusData.length > 0 || certData.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
                {/* Status Kepegawaian */}
                {statusData.length > 0 && (
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader>
                        <CardTitle>Status Kepegawaian</CardTitle>
                        <CardDescription>Proporsi SDM berdasarkan status.</CardDescription>
                        </CardHeader>
                        <CardContent>
                        <div className="h-[300px] relative">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                                <span className="text-3xl font-bold text-slate-700">{totalStatus}</span>
                                <span className="block text-xs text-muted-foreground uppercase tracking-wider">TOTAL</span>
                            </div>
                        </div>
                        </CardContent>
                    </Card>
                )}

                {/* Status Sertifikasi */}
                {certData.length > 0 && (
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader>
                        <CardTitle>Status Sertifikasi</CardTitle>
                        <CardDescription>Guru yang sudah vs belum sertifikasi.</CardDescription>
                        </CardHeader>
                        <CardContent>
                        <div className="h-[300px] relative">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                                <span className="text-3xl font-bold text-slate-700">{totalCert}</span>
                                <span className="block text-xs text-muted-foreground uppercase tracking-wider">GURU</span>
                            </div>
                        </div>
                        {uncertifiedPercent > 50 && (
                            <div className="text-center mt-[-10px] pb-4 px-4 text-xs text-amber-600 font-medium bg-amber-50 rounded-md py-2 mx-8">
                                ⚠️ Perhatian: {uncertifiedPercent}% guru belum tersertifikasi.
                            </div>
                        )}
                        </CardContent>
                    </Card>
                )}
            </div>
        )}

        {/* ROW 2: Custom Layout based on User Screenshot */}
        <div className="grid gap-6 lg:grid-cols-2 mt-8">
            {/* Left Column: Sebaran Wilayah / Kecamatan */}
            <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white rounded-[2rem] overflow-hidden relative">
                {/* Decorative background circle */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/50 rounded-full translate-x-1/3 -translate-y-1/3 blur-2xl pointer-events-none" />
                <CardContent className="p-8 relative z-10 h-full flex flex-col">
                    <p className="text-xs font-bold tracking-widest text-emerald-600 uppercase mb-2">Regional Insights</p>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Sebaran Wilayah</h2>
                    <p className="text-sm text-slate-500 mb-8 mt-1">Konsentrasi penempatan guru tertinggi per wilayah</p>
                    
                    <div className="space-y-6 flex-1">
                        {kecData.slice(0, 4).map((kec, index) => {
                            const maxWidth = Math.max(...kecData.map(d => d.jumlah), 1);
                            const percent = Math.min((kec.jumlah / maxWidth) * 100, 100);
                            return (
                                <div key={index} className="space-y-2">
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                                        <span>{kec.name}</span>
                                        <span className="text-emerald-700">{kec.jumlah} Guru</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100/80 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out" 
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Right Column: Distribusi Jenjang */}
            <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white rounded-[2rem] overflow-hidden relative">
                <CardContent className="p-8 relative z-10 h-full flex flex-col">
                    <p className="text-xs font-bold tracking-widest text-blue-500 uppercase mb-2">Education Levels</p>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Distribusi Jenjang</h2>
                    <p className="text-sm text-slate-500 mb-8 mt-1">Komposisi guru PCNU berdasarkan tingkatan</p>
                    
                    <div className="grid grid-cols-2 gap-4 flex-1">
                        {unitData.slice(0, 4).map((jenjang, index) => {
                            const totalJenjang = unitData.reduce((acc, curr) => acc + curr.jumlah, 0);
                            const percent = totalJenjang > 0 ? Math.round((jenjang.jumlah / totalJenjang) * 100) : 0;
                            
                            // Determine color schema based on name
                            let bgClass = "bg-slate-50 border-slate-100/60";
                            let textClass = "text-slate-600";
                            let dotClass = "bg-slate-400";
                            
                            if (jenjang.name.includes("MI") || jenjang.name.includes("SD")) {
                                bgClass = "bg-[#f2fdf5] border-emerald-100/60";
                                textClass = "text-[#059669]";
                                dotClass = "bg-[#10b981]";
                            } else if (jenjang.name.includes("MTs") || jenjang.name.includes("SMP")) {
                                bgClass = "bg-[#f0f9ff] border-blue-100/60";
                                textClass = "text-[#3b82f6]";
                                dotClass = "bg-[#3b82f6]";
                            } else if (jenjang.name.includes("MA") || jenjang.name.includes("SMA")) {
                                bgClass = "bg-[#fffbeb] border-amber-100/60";
                                textClass = "text-[#f59e0b]";
                                dotClass = "bg-[#f59e0b]";
                            } else if (jenjang.name.includes("SMK") || jenjang.name.includes("TK")) {
                                bgClass = "bg-[#faf5ff] border-purple-100/60";
                                textClass = "text-[#a855f7]";
                                dotClass = "bg-[#a855f7]";
                            } else if (jenjang.name.includes("RA")) {
                                bgClass = "bg-[#fff1f2] border-rose-100/60";
                                textClass = "text-[#f43f5e]";
                                dotClass = "bg-[#f43f5e]";
                            }

                            return (
                                <div key={index} className={`rounded-[1.5rem] border ${bgClass} p-5 flex flex-col justify-between transition-transform hover:-translate-y-1 duration-300 shadow-sm`}>
                                    <div className="flex items-center gap-2 font-bold text-slate-700 mb-4">
                                        <div className={`w-2.5 h-2.5 rounded-full ${dotClass} shadow-sm`} />
                                        {jenjang.name}
                                    </div>
                                    <div className={`text-4xl lg:text-5xl font-black tracking-tighter ${textClass}`}>
                                        {percent}%
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  )
}

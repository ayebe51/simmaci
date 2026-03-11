import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Label } from "recharts"
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

        {/* ROW 2: Statistik Jenjang Madrasah (Full Width Premium) */}
        {unitData.length > 0 && (
            <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-0 bg-white/70 backdrop-blur-xl relative overflow-hidden rounded-2xl group">
                <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-gradient-to-br from-indigo-100/50 to-transparent blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-700" />
                <CardHeader className="border-b border-slate-100/60 pb-4 relative z-10">
                    <CardTitle className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-2">
                        <div className="w-1.5 h-5 bg-indigo-500 rounded-full"></div>
                        Statistik Jenjang Pendidikan
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-medium ml-3.5">
                        Sebaran jumlah guru berdasarkan tingkat madrasah.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 relative z-10">
                <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={unitData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorJenjang" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.6}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 12, fill: '#475569', fontWeight: 600}} 
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 11, fill: '#94a3b8'}} 
                            />
                            <Tooltip 
                                cursor={{fill: '#f8fafc', opacity: 0.5}} 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                itemStyle={{ color: '#475569', fontWeight: 600 }}
                                formatter={(value: any) => [`${value} Guru`, 'Jumlah']}
                            />
                            <Bar 
                                dataKey="jumlah" 
                                fill="url(#colorJenjang)" 
                                radius={[6, 6, 0, 0]} 
                                barSize={40}
                            >
                                {unitData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} className="hover:opacity-80 transition-opacity duration-300" />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                </CardContent>
            </Card>
        )}

        {/* ROW 3: Kecamatan (Full Width Premium) */}
        {kecData.length > 0 && (
            <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-0 bg-white/70 backdrop-blur-xl relative overflow-hidden rounded-2xl group">
                <div className="absolute top-0 left-0 w-[40%] h-[60%] bg-gradient-to-br from-amber-100/50 to-transparent blur-3xl pointer-events-none group-hover:scale-150 transition-transform duration-700" />
                <CardHeader className="border-b border-slate-100/60 pb-4 relative z-10">
                    <CardTitle className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-2">
                        <div className="w-1.5 h-5 bg-amber-500 rounded-full"></div>
                        Sebaran Guru per Kecamatan
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-medium ml-3.5">
                        Konsentrasi penempatan guru di setiap wilayah.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 relative z-10">
                <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={kecData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorKecamatan" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9}/>
                                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.6}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 12, fill: '#475569', fontWeight: 600}} 
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 11, fill: '#94a3b8'}} 
                            />
                            <Tooltip 
                                cursor={{fill: '#f8fafc', opacity: 0.5}} 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                itemStyle={{ color: '#475569', fontWeight: 600 }}
                                formatter={(value: any) => [`${value} Guru`, 'Jumlah']}
                            />
                            <Bar 
                                dataKey="jumlah" 
                                fill="url(#colorKecamatan)" 
                                radius={[6, 6, 0, 0]} 
                                barSize={40}
                            >
                                {kecData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} className="hover:opacity-80 transition-opacity duration-300" />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                </CardContent>
            </Card>
        )}
    </div>
  )
}

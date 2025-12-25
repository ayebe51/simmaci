import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { useEffect, useState } from "react"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

export function DashboardCharts() {
  const [statusData, setStatusData] = useState<any[]>([])
  const [unitData, setUnitData] = useState<any[]>([])
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const teachersStr = localStorage.getItem("app_teachers")
    if (teachersStr) {
      const teachers = JSON.parse(teachersStr)
      if (Array.isArray(teachers)) {
        // 1. Process Status Kepegawaian (Pie Chart)
        const statusCounts: Record<string, number> = {}
        teachers.forEach((t: any) => {
            if (!t.isActive) return
            const s = (t.status || "Lainnya").toUpperCase()
            // Grouping logic
            let label = s
            if (s.includes("GTY")) label = "GTY"
            else if (s.includes("GTT")) label = "GTT"
            else if (s.includes("PNS") || s.includes("PPPK")) label = "ASN"
            else if (s.includes("HONOR")) label = "HONORER"
            
            statusCounts[label] = (statusCounts[label] || 0) + 1
        })
        
        const pData = Object.keys(statusCounts).map(key => ({
            name: key,
            value: statusCounts[key]
        }))
        setStatusData(pData)

        // 2. Process Unit Kerja Distribution (Bar Chart - Top 5)
        const unitCounts: Record<string, number> = {}
        teachers.forEach((t: any) => {
             if (!t.isActive) return
             const u = t.unitKerja || "Tanpa Unit"
             unitCounts[u] = (unitCounts[u] || 0) + 1
        })
        
        const bData = Object.keys(unitCounts).map(key => ({
            name: key.replace("MI Ma'arif", "MI").replace("MTs Ma'arif", "MTs").substring(0, 15), // Shorten name
            jumlah: unitCounts[key]
        }))
        .sort((a,b) => b.jumlah - a.jumlah)
        .slice(0, 5) // Top 5
        
        setUnitData(bData)
      }
    }
  }, [])

  if (!isClient) return null // Prevent hydration mismatch if any

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
                        <Tooltip cursor={{fill: 'transparent'}} />
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
            Proporsi status guru di lingkungan Ma'arif.
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
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                            label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                            {statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
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

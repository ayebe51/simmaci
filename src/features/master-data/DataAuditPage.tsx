import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileWarning, UserX, CalendarX, Stethoscope, Download, ShieldCheck, Zap, AlertTriangle, ShieldAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function DataAuditPage() {
  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['data-audit-health'],
    queryFn: () => auditApi.healthCheck()
  });

  const summary = {
      dupes: issues.filter((i: any) => i.type.includes("DUPLICATE")).length,
      missing: issues.filter((i: any) => i.type.includes("MISSING")).length,
      future: issues.filter((i: any) => i.type.includes("FUTURE")).length,
      age: issues.filter((i: any) => i.type.includes("AGE") || i.type.includes("UNUSUAL")).length,
  };

  const getIcon = (type: string) => {
      if (type.includes("DUPLICATE")) return <UserX className="h-5 w-5 text-rose-500" />;
      if (type.includes("FUTURE")) return <CalendarX className="h-5 w-5 text-amber-500" />;
      if (type.includes("AGE") || type.includes("UNUSUAL")) return <AlertCircle className="h-5 w-5 text-sky-500" />;
      return <FileWarning className="h-5 w-5 text-slate-400" />;
  };

  const getSeverityStyle = (severity: string) => {
      if (severity === "high") return "bg-rose-50 text-rose-700 border-rose-100 shadow-sm shadow-rose-50";
      return "bg-amber-50 text-amber-700 border-amber-100 shadow-sm shadow-amber-50";
  };

  const handleExportCSV = () => {
    const headers = ["Tipe,Masalah,Nama,Sekolah,Severity"];
    const rows = issues.map((i: any) => 
        `"${i.type}","${i.message}","${i.name || '-'}","${i.school || '-'}","${i.severity}"`
    );
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Audit_Kualitas_Data_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">Infrastruktur Data Audit</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
               <ShieldCheck className="w-3 h-3 text-blue-500" /> Analisis Algoritmik & Diagnostik Integritas Basis Data
            </p>
        </div>
        <div className="flex gap-4">
            <Button variant="outline" onClick={handleExportCSV} className="h-14 rounded-2xl px-8 border-slate-200 font-black uppercase text-[10px] tracking-widest shadow-sm">
                <Download className="mr-2 h-4 w-4" /> Export Diagnostik
            </Button>
            <div className="h-14 px-8 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                <Stethoscope className="h-5 w-5 text-blue-600" />
                <span className="font-black text-slate-900 text-xs italic">{issues.length} Issues Found</span>
            </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard title="Duplikasi Identitas" value={summary.dupes} sub="NUPTK/Email Ganda" color="rose" />
        <StatCard title="Atribut Kosong" value={summary.missing} sub="Missing Required Fields" color="amber" />
        <StatCard title="Anomali Kronologi" value={summary.future} sub="Post-dated Entries" color="orange" />
        <StatCard title="Profil Unik" value={summary.age} sub="Outlier Age Analysis" color="sky" />
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-10 border-b bg-slate-50/50">
            <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 italic">
                <ShieldAlert className="h-5 w-5 text-rose-500" /> Temuan Diagnostik & Rekomendasi Mitigasi
            </CardTitle>
            <CardDescription className="font-bold text-slate-400 text-[10px] uppercase mt-2">Segera lakukan normalisasi data pada entitas terkait untuk menjaga validitas sistem.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? (
                <div className="p-32 text-center animate-pulse uppercase font-black text-slate-200 text-xs italic tracking-widest">Scanning Database Integrity...</div>
            ) : issues.length === 0 ? (
                <div className="p-32 text-center flex flex-col items-center">
                    <Zap className="h-16 w-16 mb-6 text-emerald-400/20" />
                    <h3 className="font-black text-2xl text-slate-300 uppercase italic tracking-tighter">Zero Vulnerability</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Seluruh parameter data berada dalam ambang batas normal.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-b border-slate-100">
                            <TableHead className="p-8 w-[60px]"></TableHead>
                            <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Diagnosa Masalah</TableHead>
                            <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Entitas Terdampak</TableHead>
                            <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Unit Kerja</TableHead>
                            <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Severity</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {issues.map((issue: any, i: number) => (
                            <TableRow key={i} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50">
                                <TableCell className="p-8 text-center">{getIcon(issue.type)}</TableCell>
                                <TableCell className="p-8">
                                    <div className="font-black text-slate-800 text-xs tracking-tight uppercase">{issue.message}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Code: {issue.type}</div>
                                </TableCell>
                                <TableCell className="p-8 font-black text-slate-500 text-xs italic tracking-tighter uppercase">{issue.name || "-"}</TableCell>
                                <TableCell className="p-8 font-bold text-slate-400 text-[10px] uppercase">{issue.school || "-"}</TableCell>
                                <TableCell className="p-8 text-right">
                                    <Badge variant="outline" className={cn("rounded-lg text-[9px] font-black uppercase px-3 py-1", getSeverityStyle(issue.severity))}>
                                        {issue.severity}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, sub, color }: any) {
    const colors: any = {
        rose: "text-rose-600 bg-rose-50",
        amber: "text-amber-600 bg-amber-50",
        orange: "text-orange-600 bg-orange-50",
        sky: "text-sky-600 bg-sky-50"
    };
    return (
        <Card className="border-0 shadow-sm bg-white rounded-[2rem] p-8 hover:-translate-y-1 transition-all duration-300 group">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 group-hover:text-blue-500 transition-colors">{title}</h3>
            <div className="flex items-end gap-3">
                <div className={cn("text-4xl font-black italic tracking-tighter", colors[color].split(' ')[0])}>{value}</div>
                <div className="mb-1 text-[9px] font-bold text-slate-300 uppercase leading-none">{sub}</div>
            </div>
        </Card>
    )
}

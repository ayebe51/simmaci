
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileWarning, UserX, CalendarX, Stethoscope } from "lucide-react";

export default function DataAuditPage() {
  const issues = useQuery(api.audit.runHealthCheck);

  // Group by type for summary (Safe Access)
  const safeIssues = issues || [];
  const summary = {
      dupes: safeIssues.filter(i => i.type.includes("DUPLICATE")).length,
      missing: safeIssues.filter(i => i.type.includes("MISSING")).length,
      future: safeIssues.filter(i => i.type.includes("FUTURE")).length,
      age: safeIssues.filter(i => i.type.includes("AGE")).length,
  };

  const getIcon = (type: string) => {
      if (type.includes("DUPLICATE")) return <UserX className="h-4 w-4 text-red-500" />;
      if (type.includes("FUTURE")) return <CalendarX className="h-4 w-4 text-orange-500" />;
      if (type.includes("AGE")) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      return <FileWarning className="h-4 w-4 text-slate-500" />;
  };

  const getSeverityColor = (severity: string) => {
      if (severity === "high") return "bg-red-100 text-red-800 border-red-200";
      return "bg-amber-100 text-amber-800 border-amber-200";
  };

  return (
    <div className="space-y-6 container py-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-2xl font-bold tracking-tight text-slate-900">Health Check Data</h1>
           <p className="text-slate-500">Analisis otomatis kualitas data guru dan tendik.</p>
        </div>
        <div className="flex space-x-2">
            <Badge variant="outline" className="px-3 py-1 bg-white">
                <Stethoscope className="mr-2 h-4 w-4 text-green-600" />
                Total Isu: {issues?.length || 0}
            </Badge>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Duplikasi NUPTK</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-red-600">{summary.dupes}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Data Lahir Kosong</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-orange-600">{summary.missing}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">TMT Masa Depan</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-amber-600">{summary.future}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Umur Tidak Wajar</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-slate-600">{summary.age}</div>
            </CardContent>
        </Card>
      </div>

      {/* ISSUE LIST */}
      <Card className="border-red-100 bg-red-50/10">
        <CardHeader>
            <CardTitle className="text-red-700 flex items-center">
                <AlertCircle className="mr-2 h-5 w-5" />
                Daftar Temuan
            </CardTitle>
            <CardDescription>Segera perbaiki data berikut agar laporan valid.</CardDescription>
        </CardHeader>
        <CardContent>
            {issues === undefined ? (
                <div className="p-8 text-center text-slate-500">Sedang Mendiagnosa...</div>
            ) : issues.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center text-green-600">
                    <Stethoscope className="h-12 w-12 mb-4 opacity-20" />
                    <h3 className="font-semibold text-lg">Sehat Walafiat!</h3>
                    <p className="text-sm opacity-80">Tidak ditemukan anomali data.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">Tipe</TableHead>
                            <TableHead>Masalah</TableHead>
                            <TableHead>Nama Guru (Jika Ada)</TableHead>
                            <TableHead>Sekolah</TableHead>
                            <TableHead className="text-right">Tingkat</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {issues.map((issue, i) => (
                            <TableRow key={i}>
                                <TableCell>{getIcon(issue.type)}</TableCell>
                                <TableCell className="font-medium text-slate-700">{issue.message}</TableCell>
                                <TableCell>{issue.name || "-"}</TableCell>
                                <TableCell className="text-xs text-slate-500">{issue.school || "-"}</TableCell>
                                <TableCell className="text-right">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold tracking-wide ${getSeverityColor(issue.severity)}`}>
                                        {issue.severity}
                                    </span>
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

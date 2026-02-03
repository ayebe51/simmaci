import { useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, ShieldCheck, FileText, User, Calendar } from "lucide-react"
// 🔥 CONVEX for real-time verification
import { useQuery } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"

export default function PublicVerificationPage() {
    const { id } = useParams()
    
    // 🔥 REAL-TIME CONVEX QUERY - Verify SK by code
    const verificationData = useQuery(
        convexApi.verification.verifyByCode, 
        id ? { code: id } : "skip"
    )
    
    const status = verificationData === undefined ? "loading" 
                  : verificationData === null ? "invalid" 
                  : "valid"
    const data = verificationData


    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center">
                        <ShieldCheck className="w-10 h-10 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-800">Verifikasi Dokumen</CardTitle>
                    <p className="text-sm text-muted-foreground">Digital Signature Verification System</p>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {status === "loading" && (
                        <div className="text-center py-10">
                            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-muted-foreground">Memverifikasi keaslian dokumen...</p>
                        </div>
                    )}

                    {status === "invalid" && (
                        <div className="text-center py-6 bg-red-50 rounded-lg border border-red-100">
                            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-red-700">Dokumen Tidak Ditemukan</h3>
                            <p className="text-sm text-red-600 px-4 mt-2">
                                Kode verifikasi tidak valid atau dokumen telah dihapus dari sistem.
                            </p>
                        </div>
                    )}

                    {status === "valid" && data && (
                        <>
                            <div className="bg-green-50 border border-green-100 rounded-lg p-6 text-center">
                                <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-3" />
                                <h3 className="text-xl font-bold text-green-800">DOKUMEN VALID</h3>
                                <p className="text-sm text-green-700 mt-1">
                                    Dokumen ini tercatat resmi di database SIM Maarif.
                                </p>
                            </div>

                            <div className="space-y-4 border-t pt-4">
                                <div className="flex items-start gap-3">
                                    <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-muted-foreground font-semibold uppercase">Nomor SK</p>
                                        <p className="font-medium text-slate-800 break-all">{data.skNumber || "-"}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <User className="w-5 h-5 text-slate-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-muted-foreground font-semibold uppercase">Nama Pemilik</p>
                                        <p className="font-medium text-slate-800">{data.teacher?.nama}</p>
                                        <p className="text-xs text-slate-500">NUPTK: {data.teacher?.nuptk || "-"}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-muted-foreground font-semibold uppercase">Status Masa Aktif</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                {data.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    
                    <div className="text-center pt-6 border-t">
                        <p className="text-xs text-slate-400">
                            &copy; {new Date().getFullYear()} LP Ma'arif NU Kab. Cilacap
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

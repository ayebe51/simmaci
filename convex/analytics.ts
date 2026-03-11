import { query } from "./_generated/server";
import { v } from "convex/values";
import { determineTeacherStatus } from "./utils";

// Helper to normalize strings for aggregation
const normalize = (str?: string) => (str || "Tidak Diketahui").trim();

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch ALL teachers (Consider pagination/indexing for scale later, but fine for <10k records)
    const teachers = await ctx.db.query("teachers").collect();
    
    // Aggregation Containers
    const statusCounts: Record<string, number> = {
        "PNS": 0,
        "GTY": 0,
        "GTT": 0,
        "Tendik": 0,
        // "Lainnya" removed per user request
    };
    const certCounts: Record<string, number> = { "Sudah Sertifikasi": 0, "Belum Sertifikasi": 0 };
    const jenjangCounts: Record<string, number> = {
        "RA": 0,
        "MI": 0,
        "MTs": 0,
        "MA": 0,
        "SMK": 0,
        "Lainnya": 0
    };
    const kecamatanCounts: Record<string, number> = {};

    // 2. Iterate and Aggregate
    for (const t of teachers) {
      // Skip inactive teachers
      if (t.isActive === false) continue;

      // A. Status Kepegawaian (GTY, GTT, PNS, Tendik)
      // Normalize specifically to handle variations
      // A. Status Kepegawaian Logic
      // A. Status Kepegawaian (GTY, GTT, PNS, Tendik)
      // Use shared helper
      const statusLabel = determineTeacherStatus(t);

      // Only increment if matched
      if (statusLabel && statusCounts[statusLabel] !== undefined) {
          statusCounts[statusLabel]++;
      }

      // B. Certification Status (Only for Teachers, exclude Tendik)
      if (statusLabel !== "Tendik") {
          if (t.isCertified) {
            certCounts["Sudah Sertifikasi"]++;
          } else {
            certCounts["Belum Sertifikasi"]++;
          }
      }

      // C. Jenjang Pendidikan (School Level)
      const unit = normalize(t.unitKerja);
      if (unit.startsWith("RA ") || unit.startsWith("TK ")) jenjangCounts["RA"]++;
      else if (unit.startsWith("MI ") || unit.startsWith("SD ")) jenjangCounts["MI"]++;
      else if (unit.startsWith("MTs ") || unit.startsWith("SMP ")) jenjangCounts["MTs"]++;
      else if (unit.startsWith("MA ") || unit.startsWith("SMA ")) jenjangCounts["MA"]++;
      else if (unit.startsWith("SMK ")) jenjangCounts["SMK"]++;
      else jenjangCounts["Lainnya"]++;

      // D. Kecamatan
      const kec = normalize(t.kecamatan);
      kecamatanCounts[kec] = (kecamatanCounts[kec] || 0) + 1;
    }

    // 3. Format for Recharts (Array of Objects)
    
    // Status Data
    const statusData = Object.entries(statusCounts)
      .filter(([_, value]) => value > 0 || ["PNS", "GTY", "GTT", "Tendik"].includes(_)) // Keep main keys even if 0
      .map(([name, value]) => ({ name, value }));

    // Certification Data
    const certData = Object.entries(certCounts)
      .map(([name, value]) => ({ name, value }));

    // Jenjang Data
    const jenjangData = Object.entries(jenjangCounts)
      .map(([name, jumlah]) => ({ name, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah);

    const kecamatanData = Object.entries(kecamatanCounts)
      .map(([name, jumlah]) => ({ name, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah);

    // 4. Teacher Trend (Last 6 Months)
    const now = new Date();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return {
            monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleString('id-ID', { month: 'short' }),
            count: 0
        };
    }).reverse();

    for (const t of teachers) {
        const d = new Date(t.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = last6Months.find(b => b.monthKey === key);
        if (bucket) {
            bucket.count++;
        }
    }

    return {
      status: statusData,
      units: jenjangData, // Keeping the key as 'units' to avoid breaking frontend blindly, handling frontend update next
      certification: certData,
      kecamatan: kecamatanData,
      teacherTrend: last6Months.map(({ label, count }) => ({ month: label, count })),
      totalTeachers: teachers.filter(t => t.isActive !== false).length,
      totalSchools: await ctx.db.query("schools").collect().then(s => s.length),
      totalStudents: await ctx.db.query("students").collect().then(s => s.length),
      totalSk: await ctx.db.query("skDocuments").collect().then(s => s.length)
    };
  },
});

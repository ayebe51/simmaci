import { query } from "./_generated/server";
import { v } from "convex/values";

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
    const unitCounts: Record<string, number> = {};
    const kecamatanCounts: Record<string, number> = {};

    // 2. Iterate and Aggregate
    for (const t of teachers) {
      // Skip inactive teachers
      if (t.isActive === false) continue;

      // A. Status Kepegawaian (GTY, GTT, PNS, Tendik)
      // Normalize specifically to handle variations
      // A. Status Kepegawaian Logic
      // Priority 1: Check Explicit PNS/ASN
      let rawStatus = (t.status || "").trim().toUpperCase();
      let statusLabel = "";
      
      if (rawStatus.includes("PNS") || rawStatus.includes("ASN") || rawStatus.includes("PPPK") || rawStatus.includes("CPNS")) {
          statusLabel = "PNS";
      } else {
          // Priority 2: Check Education (Tendik if < S1)
          const edu = (t.pendidikanTerakhir || "").trim().toUpperCase();
          const tendikEdu = ["SD", "SMP", "SMA", "SMK", "D1", "D2", "D3"];
          
          if (tendikEdu.some(e => edu === e || edu.startsWith(e + " "))) { // Handle "SMA IPA" etc
             statusLabel = "Tendik";
          } else if (rawStatus.includes("TENDIK") || rawStatus.includes("TU") || rawStatus.includes("OPERATOR") || rawStatus.includes("PENJAGA")) {
             statusLabel = "Tendik";
          } else {
             // Priority 3: Check TMT for GTY/GTT
             if (t.tmt) {
                const tmtDate = new Date(t.tmt);
                if (!isNaN(tmtDate.getTime())) {
                   const now = new Date();
                   const diffTime = Math.abs(now.getTime() - tmtDate.getTime());
                   const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
                   statusLabel = diffYears >= 2 ? "GTY" : "GTT";
                }
             }

             // Fallback if no TMT
             if (!statusLabel) {
                 if (rawStatus.includes("GTY") || rawStatus.includes("TETAP")) statusLabel = "GTY";
                 else statusLabel = "GTT";
             }
          }
      }

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

      // C. Unit Kerja (School)
      const unit = normalize(t.unitKerja);
      unitCounts[unit] = (unitCounts[unit] || 0) + 1;

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

    // Unit Data (Top 5)
    const unitData = Object.entries(unitCounts)
      .map(([name, jumlah]) => ({ name, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 5);

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
      units: unitData,
      certification: certData,
      kecamatan: kecamatanData,
      teacherTrend: last6Months.map(({ label, count }) => ({ month: label, count })),
      totalTeachers: teachers.length,
      totalSchools: await ctx.db.query("schools").collect().then(s => s.length),
      totalStudents: await ctx.db.query("students").collect().then(s => s.length),
      totalSk: await ctx.db.query("skDocuments").collect().then(s => s.length)
    };
  },
});

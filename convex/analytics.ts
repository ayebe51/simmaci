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
        "Lainnya": 0
    };
    const certCounts: Record<string, number> = { "Sudah Sertifikasi": 0, "Belum Sertifikasi": 0 };
    const unitCounts: Record<string, number> = {};
    const kecamatanCounts: Record<string, number> = {};

    // 2. Iterate and Aggregate
    for (const t of teachers) {
      // A. Status Kepegawaian (GTY, GTT, PNS, Tendik)
      // Normalize specifically to handle variations
      let rawStatus = (t.status || "").trim().toUpperCase();
      let statusLabel = "Lainnya";

      if (rawStatus.includes("PNS") || rawStatus.includes("ASN") || rawStatus.includes("PPPK") || rawStatus.includes("CPNS")) statusLabel = "PNS";
      else if (rawStatus.includes("GTY") || rawStatus.includes("TETAP YAYASAN") || rawStatus.includes("GURU TETAP")) statusLabel = "GTY";
      else if (rawStatus.includes("GTT") || rawStatus.includes("TIDAK TETAP") || rawStatus.includes("HONOR")) statusLabel = "GTT";
      else if (rawStatus.includes("TENDIK") || rawStatus.includes("TU") || rawStatus.includes("TATA USAHA") || rawStatus.includes("ADMINISTRASI") || rawStatus.includes("OPS") || rawStatus.includes("OPERATOR") || rawStatus.includes("PENJAGA") || rawStatus.includes("KEAMANAN") || rawStatus.includes("KEBERSIHAN")) statusLabel = "Tendik";
      else if (rawStatus === "ACTIVE" || rawStatus === "AKTIF" || rawStatus === "TRUE") statusLabel = "Lainnya"; 
      else if (rawStatus !== "") statusLabel = "Lainnya"; // Unknown

      statusCounts[statusLabel]++;

      // B. Certification Status
      if (t.isCertified) {
        certCounts["Sudah Sertifikasi"]++;
      } else {
        certCounts["Belum Sertifikasi"]++;
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

    // Kecamatan Data
    const kecamatanData = Object.entries(kecamatanCounts)
      .map(([name, jumlah]) => ({ name, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah);

    return {
      totalTeachers: teachers.length,
      status: statusData,
      certification: certData,
      units: unitData,
      kecamatan: kecamatanData
    };
  },
});

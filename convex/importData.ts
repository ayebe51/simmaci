
import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper to normalize Status
function normalizeStatus(val: string): string {
  if (!val) return "GTT";
  const s = String(val).toLowerCase().trim();
  if (s.includes("gty") || s.includes("tetap yayasan")) return "GTY";
  if (s.includes("pns") || s.includes("asn")) return "PNS";
  if (s.includes("pppk") || s.includes("p3k")) return "PPPK";
  if (s.includes("tendik") || s.includes("tenaga pendidik")) return "Tendik";
  if (s.includes("honorer") || s.includes("gtt") || s.includes("tidak tetap")) return "GTT";
  return val; // Fallback to original
}

// Helper to normalize Certification
function normalizeCert(val: any): boolean {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return s === "true" || s === "ya" || s === "sudah" || s.includes("sertifi") || s === "lulus" || s === "v";
}

// Helper to normalize PDPKPNU
function normalizePdpkpnu(val: any): string {
  if (!val) return "Belum";
  const s = String(val).toLowerCase().trim();
  if (s === "sudah" || s === "ya" || s === "lulus" || s.includes("sertifi") || s === "v") return "Sudah";
  return "Belum";
}

export const run = mutation({
  args: {
    teachers: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let success = 0;
    let updated = 0;
    const errors: string[] = [];

    // 1. Get User Context for Security & Auto-linking
    const identity = await ctx.auth.getUserIdentity();
    let operatorSchoolId: any = undefined;
    
    if (identity) {
        const user = await ctx.db.query("users").withIndex("by_email", q=>q.eq("email", identity.email!)).first();
        if (user && user.role === "operator" && user.schoolId) {
            operatorSchoolId = user.schoolId;
        }
    }

    // Prioritize new field names, fallback to old
    for (const t of args.teachers) {
      try {
        const nuptk = String(t.nuptk || t.NUPTK || "").trim();
        const nama = String(t.nama || t.NAMA || t.Name || "").trim();

        if (!nuptk || !nama) continue;

        // Extract raw values for normalization
        const rawStatus = t.status || t.STATUS || t.Status || "";
        const rawCert = t.isCertified || t.sertifikasi || t.SERTIFIKASI || t['Status Sertifikasi'];
        const rawPdpkpnu = t.pdpkpnu || t.PDPKPNU || t['Status PDPKPNU'];

        const cleanData: any = {
          nuptk,
          nama,
          // Safe defaults for optional string fields to prevent "undefined" errors
          unitKerja: String(t.unitKerja || t.satminkal || t.SATMINKAL || t['Unit Kerja'] || t.sekolah || "-").trim(),
          status: normalizeStatus(rawStatus),
          tmt: String(t.tmt || t.TMT || "-").trim(),
          pendidikanTerakhir: String(t.pendidikanTerakhir || t.pendidikan || t.PENDIDIKAN || "-").trim(),
          mapel: String(t.mapel || t.MAPEL || t.jabatan || "-").trim(),
          
          // Identity fields (undefined is okay here if schema allows optional)
          nip: t.nip || t.NIP || undefined,
          tempatLahir: t.tempatLahir || t.birthPlace || undefined,
          tanggalLahir: t.tanggalLahir || t.birthDate || undefined,
          jenisKelamin: t.jenisKelamin || t.jk || undefined,
          
          // Booleans & Enums
          pdpkpnu: normalizePdpkpnu(rawPdpkpnu),
          isCertified: normalizeCert(rawCert),
          
          // Critical Flags for Visibility
          isSkGenerated: false, 
          isActive: true, // Upsert should reactivate
          
          updatedAt: now,
        };

        // ENFORCE SCHOOL ID for Operators
        if (operatorSchoolId) {
            cleanData.schoolId = operatorSchoolId;
        }

        const existing = await ctx.db
          .query("teachers")
          .withIndex("by_nuptk", q => q.eq("nuptk", nuptk))
          .first();

        if (existing) {
          await ctx.db.patch(existing._id, cleanData);
          updated++;
        } else {
          await ctx.db.insert("teachers", {
            ...cleanData,
            createdAt: now,
          });
          success++;
        }
      } catch (err: any) {
        errors.push(`${t.nama}: ${err.message}`);
      }
    }

    return { 
      count: success + updated, 
      new: success, 
      updated: updated, 
      errors, 
      version: "4.2 (Context Aware)" 
    };
  },
});

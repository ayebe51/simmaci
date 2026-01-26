
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const run = mutation({
  args: {
    teachers: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let success = 0;
    let updated = 0;
    const errors: string[] = [];

    // Prioritize new field names, fallback to old
    for (const t of args.teachers) {
      try {
        const nuptk = String(t.nuptk || t.NUPTK || "").trim();
        const nama = String(t.nama || t.NAMA || t.Name || "").trim();

        if (!nuptk || !nama) continue;

        const cleanData = {
          nuptk,
          nama,
          unitKerja: t.unitKerja || t.satminkal || t.SATMINKAL || t['Unit Kerja'] || t.sekolah || "",
          status: t.status || t.STATUS || "GTT",
          tmt: t.tmt || t.TMT || "",
          pendidikanTerakhir: t.pendidikanTerakhir || t.pendidikan || t.PENDIDIKAN || "",
          mapel: t.mapel || t.MAPEL || t.jabatan || "",
          nip: t.nip || t.NIP || undefined,
          tempatLahir: t.tempatLahir || t.birthPlace || undefined,
          tanggalLahir: t.tanggalLahir || t.birthDate || undefined,
          jenisKelamin: t.jenisKelamin || t.jk || undefined,
          pdpkpnu: t.pdpkpnu || "Belum",
          isCertified: t.isCertified === true || t.isCertified === "true",
          updatedAt: now,
        };

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
            isActive: true,
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
      version: "4.0 (Isolated File)" 
    };
  },
});

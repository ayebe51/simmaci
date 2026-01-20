import { query } from "./_generated/server";
import { v } from "convex/values";

// Verify SK by verification code/ID
export const verifyByCode = query({
  args: { 
    code: v.string() 
  },
  handler: async (ctx, args) => {
    // Try to find SK document by ID or nomor SK
    let sk = null;
    
    // First try by document ID
    try {
      sk = await ctx.db.get(args.code as any);
      // Verify it's an SK document
      if (sk && !("nomorSk" in sk)) {
        sk = null;
      }
    } catch {
      // Not a valid ID, try searching by nomor SK
      sk = await ctx.db
        .query("skDocuments")
        .filter((q) => q.eq(q.field("nomorSk"), args.code))
        .first();
    }
    
    if (!sk) {
      return null;
    }
    
    // Get teacher data if exists
    let teacher = null;
    if (sk.teacherId) {
      teacher = await ctx.db.get(sk.teacherId);
    }
    
    return {
      skNumber: sk.nomorSk,
      status: sk.status,
      teacher: teacher ? {
        nama: teacher.nama,
        nuptk: teacher.nuptk,
        nip: teacher.nip
      } : { nama: sk.nama, nuptk: "-", nip: "-" },
      issuedDate: sk.createdAt,
      validUntil: sk.tanggalPenetapan
    };
  },
});

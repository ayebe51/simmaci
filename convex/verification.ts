import { query } from "./_generated/server";
import { v } from "convex/values";

// Verify SK by verification code/ID  
export const verifyByCode = query({
  args: { 
    code: v.string() 
  },
  handler: async (ctx, args) => {
    // Search for SK document by nomor SK
    const sk = await ctx.db
      .query("skDocuments")
      .filter((q) => q.eq(q.field("nomorSk"), args.code))
      .first();
    
    if (!sk) {
      return null;
    }
    
    // Get teacher data if exists
    let teacherInfo = null;
    if (sk.teacherId) {
      const teacher = await ctx.db.get(sk.teacherId);
      if (teacher) {
        teacherInfo = {
          nama: teacher.nama,
          nuptk: teacher.nuptk,
          nip: teacher.nip || "-"
        };
      }
    }
    
    // Fallback to SK nama if no teacher
    if (!teacherInfo) {
      teacherInfo = {
        nama: sk.nama,
        nuptk: "-",
        nip: "-"
      };
    }
    
    return {
      skNumber: sk.nomorSk,
      status: sk.status,
      teacher: teacherInfo,
      issuedDate: sk.createdAt,
      validUntil: sk.tanggalPenetapan
    };
  },
});

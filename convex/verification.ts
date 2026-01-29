import { query } from "./_generated/server";
import { v } from "convex/values";

// Verify SK by verification code/ID  
export const verifyByCode = query({
  args: { 
    code: v.string() 
  },
  handler: async (ctx, args) => {
    // Search for SK document by ID (safer for URLs than Nomor SK which has slashes)
    // We treat 'code' argument as an ID now.
    
    // 1. Try to treat args.code as a valid ID for "skDocuments" table
    const skId = ctx.db.normalizeId("skDocuments", args.code);
    
    let sk = null;
    
    if (skId) {
        // If it's a valid ID format, try to fetch it directly
        sk = await ctx.db.get(skId);
    }
    
    // 2. If valid ID lookup failed or returned null (id didn't exist), fallback to legacy Nomor SK lookup
    if (!sk) {
         sk = await ctx.db
            .query("skDocuments")
            .filter((q) => q.eq(q.field("nomorSk"), args.code))
            .first();
    }
            
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
      validUntil: sk.tanggalPenetapan,
      // Add more verification details if needed
      isQrValid: true
    };
  },
});

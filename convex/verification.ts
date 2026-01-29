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
    let sk = null;
    try {
        // Validation: Verify it looks like an ID to prevent invalid ID errors
        sk = await ctx.db.get(args.code as any);
    } catch (e) {
        // If args.code is not a valid ID format, ctx.db.get might throw or return null depending on system
        // We'll try legacy lookup by Nomor SK just in case (backward compatibility)
        sk = await ctx.db
            .query("skDocuments")
            .filter((q) => q.eq(q.field("nomorSk"), args.code))
            .first();
    }
    
    if (!sk) {
        // Second attempt: Try explicit query if get failed
         sk = await ctx.db
            .query("skDocuments")
            .filter((q) => q.eq(q.field("nomorSk"), args.code))
            .first();
            
         if (!sk) return null;
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

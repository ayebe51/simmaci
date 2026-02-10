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
    
    // 0. DEBUG: Bypass for testing
    if (args.code === "tes-ganti-nama") {
      return {
        skNumber: "TEST/SK/2026",
        status: "invalid", // Show as invalid to test UI
        teacher: { nama: "Test User", nuptk: "-" },
        issuedDate: Date.now(),
        validUntil: Date.now()
      };
    }

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
    let teacherInfo: any = null;
    if (sk.teacherId) {
      const teacher = await ctx.db.get(sk.teacherId);
      if (teacher) {
        teacherInfo = {
          nama: teacher.nama,
          nuptk: teacher.nuptk,
          nip: teacher.nip || "-",
          isActive: teacher.isActive
        };
      }
    }
    
    // Fallback to SK nama if no teacher
    if (!teacherInfo) {
      teacherInfo = {
        nama: sk.nama,
        nuptk: "-",
        nip: "-",
        isActive: false // Assume inactive if no linked teacher
      };
    } else {
        // Ensure isActive is boolean
        teacherInfo.isActive = teacherInfo.isActive ?? true;
    }
    
    // Expiration Logic (1 Year Validity)
    const issuedDate = sk.createdAt;
    const oneYear = 1000 * 60 * 60 * 24 * 365; // 1 Year in ms
    const validUntilTimestamp = issuedDate + oneYear;
    const isExpired = Date.now() > validUntilTimestamp;

    return {
      skNumber: sk.nomorSk,
      status: sk.status,
      teacher: teacherInfo,
      issuedDate: sk.createdAt,
      validUntil: new Date(validUntilTimestamp).toISOString(),
      isExpired: isExpired, 
      isQrValid: true
    };
  },
});

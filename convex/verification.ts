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
         // Try skDocuments by number
         sk = await ctx.db
            .query("skDocuments")
            .filter((q) => q.eq(q.field("nomorSk"), args.code))
            .first();

         // If still null, TRY HEADMASTERS TABLE (New Feature)
         if (!sk) {
             try {
                // Force cast to any to bypass table name check if needed, or use string
                // But normalizeId expects a valid table name from schema. 
                // Using "headmasters" should be valid if it's in schema. 
                // If lint complains, it might be due to generic inference.
                const headmasterId = ctx.db.normalizeId("headmasters" as any, args.code);
                if (headmasterId) {
                    const hm = await ctx.db.get(headmasterId);
                    if (hm) {
                        // Normalize Headmaster object to resemble SK object for frontend compatibility
                        sk = {
                            _id: hm._id,
                            nomorSk: hm.nomorSk || "-",
                            status: (hm.status === 'approved' ? 'valid' : 'invalid') as any,
                            teacherId: hm.teacherId, 
                            createdAt: hm._creationTime, 
                            nama: "", 
                        }
                    }
                }
             } catch (e) {
                 // Ignore errors
             }
         }
    }
            
    if (!sk) {
      return null;
    }
    
    // Get teacher data if exists
    let teacherInfo: any = null;
    
    // Safe access to teacherId (it exists on both SK and Headmaster objects we created)
    const teacherId = (sk as any).teacherId;

    if (teacherId) {
      const teacher = await ctx.db.get(teacherId);
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
      const skAny = sk as any;
      teacherInfo = {
        nama: skAny.nama || (skAny.teacher?.nama) || "-", 
        nuptk: skAny.nuptk || "-",
        nip: skAny.nip || "-",
        isActive: false // Assume inactive if no linked teacher
      };
    } else {
        // Ensure isActive is boolean
        teacherInfo.isActive = teacherInfo.isActive ?? true;
    }
    
    // Expiration Logic (1 Year Validity)
    const issuedDate = sk.createdAt; // Both have createdAt or _creationTime
    const oneYear = 1000 * 60 * 60 * 24 * 365; // 1 Year in ms
    const validUntilTimestamp = issuedDate + oneYear;
    const isExpired = Date.now() > validUntilTimestamp;

    return {
      skNumber: sk.nomorSk,
      status: (sk as any).status || "valid",
      teacher: teacherInfo,
      issuedDate: sk.createdAt,
      validUntil: new Date(validUntilTimestamp).toISOString(),
      isExpired: isExpired, 
      isQrValid: true
    };
  },
});

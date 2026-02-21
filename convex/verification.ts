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

         // If still null, TRY HEADMASTER TENURES TABLE (Correct Table Name)
         if (!sk) {
             try {
                // 1. Try treating code as a direct ID
                const headmasterId = ctx.db.normalizeId("headmasterTenures" as any, args.code);
                if (headmasterId) {
                    const hm = await ctx.db.get(headmasterId);
                    if (hm) {
                        // Fetch School for Description
                        const school = await ctx.db.get(hm.schoolId);
                        const schoolName = school ? (school as any).nama : "";
                        const startYear = new Date(hm.startDate).getFullYear();
                        const endYear = new Date(hm.endDate).getFullYear();
                        
                        const description = `Aktif Menjadi Kepala ${schoolName}\nPeriode ${startYear}-${endYear}`;

                         // FOUND IT! Map to SK format
                        sk = {
                            _id: hm._id,
                            nomorSk: (hm as any).nomorSk || "SK DIGITAL", // Prioritize saved Nomor SK
                            status: (hm.status === 'approved' ? 'valid' : 'invalid') as any,
                            teacherId: hm.teacherId, 
                            createdAt: hm._creationTime, 
                            nama: "", 
                            jenisSk: "kamad",
                            tanggalPenetapan: hm.startDate,
                            updatedAt: hm._creationTime,
                            description: description // Custom field for frontend
                        } as any;
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
      const teacher = (await ctx.db.get(teacherId)) as any;
      if (teacher) {
        teacherInfo = {
          nama: teacher.nama || teacher.name || "-", // Fallback for Users if mixed
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
      isQrValid: true,
      description: (sk as any).description, // Pass description to frontend
      jenisSk: (sk as any).jenisSk
    };
  },
});

// Verify Teacher by NUPTK (For KTA QR Code)
export const verifyByNuptk = query({
  args: { 
    nuptk: v.string() 
  },
  handler: async (ctx, args) => {
    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_nuptk", (q) => q.eq("nuptk", args.nuptk))
      .first();

    if (!teacher) {
      return null;
    }

    // Map to verification format
    return {
      skNumber: "KTA-MEMBER",
      status: "valid",
      teacher: {
        nama: teacher.nama,
        nuptk: teacher.nuptk,
        nip: teacher.nip || "-",
        isActive: teacher.isActive ?? true
      },
      issuedDate: teacher._creationTime,
      validUntil: null, // Membership doesn't expire like SK
      isExpired: false,
      isQrValid: true,
      jenisSk: "kta"
    };
  },
});

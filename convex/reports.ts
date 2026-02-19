// @ts-nocheck
import { v } from "convex/values"
import { query } from "./_generated/server"

// Main SK report generation with filters
export const generateSkReport = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    schoolId: v.optional(v.string()), // Relaxed from v.id
    status: v.optional(v.string()),
    teacherId: v.optional(v.string()), // Relaxed from v.id
  },
  handler: async (ctx, args) => {
    try {
        // Fetch all SK documents
        const allSks = await ctx.db.query("skDocuments").collect() || [];
        
        // Apply filters
        let filtered = Array.isArray(allSks) ? allSks : [];
        
        // Date range filter
        if (args.startDate || args.endDate) {
          filtered = filtered.filter(sk => {
            const createdAt = sk.createdAt || 0
            if (args.startDate && createdAt < args.startDate) return false
            if (args.endDate && createdAt > args.endDate) return false
            return true
          })
        }
        
        // Status filter
        if (args.status) {
          filtered = filtered.filter(sk => sk.status === args.status)
        }
        
        // School filter
        if (args.schoolId) {
          try {
              // Try to treat as ID first
              const school = await ctx.db.get(args.schoolId as any);
              if (school) {
                const targetSchoolName = school.nama;
                filtered = filtered.filter(sk => sk.unitKerja === targetSchoolName);
              }
          } catch (e) {
              // If it failed (e.g. invalid ID), assume it IS the name (Legacy support)
              // args.schoolId might be "MI Ma'arif 01" directly
              filtered = filtered.filter(sk => sk.unitKerja === args.schoolId);
          }
        }
        
        // Teacher filter
        if (args.teacherId) {
          filtered = filtered.filter(sk => sk.teacherId === args.teacherId)
        }
        
        // Enrich with related data (schools, teachers)
        const enriched = await Promise.all(
          filtered.map(async (sk) => {
            try {
                // unitKerja is likely a string name, not an ID. Try to treat as ID only if it looks like one, 
                // but for now, since schema says string, likely just name.
                
                const schoolName = sk.unitKerja || 'N/A';
                
                let teacher = null;
                if (sk.teacherId) {
                    try {
                        teacher = await ctx.db.get(sk.teacherId);
                    } catch {
                        // Ignore invalid ID error
                    }
                }
                
                return {
                  ...sk,
                  schoolName: schoolName,
                  teacherName: teacher?.nama || 'N/A',
                  teacherNIP: teacher?.nip || '-',
                }
            } catch (error) {
                console.error(`Error processing SK ${sk._id}:`, error);
                return {
                    ...sk,
                    schoolName: 'Error',
                    teacherName: 'Error',
                    teacherNIP: '-',
                }
            }
          })
        )
        
        // Calculate summary statistics
        const summary = {
          total: enriched.length,
          pending: enriched.filter(sk => (sk.status || "").toLowerCase() === 'pending').length,
          approved: enriched.filter(sk => (sk.status || "").toLowerCase() === 'approved' || (sk.status || "").toLowerCase() === 'disetujui').length,
          rejected: enriched.filter(sk => (sk.status || "").toLowerCase() === 'rejected' || (sk.status || "").toLowerCase() === 'ditolak').length,
          draft: enriched.filter(sk => (sk.status || "").toLowerCase() === 'draft').length,
        }
        
        // Group by SK type
        const byType = {
          gty: enriched.filter(sk => (sk.jenisSk || "").toLowerCase().includes('tetap yayasan')).length,
          gtt: enriched.filter(sk => (sk.jenisSk || "").toLowerCase().includes('tidak tetap')).length,
          kamad: enriched.filter(sk => (sk.jenisSk || "").toLowerCase().includes('kepala')).length,
          tendik: enriched.filter(sk => (sk.jenisSk || "").toLowerCase().includes('tenaga')).length,
        }
        
        return {
          data: enriched,
          summary,
          byType,
          filters: args,
        }
    } catch (criticalError: unknown) {
        console.error("CRITICAL REPORT ERROR:", criticalError);
        // Return fail-safe empty structure to prevent whitescreen
        return {
            data: [],
            summary: { total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 },
            byType: { gty: 0, gtt: 0, kamad: 0, tendik: 0 },
            filters: args,
            error: criticalError instanceof Error ? criticalError.message : String(criticalError)
        };
    }
  }
})

// Get SK history for a specific teacher
export const getTeacherSkHistory = query({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, args) => {
    const sks = await ctx.db
      .query("skDocuments")
      .filter(q => q.eq(q.field("teacherId"), args.teacherId))
      .collect()
    
    // Enrich with school data
    const enriched = await Promise.all(
      sks.map(async (sk) => {
        try {
            // unitKerja is the school name string
            const schoolName = sk.unitKerja || 'N/A';
            
            return {
              ...sk,
              schoolName,
            }
        } catch (error) {
             console.error(`Error processing SK history ${sk._id}:`, error);
             return {
                 ...sk,
                 schoolName: 'Error'
             }
        }
      })
    )
    
    // Sort by creation date (newest first)
    return enriched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }
})

// Get summary statistics for a specific school
export const getSchoolSummary = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const sks = await ctx.db
      .query("skDocuments")
      .filter(q => q.eq(q.field("unitKerja"), args.schoolId))
      .collect()
    
    return {
      total: sks.length,
      byStatus: {
        draft: sks.filter(sk => sk.status === 'draft').length,
        pending: sks.filter(sk => sk.status === 'pending').length,
        approved: sks.filter(sk => sk.status === 'approved').length,
        rejected: sks.filter(sk => sk.status === 'rejected').length,
      },
      byType: {
        pengangkatan: sks.filter(sk => sk.jenisSk === 'pengangkatan').length,
        mutasi: sks.filter(sk => sk.jenisSk === 'mutasi').length,
        promosi: sks.filter(sk => sk.jenisSk === 'promosi').length,
        pemberhentian: sks.filter(sk => sk.jenisSk === 'pemberhentian').length,
      },
      recent: sks
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 5)
    }
  }
})

// Get Monthly Report Data
export const getMonthlyReport = query({
  args: {
    month: v.string(), // Format: "MM-YYYY" (e.g. "02-2026")
    unitKerja: v.optional(v.string()), // Optional filter
  },
  handler: async (ctx, args) => {
    const teachers = await ctx.db.query("teachers").collect();
    const sks = await ctx.db.query("skDocuments").collect();
    
    // Filter by Unit Kerja if provided
    const filteredTeachers = args.unitKerja 
      ? teachers.filter(t => t.unitKerja === args.unitKerja)
      : teachers;

    // 1. Teacher Stats (Active)
    const activeTeachers = filteredTeachers.filter(t => t.isActive !== false);
    
    const statusCounts: Record<string, number> = {
      pns: 0,
      gty: 0,
      gtt: 0,
      tendik: 0,
      lainnya: 0
    };

    activeTeachers.forEach(t => {
      let raw = (t.status || "").toUpperCase();
      if (raw.includes("PNS") || raw.includes("ASN") || raw.includes("PPPK")) statusCounts.pns++;
      else if (raw.includes("GTY") || raw.includes("TETAP YAYASAN") || raw.includes("GURU TETAP")) statusCounts.gty++;
      else if (raw.includes("GTT") || raw.includes("TIDAK TETAP") || raw.includes("HONOR")) statusCounts.gtt++;
      else if (raw.includes("TENDIK") || raw.includes("TU") || raw.includes("TATA USAHA") || raw.includes("ADMINISTRASI")) statusCounts.tendik++;
      else statusCounts.lainnya++; 
    });

    // 2. SK Stats (Generated in this month)
    const [monthStr, yearStr] = args.month.split("-");
    const targetMonth = parseInt(monthStr) - 1; // 0-indexed
    const targetYear = parseInt(yearStr);

    const newSkCount = sks.filter(sk => {
        if (!sk._creationTime) return false;
        const d = new Date(sk._creationTime);
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    }).length;

    return {
      period: args.month,
      totalTeachers: activeTeachers.length,
      statusBreakdown: statusCounts,
      newSkIssued: newSkCount,
      generatedAt: new Date().toISOString(),
    };
  },
});

// --- TEACHER REKAP REPORT ---
export const getTeacherRekap = query({
  args: {
    unit: v.optional(v.string()), // Filter by unit (for Admin)
    status: v.optional(v.string()), // Filter by status kepegawaian
    sertifikasi: v.optional(v.string()), // Filter by certification status
  },
  handler: async (ctx, args) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user) return [];

    let teachers = await ctx.db.query("teachers").collect();

    // 1. RBAC Filter
    if (user.role === "operator") {
       if (!user.unit) return [];
       teachers = teachers.filter(t => t.unitKerja === user.unit);
    } else if (args.unit && args.unit !== "all") {
       // Admin filter
       teachers = teachers.filter(t => t.unitKerja === args.unit);
    }

    // 2. Status Filter
    if (args.status && args.status !== "all") {
      teachers = teachers.filter(t => t.status === args.status);
    }

    // 3. Sertifikasi Filter
    if (args.sertifikasi && args.sertifikasi !== "all") {
      const isCertified = args.sertifikasi === "Sudah" || args.sertifikasi === "Certified";
      teachers = teachers.filter(t => !!t.isCertified === isCertified);
    }

    // 4. Enrich & Format
    return teachers.map(t => ({
      nama: t.nama || "-",
      nip: t.nip || "-",
      unitKerja: t.unitKerja || "-",
      status: t.status || "-",
      sertifikasi: t.isCertified ? "Sudah" : "Belum",
      telepon: t.phoneNumber || "-",
      email: t.email || "-"
    }));
    } catch (error) {
        console.error("Error in getTeacherRekap:", error);
        return [];
    }
  }
});

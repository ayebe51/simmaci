import { v } from "convex/values"
import { query } from "./_generated/server"

// Main SK report generation with filters
export const generateSkReport = query({
  args: {
    startDate: v.optional(v.any()), // Permissive validation for debugging/robustness
    endDate: v.optional(v.any()),
    schoolId: v.optional(v.any()),
    status: v.optional(v.any()),
    teacherId: v.optional(v.any()),
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
        
        // School filter - FIXED LOGIC: Compare Name vs Name, not Name vs ID
        if (args.schoolId && typeof args.schoolId === 'string') {
          // Fetch school first to get the string Name
          const school = await ctx.db.get(args.schoolId).catch(() => null);
          if (school) {
              // Now compare string vs string
              filtered = filtered.filter(sk => sk.unitKerja === school.nama);
          } else {
              // Valid ID provided but school not found? Return empty.
              filtered = [];
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
                    } catch (e) {
                        // Ignore invalid ID error
                        console.error(`Invalid teacherId for SK ${sk._id}:`, sk.teacherId);
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
          pending: enriched.filter(sk => sk.status === 'pending').length,
          approved: enriched.filter(sk => sk.status === 'approved').length,
          rejected: enriched.filter(sk => sk.status === 'rejected').length,
          draft: enriched.filter(sk => sk.status === 'draft').length,
        }
        
        // Group by SK type
        const byType = {
          pengangkatan: enriched.filter(sk => sk.jenisSk === 'pengangkatan').length,
          mutasi: enriched.filter(sk => sk.jenisSk === 'mutasi').length,
          promosi: enriched.filter(sk => sk.jenisSk === 'promosi').length,
          pemberhentian: enriched.filter(sk => sk.jenisSk === 'pemberhentian').length,
        }
        
        return {
          data: enriched,
          summary,
          byType,
          filters: args,
        }
    } catch (criticalError: any) {
        console.error("CRITICAL REPORT ERROR:", criticalError);
        // Return fail-safe empty structure to prevent whitescreen
        return {
            data: [],
            summary: { total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 },
            byType: { pengangkatan: 0, mutasi: 0, promosi: 0, pemberhentian: 0 },
            filters: args,
            error: criticalError.message
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

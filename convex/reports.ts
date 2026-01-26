import { v } from "convex/values"
import { query } from "./_generated/server"

// Main SK report generation with filters
export const generateSkReport = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    schoolId: v.optional(v.id("schools")),
    status: v.optional(v.string()),
    teacherId: v.optional(v.id("teachers")),
  },
  handler: async (ctx, args) => {
    // Fetch all SK documents
    const allSks = await ctx.db.query("skDocuments").collect()
    
    // Apply filters
    let filtered = allSks
    
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
    
    // School filter - only if valid ID provided
    if (args.schoolId && typeof args.schoolId === 'string') {
      filtered = filtered.filter(sk => sk.unitKerja === args.schoolId)
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
            // If we really need school ID, we should have stored it. 
            // For now, assume unitKerja IS the school name if lookup fails or isn't attempted.
            
            const schoolName = sk.unitKerja || 'N/A';
            
            // Attempt to fetch if it looks like an ID (optional robustness, maybe skip if we know it's a name)
            // const school = sk.unitKerja ? await ctx.db.get(sk.unitKerja as any).catch(() => null) : null
            // if (school) schoolName = school.nama;

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

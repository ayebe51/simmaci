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
    // DEBUG MODE: Return static data to verify connection
    console.log("DEBUG: generateSkReport called with", args);
    return {
      data: [],
      summary: { total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 },
      byType: { pengangkatan: 0, mutasi: 0, promosi: 0, pemberhentian: 0 },
      filters: args,
    };
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

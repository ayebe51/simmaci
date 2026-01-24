import { v } from "convex/values"
import { query } from "./_generated/server"

// Main SK report generation with filters
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
    
    // School filter - Resolve ID to Name first if needed
    if (args.schoolId) {
      // Logic: unitKerja stores the Name, so we need to get the name from the ID
      const schoolDoc = await ctx.db.get(args.schoolId);
      if (schoolDoc) {
          filtered = filtered.filter(sk => sk.unitKerja === schoolDoc.nama)
      } else {
          // If school ID valid but not found, return empty or ignore? 
          // Safest is to filter everything out as no match
          filtered = []
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
            // Defensive: Check if teacherId is actually valid format if needed, but db.get usually safe
            const teacher = sk.teacherId ? await ctx.db.get(sk.teacherId) : null
            
            return {
            ...sk,
            schoolName: sk.unitKerja || 'N/A', 
            teacherName: teacher?.nama || 'N/A',
            teacherNIP: teacher?.nip || '-',
            }
        } catch (err) {
            console.error(`Failed to enrich SK ${sk.nomorSk}:`, err)
            // Return query-safe fallback
            return {
                ...sk,
                schoolName: sk.unitKerja || 'Error',
                teacherName: 'Error Loading',
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
      .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId))
      .collect()
    
    // Enrich with school data
    const enriched = sks.map((sk) => {
        // ERROR FIX: unitKerja is String
        return {
          ...sk,
          schoolName: sk.unitKerja || 'N/A',
        }
    })
    
    // Sort by creation date (newest first)
    return enriched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }
})

// Get summary statistics for a specific school
export const getSchoolSummary = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    // Execute: Get School Name from ID
    const school = await ctx.db.get(args.schoolId);
    if (!school) {
        return {
            total: 0,
            byStatus: { draft:0, pending:0, approved:0, rejected:0 },
            byType: { pengangkatan:0, mutasi:0, promosi:0, pemberhentian:0 },
            recent: []
        }
    }

    // Filter SKs by Name match
    const sks = await ctx.db
      .query("skDocuments")
      .collect() // have to collect all then filter because no index on unitKerja string
      // Note: If 'skDocuments' gets huge, we should add an index on 'unitKerja' string.
    
    const matchedSks = sks.filter(sk => sk.unitKerja === school.nama);
    
    return {
      total: matchedSks.length,
      byStatus: {
        draft: matchedSks.filter(sk => sk.status === 'draft').length,
        pending: matchedSks.filter(sk => sk.status === 'pending').length,
        approved: matchedSks.filter(sk => sk.status === 'approved').length,
        rejected: matchedSks.filter(sk => sk.status === 'rejected').length,
      },
      byType: {
        pengangkatan: matchedSks.filter(sk => sk.jenisSk === 'pengangkatan').length,
        mutasi: matchedSks.filter(sk => sk.jenisSk === 'mutasi').length,
        promosi: matchedSks.filter(sk => sk.jenisSk === 'promosi').length,
        pemberhentian: matchedSks.filter(sk => sk.jenisSk === 'pemberhentian').length,
      },
      recent: matchedSks
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 5)
    }
  }
})

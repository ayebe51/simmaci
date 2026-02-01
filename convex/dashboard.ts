import { query } from "./_generated/server";
import { v } from "convex/values";

// Get real-time dashboard statistics
export const getStats = query({
  handler: async (ctx) => {
    const teachers = await ctx.db
      .query("teachers")
      .collect();
    
    const students = await ctx.db
      .query("students")
      .collect();
    
    const schools = await ctx.db
      .query("schools")
      .collect();
    
    const skDocuments = await ctx.db
      .query("skDocuments")
      .collect();
    
    // Calculate active counts
    const activeTeachers = teachers.filter(t => t.isActive !== false).length;
    const activeStudents = students.length;
    const activeSchools = schools.length;
    
    // SK by status
    const activeSk = skDocuments.filter(sk => sk.status === 'active').length;
    const draftSk = skDocuments.filter(sk => sk.status === 'draft').length;
    
    return {
      totalTeachers: activeTeachers,
      totalStudents: activeStudents,
      totalSchools: activeSchools,
      totalSk: skDocuments.length,
      activeSk,
      draftSk,
      lastUpdated: Date.now(),
    };
  },
});

// Get recent activities
export const getRecentActivities = query({
  args: {},
  handler: async (ctx) => {
    // Get recent SK documents
    const recentSk = await ctx.db
      .query("skDocuments")
      .order("desc")
      .take(10);
    
    return recentSk;
  },
});

// Get charts data for dashboard
export const getChartsData = query({
  handler: async (ctx) => {
    const teachers = await ctx.db
      .query("teachers")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    // Group by unit kerja (case-insensitive)
    const unitMap = new Map<string, number>();
    teachers.forEach(t => {
      if (t.unitKerja) {
        // Normalize to lowercase for grouping
        const normalized = t.unitKerja.toLowerCase().trim();
        unitMap.set(normalized, (unitMap.get(normalized) || 0) + 1);
      }
    });
    
    // Convert to array and get top 5
    const units = Array.from(unitMap.entries())
      .map(([name, jumlah]) => ({ 
        // Capitalize first letter of each word for display
        name: name.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '), 
        jumlah 
      }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 5);
    
    // Group by status
    const statusMap = new Map<string, number>();
    teachers.forEach(t => {
      const status = t.status || "Tidak Diketahui";
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });
    
    const status = Array.from(statusMap.entries())
      .map(([name, value]) => ({ name, value }));
    
    return { units, status };
  },
});

// ========================================
// 📊 SK MONITORING DASHBOARD QUERIES
// ========================================

/**
 * Get comprehensive SK statistics grouped by status
 */
export const getSkStatistics = query({
  args: {
    unitKerja: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let sks = await ctx.db.query("skDocuments").collect();
    
    // Filter by school if provided (for operators)
    if (args.unitKerja) {
      sks = sks.filter(sk => sk.unitKerja === args.unitKerja);
    }

    // Count by status
    const stats = {
      total: sks.length,
      draft: sks.filter(sk => sk.status === "draft").length,
      pending: sks.filter(sk => sk.status === "pending").length,
      approved: sks.filter(sk => sk.status === "approved").length,
      rejected: sks.filter(sk => sk.status === "rejected").length,
      active: sks.filter(sk => sk.status === "active").length,
    };

    return stats;
  },
});

/**
 * Get SK trend data for the last N months
 */
export const getSkTrendByMonth = query({
  args: {
    months: v.number(),
    unitKerja: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let sks = await ctx.db.query("skDocuments").collect();
    
    // Filter by school if provided
    if (args.unitKerja) {
      sks = sks.filter(sk => sk.unitKerja === args.unitKerja);
    }

    // Group by month
    const now = Date.now();
    const monthsAgo = args.months;
    const trendData: { month: string; count: number }[] = [];

    for (let i = monthsAgo - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
      
      const count = sks.filter(sk => {
        const skDate = new Date(sk.createdAt);
        const skMonthKey = `${skDate.getFullYear()}-${String(skDate.getMonth() + 1).padStart(2, '0')}`;
        return skMonthKey === monthKey;
      }).length;

      trendData.push({
        month: monthName,
        count,
      });
    }

    return trendData;
  },
});

/**
 * Get SKs expiring within the next N days
 * NOTE: Disabled - masaBerlaku field doesn't exist in current schema
 */
/*
export const getExpiringSk = query({
  args: {
    daysAhead: v.number(),
    unitKerja: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let sks = await ctx.db.query("skDocuments").collect();
    
    // Filter by school if provided
    if (args.unitKerja) {
      sks = sks.filter(sk => sk.unitKerja === args.unitKerja);
    }

    const now = Date.now();
    const futureDate = now + (args.daysAhead * 24 * 60 * 60 * 1000);

    // Filter SKs that expire within the timeframe (using masaBerlaku if exists)
    const expiring = sks.filter(sk => {
      if (!sk.masaBerlaku) return false;
      
      const expiryDate = new Date(sk.masaBerlaku).getTime();
      return expiryDate > now && expiryDate <= futureDate && sk.status === 'active';
    });

    return expiring.map(sk => ({
      id: sk._id,
      nama: sk.nama,
      jenisSk: sk.jenisSk,
      masaBerlaku: sk.masaBerlaku,
      unitKerja: sk.unitKerja,
      daysUntilExpiry: Math.ceil((new Date(sk.masaBerlaku!).getTime() - now) / (24 * 60 * 60 * 1000)),
    })).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  },
});
*/

/**
 * Get SK count breakdown by school (Admin only)
 */
export const getSchoolBreakdown = query({
  args: {},
  handler: async (ctx) => {
    const sks = await ctx.db.query("skDocuments").collect();
    
    // Group by school (unitKerja)
    const schoolMap = new Map<string, number>();
    
    sks.forEach(sk => {
      const school = sk.unitKerja || "Unknown";
      schoolMap.set(school, (schoolMap.get(school) || 0) + 1);
    });

    // Convert to array and sort by count
    const breakdown = Array.from(schoolMap.entries())
      .map(([school, count]) => ({ school, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 schools

    return breakdown;
  },
});

// NEW: Stats specifically for School Operators
export const getSchoolStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) return null;
    
    const email = identity.email;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user || user.role !== "operator" || !user.unit) {
      return null;
    }

    const schoolName = user.unit;

    // Parallelize queries for performance
    const [teachers, students, skDrafts, skApproved, totalSk] = await Promise.all([
      // Teacher Count (Active)
      ctx.db.query("teachers")
        .collect()
        .then(res => res.filter(t => t.unitKerja === schoolName && t.isActive).length),
      
      // Student Count
      ctx.db.query("students")
        .collect()
        .then(res => res.filter(s => s.namaSekolah === schoolName).length),
        
      // SK Drafts
      ctx.db.query("skDocuments")
        .collect()
        .then(res => res.filter(sk => sk.unitKerja === schoolName && sk.status === "draft").length),

      // SK Verified
      ctx.db.query("skDocuments")
        .collect()
        .then(res => res.filter(sk => sk.unitKerja === schoolName && (sk.status === "approved" || sk.status === "active")).length),

      // Total SK
       ctx.db.query("skDocuments")
        .collect()
        .then(res => res.filter(sk => sk.unitKerja === schoolName).length),
    ]);

    return {
      schoolName,
      teachers,
      students,
      skDrafts,
      skApproved,
      totalSk
    };
  }
});

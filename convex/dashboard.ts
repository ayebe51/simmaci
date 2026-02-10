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
  args: { email: v.string() }, // Accept email explicitly because we use custom auth
  handler: async (ctx, args) => {
    // const identity = await ctx.auth.getUserIdentity(); // Disabled: Custom Auth
    const email = args.email;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user || user.role !== "operator" || !user.unit) {
      return {
        error: "User validation failed",
        debug: {
            found: !!user,
            role: user?.role,
            unit: user?.unit,
            email: email,
            expectedRole: "operator"
        }
      };
    }

    const schoolName = user.unit;

    // Fetch All Teachers for this School (for aggregation)
    const teachersList = await ctx.db.query("teachers").collect().then(res => res.filter(t => t.unitKerja === schoolName && t.isActive));
    
    // 1. Calculate Teacher Trend (Last 6 Months)
    const now = new Date();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return {
            monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleString('id-ID', { month: 'short' }),
            count: 0
        };
    }).reverse();

    for (const t of teachersList) {
        const d = new Date(t.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = last6Months.find(b => b.monthKey === key);
        if (bucket) {
            bucket.count++;
        }
    }
    const teacherTrend = last6Months.map(({ label, count }) => ({ month: label, count }));

    // 2. Status Breakdown
    const statusCounts: Record<string, number> = { "PNS": 0, "GTY": 0, "GTT": 0, "Tendik": 0 };
    const certCounts: Record<string, number> = { "Sudah Sertifikasi": 0, "Belum Sertifikasi": 0 };

    for (const t of teachersList) {
       // A. Status
       // A. Status Logic (Updated per user request)
       // Priority 1: PNS
       let rawStatus = (t.status || "").trim().toUpperCase();
       let statusLabel = ""; 
       
       if (rawStatus.includes("PNS") || rawStatus.includes("ASN") || rawStatus.includes("PPPK")) {
           statusLabel = "PNS";
       } else {
           // Priority 2: Education (Tendik)
           const edu = (t.pendidikanTerakhir || "").trim().toUpperCase();
           const tendikEdu = ["SD", "SMP", "SMA", "SMK", "D1", "D2", "D3"];
           
           if (tendikEdu.some(e => edu === e || edu.startsWith(e + " "))) {
              statusLabel = "Tendik";
           } else if (rawStatus.includes("TENDIK") || rawStatus.includes("TU") || rawStatus.includes("OPERATOR")) {
              statusLabel = "Tendik";
           } else {
               // Priority 3: TMT
               if (t.tmt) {
                   const tmtDate = new Date(t.tmt);
                   if (!isNaN(tmtDate.getTime())) {
                      const now = new Date();
                      const diffTime = Math.abs(now.getTime() - tmtDate.getTime());
                      const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
                      statusLabel = diffYears >= 2 ? "GTY" : "GTT";
                   }
               }
               
               // Fallback
               if (!statusLabel) {
                   if (rawStatus.includes("GTY") || rawStatus.includes("TETAP")) statusLabel = "GTY";
                   else statusLabel = "GTT";
               }
           }
       }
       if (statusCounts[statusLabel] !== undefined) statusCounts[statusLabel]++;

       // B. Certification (Exclude Tendik)
       if (statusLabel !== "Tendik") {
          if (t.isCertified) certCounts["Sudah Sertifikasi"]++;
          else certCounts["Belum Sertifikasi"]++;
       }
    }

    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    const certData = Object.entries(certCounts).map(([name, value]) => ({ name, value }));

    // Parallelize other queries
    const [students, skDrafts, skApproved, totalSk, skTrend] = await Promise.all([
      // Student Count
      ctx.db.query("students").collect().then(res => res.filter(s => s.namaSekolah === schoolName).length),
      // SK Drafts
      ctx.db.query("skDocuments").collect().then(res => res.filter(sk => sk.unitKerja === schoolName && sk.status === "draft").length),
      // SK Verified
      ctx.db.query("skDocuments").collect().then(res => res.filter(sk => sk.unitKerja === schoolName && (sk.status === "approved" || sk.status === "active")).length),
      // Total SK
       ctx.db.query("skDocuments").collect().then(res => res.filter(sk => sk.unitKerja === schoolName).length),
      // SK Trend (Re-use existing function logic or just call it? calling query from query is not allowed directly easily inside handler without `runQuery` which is internal. 
      // Simplified Trend for SK: Group by month for this school
       ctx.db.query("skDocuments").collect().then(res => {
          const schoolSks = res.filter(sk => sk.unitKerja === schoolName);
           // ... logic similar to teacher trend ...
           const skTrendData = last6Months.map(b => ({...b, count: 0})); // Reuse buckets
           // We need deep copy or re-calc
           return []; // Placeholder if too complex to inline. 
           // ACTUALLY: The frontend calls `getSkTrendByMonth` separately! I don't need to return it here.
           // BUT I need `teacherTrend` here.
       })
    ]);

    return {
      schoolName,
      teachers: teachersList.length,
      students,
      skDrafts, // "Pending" for UI
      skApproved, // "Total SK" for UI? No, Approved
      totalSk, // All applied
      skRejected: await ctx.db.query("skDocuments").collect().then(res => res.filter(sk => sk.unitKerja === schoolName && sk.status === "rejected").length),
      teacherTrend,
      status: statusData,
      certification: certData,
      debug: { role: user.role, unit: user.unit }
    };
  }
});

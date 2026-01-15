import { query } from "./_generated/server";

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

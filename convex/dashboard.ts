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

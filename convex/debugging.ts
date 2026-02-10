
import { query } from "./_generated/server";
import { v } from "convex/values";

export const debugTeacherStats = query({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    
    // 1. Total Count
    const total = teachers.length;
    
    // 2. Initial School Check (Unit Kerja)
    const schools = new Map<string, number>();
    teachers.forEach(t => {
        const u = t.unitKerja || "UNKNOWN";
        schools.set(u, (schools.get(u) || 0) + 1);
    });
    
    // 3. Status Breakdown (Raw)
    const statuses = new Map<string, number>();
    teachers.forEach(t => {
        const s = t.status || "UNKNOWN";
        statuses.set(s, (statuses.get(s) || 0) + 1);
    });

    // 4. IsActive Breakdown
    const activeCount = teachers.filter(t => t.isActive).length;

    return {
        total,
        activeCount,
        schoolsCount: schools.size,
        schools: Object.fromEntries(schools), // Top 50 maybe?
        statuses: Object.fromEntries(statuses)
    };
  }
});

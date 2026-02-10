import { query, mutation } from "./_generated/server";
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

// Create Yayasan Admin
export const createYayasanAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "maarifnuclp@gmail.com"))
      .first();

    if (existing) return "User already exists";

    await ctx.db.insert("users", {
        email: "maarifnuclp@gmail.com",
        name: "Admin Yayasan",
        passwordHash: btoa("maarif2024"), // Base64
        role: "admin_yayasan",
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    return "User created successfully";
  },
});



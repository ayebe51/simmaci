
import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Main check replaced by individual checks to avoid timeouts/crashes
export const checkTeachers = query({
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    return {
      total: teachers.length,
      stringSchoolId: teachers.filter(t => typeof t.schoolId === 'string').length,
      objectSchoolId: teachers.filter(t => typeof t.schoolId === 'object' && t.schoolId !== null).length,
      missingSchoolId: teachers.filter(t => !t.schoolId).length,
    };
  }
});

export const checkUsers = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return {
      total: users.length,
      stringSchoolId: users.filter(u => typeof u.schoolId === 'string').length,
      missingSchoolId: users.filter(u => !u.schoolId).length,
    };
  }
});

export const checkSk = query({
    handler: async (ctx) => {
        const sks = await ctx.db.query("skDocuments").collect();
        return {
          total: sks.length,
          stringSchoolId: sks.filter(s => typeof s.schoolId === 'string').length,
          missingSchoolId: sks.filter(s => !s.schoolId).length,
        };
    }
});


import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// This script verifies that all data is ready for the strict schema:
// schoolId: v.optional(v.id("schools"))

export const verifyDataReady = query({
  args: {},
  handler: async (ctx) => {
    const report = {
      teachers: { total: 0, valid: 0, invalid: 0, distinct_types: {} as Record<string, number> },
      users: { total: 0, valid: 0, invalid: 0, distinct_types: {} as Record<string, number> },
      skDocuments: { total: 0, valid: 0, invalid: 0, distinct_types: {} as Record<string, number> },
    };

    // Helper check
    const check = (val: any) => {
        const type = typeof val;
        // Valid if: undefined, null, or (string AND 32 chars specific alphanumeric)
        // Note: In runtime, IDs are strings.
        if (val === undefined || val === null) return true;
        if (type === 'string') {
             // Strict regex for Convex ID
             return /^[a-zA-Z0-9]{32}$/.test(val);
        }
        return false; // numbers, booleans, objects etc are invalid for v.id()
    };

    // Teachers
    const teachers = await ctx.db.query("teachers").collect();
    report.teachers.total = teachers.length;
    for (const t of teachers) {
        const type = typeof t.schoolId;
        report.teachers.distinct_types[type] = (report.teachers.distinct_types[type] || 0) + 1;
        if (check(t.schoolId)) report.teachers.valid++;
        else report.teachers.invalid++;
    }

    // Users
    const users = await ctx.db.query("users").collect();
    report.users.total = users.length;
    for (const u of users) {
        const type = typeof u.schoolId;
        report.users.distinct_types[type] = (report.users.distinct_types[type] || 0) + 1;
        if (check(u.schoolId)) report.users.valid++;
        else report.users.invalid++;
    }

    // SkDocuments
    const sk = await ctx.db.query("skDocuments").collect();
    report.skDocuments.total = sk.length;
    for (const s of sk) {
        const type = typeof s.schoolId;
        report.skDocuments.distinct_types[type] = (report.skDocuments.distinct_types[type] || 0) + 1;
        if (check(s.schoolId)) report.skDocuments.valid++;
        else report.skDocuments.invalid++;
    }

    return report;
  }
});

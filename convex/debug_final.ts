import { query } from "./_generated/server";

export const scan = query({
  args: {},
  handler: async (ctx) => {
    // 1. Raw Dump of first 5 teachers
    const all = await ctx.db.query("teachers").take(5);
    
    // 2. Count Total Active
    const activeInfo = await ctx.db
        .query("teachers")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

    // 3. Count SkGenerated False/Undefined among Active
    const readyForSk = activeInfo.filter(t => t.isSkGenerated !== true);

    return {
        total_sample: all,
        count_active: activeInfo.length,
        count_ready_for_sk: readyForSk.length,
        sample_ready: readyForSk.slice(0, 3)
    };
  }
});

import { v } from "convex/values";

export const checkTeachersPaginated = query({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    // @ts-ignore
    const data = await ctx.db
        .query("teachers")
        .paginate({ cursor: args.cursor || null, numItems: 100 });
    
    return {
        // @ts-ignore
        items: data.page.map(t => ({
            id: t._id,
            schoolIdType: typeof t.schoolId,
            schoolIdVal: t.schoolId
        })),
        continueCursor: data.continueCursor,
        pageStatus: data.isDone ? "Done" : "HasMore"
    };
  }
});

export const checkUsersPaginated = query({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    // @ts-ignore
    const data = await ctx.db
        .query("users")
        .paginate({ cursor: args.cursor || null, numItems: 100 });
    
    return {
        // @ts-ignore
        items: data.page.map(u => ({
            id: u._id,
            email: u.email,
            schoolIdType: typeof u.schoolId,
            schoolIdVal: u.schoolId
        })),
        continueCursor: data.continueCursor,
        pageStatus: data.isDone ? "Done" : "HasMore"
    };
  }
});

export const checkSkPaginated = query({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    // @ts-ignore
    const data = await ctx.db
        .query("skDocuments")
        .paginate({ cursor: args.cursor || null, numItems: 100 });
    
    return {
        // @ts-ignore
        items: data.page.map(s => ({
            id: s._id,
            nomorSk: s.nomorSk,
            schoolIdType: typeof s.schoolId,
            schoolIdVal: s.schoolId
        })),
        continueCursor: data.continueCursor,
        pageStatus: data.isDone ? "Done" : "HasMore"
    };
  }
});

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
    // @ts-ignore
    report.teachers.total = teachers.length;
    for (const t of teachers) {
        const type = typeof t.schoolId;
        // @ts-ignore
        report.teachers.distinct_types[type] = (report.teachers.distinct_types[type] || 0) + 1;
        // @ts-ignore
        if (check(t.schoolId)) report.teachers.valid++;
        else report.teachers.invalid++;
    }

    // Users
    const users = await ctx.db.query("users").collect();
    // @ts-ignore
    report.users.total = users.length;
    for (const u of users) {
        const type = typeof u.schoolId;
        // @ts-ignore
        report.users.distinct_types[type] = (report.users.distinct_types[type] || 0) + 1;
        // @ts-ignore
        if (check(u.schoolId)) report.users.valid++;
        else report.users.invalid++;
    }

    // SkDocuments
    const sk = await ctx.db.query("skDocuments").collect();
    // @ts-ignore
    report.skDocuments.total = sk.length;
    for (const s of sk) {
        const type = typeof s.schoolId;
        // @ts-ignore
        report.skDocuments.distinct_types[type] = (report.skDocuments.distinct_types[type] || 0) + 1;
        // @ts-ignore
        if (check(s.schoolId)) report.skDocuments.valid++;
        else report.skDocuments.invalid++;
    }

    return report;
  }
});

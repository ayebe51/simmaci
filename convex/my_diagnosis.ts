
// @ts-nocheck
import { query } from "./_generated/server";
import { v } from "convex/values";

export const checkTeachersPaginated = query({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const data = await ctx.db
        .query("teachers")
        .paginate({ cursor: args.cursor || null, numItems: 100 });
    
    return {
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
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const data = await ctx.db
        .query("users")
        .paginate({ cursor: args.cursor || null, numItems: 100 });
    
    return {
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
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const data = await ctx.db
        .query("skDocuments")
        .paginate({ cursor: args.cursor || null, numItems: 100 });
    
    return {
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


import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

// Clean implementation of SK List
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    // Optional filters
    jenisSk: v.optional(v.string()),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    userRole: v.optional(v.string()),
    userUnit: v.optional(v.string()),
    schoolId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("SK_NEW list called", args);
    
    // 1. Simple query first (no auth mainly)
    const q = ctx.db.query("skDocuments");
    
    // 2. Default pagination
    return await q.order("desc").paginate(args.paginationOpts);
  },
});

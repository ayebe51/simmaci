// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

// Log an activity (To be called by other mutations)
export const log = mutation({
  args: {
    user: v.string(),
    role: v.string(),
    action: v.string(),
    details: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activity_logs", {
        ...args,
        timestamp: Date.now(),
    });
  },
});

// Get paginated logs for Dashboard
export const listPaginated = query({
  args: { paginationOpts: v.any() },
  handler: async (ctx, args) => {
    try {
        return await ctx.db
          .query("activity_logs")
          .order("desc")
          .paginate(args.paginationOpts);
    } catch (e) {
        console.error("Pagination error:", e);
        return { page: [], isDone: true, continueCursor: "" };
    }
  },
});

// Simple debug query to test table access
export const debugTest = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("activity_logs").order("desc").take(5);
  },
});

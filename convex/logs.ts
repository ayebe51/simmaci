import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

// Get recent logs for Dashboard
export const getRecentLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    return await ctx.db.query("activity_logs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

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
          .order("desc") // Uses _creationTime
          .paginate(args.paginationOpts);
    } catch (e) {
        console.error("Pagination error:", e);
        return { page: [], isDone: true, continueCursor: "" };
    }
  },
});

// Simple non-paginated version (Fallback)
export const getTop = query({
  args: {},
  handler: async (ctx) => {
    try {
      return await ctx.db.query("activity_logs").order("desc").take(15).collect();
    } catch (error) {
      console.error("Error in getTop:", error);
      return [];
    }
  },
});

import { query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

/**
 * Super robust query for dashboard logs
 * Bypasses custom indexes and uses default sorting
 */
export const getRecent = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    try {
      return await ctx.db
        .query("activity_logs")
        .order("desc") // Uses _creationTime
        .paginate(args.paginationOpts);
    } catch (error) {
      console.error("Critical error in audit_logs:getRecent:", error);
      // Return empty page instead of throwing to prevent frontend crash
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }
  },
});

/**
 * Even simpler non-paginated version
 */
export const getTop = query({
  args: {},
  handler: async (ctx) => {
    try {
      return await ctx.db.query("activity_logs").order("desc").take(15);
    } catch (error) {
      return [];
    }
  },
});

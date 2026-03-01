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

/**
 * PERMANENT SOLUTION: Robust Paginated Activity Logs
 * - Uses default _creationTime for sorting (No index required)
 * - Returns serializable data only
 * - Optimized for Dashboard Performance
 */
export const listPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    try {
      const results = await ctx.db
        .query("activity_logs")
        .order("desc") // Implicitly uses _creationTime
        .paginate(args.paginationOpts);

      // Map to ensure clean data for frontend
      return {
        ...results,
        page: results.page.map(l => ({
          _id: l._id,
          _creationTime: l._creationTime,
          user: String(l.user || "Unknown"),
          role: String(l.role || "User"),
          action: String(l.action || "Aktivitas"),
          details: String(l.details || "-"),
          timestamp: Number(l.timestamp || l._creationTime),
        }))
      };
    } catch (error) {
      console.error("Critical error in logs:listPaginated:", error);
      return { page: [], isDone: true, continueCursor: "" };
    }
  },
});

// Simple legacy fetch for small widgets
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    try {
      const logs = await ctx.db
        .query("activity_logs")
        .order("desc")
        .take(args.limit || 10);
      
      return logs.map(l => ({
        _id: l._id,
        _creationTime: l._creationTime,
        user: String(l.user || "Unknown"),
        role: String(l.role || "User"),
        action: String(l.action || "Aktivitas"),
        details: String(l.details || "-"),
        timestamp: Number(l.timestamp || l._creationTime),
      }));
    } catch (e) {
      return [];
    }
  },
});

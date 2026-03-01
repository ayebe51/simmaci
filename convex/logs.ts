// @ts-nocheck
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
    // Mutation still enabled for testing write access
    await ctx.db.insert("activity_logs", {
        ...args,
        timestamp: Date.now(),
    });
  },
});

/**
 * DIAGNOSTIC: Hardcoded paginated response
 * - If this works, the issue is data-related or paginate() related
 * - If this fails, the issue is structural/path related
 */
export const listPaginated = query({
  args: { paginationOpts: v.any() },
  handler: async (ctx, args) => {
    return {
      page: [
        { 
          _id: "diagnostic_1", 
          _creationTime: Date.now(),
          action: "Diagnostic Mode", 
          details: "Hardcoded data to bypass Server Error", 
          timestamp: Date.now(),
          user: "System",
          role: "admin"
        }
      ],
      isDone: true,
      continueCursor: "none",
    };
  },
});

// Simple legacy fetch
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return [
        { 
          _id: "diagnostic_2", 
          _creationTime: Date.now(),
          action: "Diagnostic Simple", 
          details: "Hardcoded", 
          timestamp: Date.now() 
        }
    ];
  },
});

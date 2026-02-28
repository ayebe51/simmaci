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
    await ctx.db.insert("activity_logs", {
        ...args,
        timestamp: Date.now(),
    });
  },
});

// Simple debug query - HARDCODED
export const debugTest = query({
  args: {},
  handler: async (ctx) => {
    return [
      { 
        action: "Hardcoded Test", 
        details: "If you see this, DB query was the problem", 
        timestamp: Date.now() 
      }
    ];
  },
});

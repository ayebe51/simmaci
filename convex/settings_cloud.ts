import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List Settings (Safe & Simple)
export const list = query({
  handler: async (ctx) => {
    try {
        const settings = await ctx.db.query("settings").collect();
        return settings.map((doc) => ({
            _id: doc._id,
            _creationTime: doc._creationTime,
            key: doc.key || "unknown", 
            mimeType: doc.mimeType || "application/octet-stream",
            updatedAt: doc.updatedAt || doc._creationTime
        }));
    } catch(e) {
        console.error("List Error", e);
        return [];
    }
  },
});

// Save Template (Base64)
export const save = mutation({
  args: {
    key: v.string(),
    base64: v.string(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const now = Date.now();
    
    // Size Check (1MB)
    if (args.base64.length > 1000000) {
        throw new Error("File terlalu besar (Max 1MB).");
    }

    if (existing) {
      await ctx.db.patch(existing._id, { 
          value: args.base64,
          mimeType: args.mimeType,
          updatedAt: now 
      });
    } else {
      await ctx.db.insert("settings", { 
          key: args.key, 
          value: args.base64, 
          mimeType: args.mimeType,
          updatedAt: now,
      });
    }
  },
});

// Get Content
export const getContent = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (!setting || !setting.value) return null;
    return setting.value;
  },
});

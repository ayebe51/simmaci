import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List Settings (Safe & Simple) - V2
export const list = query({
  handler: async (ctx) => {
    try {
        const settings = await ctx.db.query("settings_v2").collect();
        return settings.map((doc) => ({
            _id: doc._id,
            _creationTime: doc._creationTime,
            key: doc.key,
            mimeType: doc.mimeType || "application/octet-stream",
            updatedAt: doc.updatedAt || doc._creationTime
        }));
    } catch(e) {
        console.error("List V2 Error", e);
        return [];
    }
  },
});

// Save Template (Base64) - V2
export const save = mutation({
  args: {
    key: v.string(),
    base64: v.string(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings_v2")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const now = Date.now();
    
    // Size Check (1MB)
    if (args.base64.length > 2000000) { // Increased to 2MB
        throw new Error("File terlalu besar (Max 2MB).");
    }

    if (existing) {
      await ctx.db.patch(existing._id, { 
          value: args.base64,
          mimeType: args.mimeType,
          updatedAt: now 
      });
    } else {
      await ctx.db.insert("settings_v2", { 
          key: args.key, 
          value: args.base64, 
          mimeType: args.mimeType,
          updatedAt: now,
      });
    }
  },
});

// Get Content - V2
export const getContent = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings_v2")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (!setting || !setting.value) return null;
    return setting.value;
  },
});

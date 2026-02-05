import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Generate Upload URL for Files
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// Save Template Metadata
export const saveTemplate = mutation({
  args: {
    key: v.string(), // e.g. "sk_template_gty"
    storageId: v.id("_storage"),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const now = Date.now();
    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, { 
          storageId: args.storageId, 
          mimeType: args.mimeType,
          updatedAt: now 
      });
    } else {
      // Insert new
      await ctx.db.insert("settings", { 
          key: args.key, 
          storageId: args.storageId, 
          mimeType: args.mimeType,
          updatedAt: now,
          value: "TEMPLATE_FILE" // Placeholder value
      });
    }
  },
});

// List settings (Safe)
export const listSettings = query({
  handler: async (ctx) => {
    try {
        return await ctx.db.query("settings").collect();
    } catch (e) {
        return [];
    }
  },
});

// Get File URL
export const getFileUrl = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (!setting || !setting.storageId) return null;
    return await ctx.storage.getUrl(setting.storageId);
  },
});

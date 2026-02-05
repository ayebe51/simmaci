import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all settings
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("settings").collect();
  },
});

// Get setting by key
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

// Get File URL for a setting (e.g. Template)
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

// Save Setting (Text)
export const save = mutation({
  args: {
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value, updatedAt: now });
    } else {
      await ctx.db.insert("settings", { key: args.key, value: args.value, updatedAt: now });
    }
  },
});

// Save Template (File Storage)
export const saveTemplate = mutation({
  args: {
    key: v.string(),
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
      // Clean up old storage if needed (optional)
      await ctx.db.patch(existing._id, { 
          storageId: args.storageId, 
          mimeType: args.mimeType,
          updatedAt: now 
      });
    } else {
      await ctx.db.insert("settings", { 
          key: args.key, 
          storageId: args.storageId, 
          mimeType: args.mimeType,
          updatedAt: now 
      });
    }
  },
});

// Generate Upload URL
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

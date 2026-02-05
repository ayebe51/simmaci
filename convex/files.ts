import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Generate Upload URL for Files
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Save Template Metadata & Content (Base64) - Bypass Storage
export const saveTemplate = mutation({
  args: {
    key: v.string(), // e.g. "sk_template_gty"
    base64: v.string(), // Content
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const now = Date.now();
    
    // Validate Size (approx 1MB limit check)
    if (args.base64.length > 1000000) {
        throw new Error("File terlalu besar (Max 1MB untuk SK Template). Gunakan kompresi.");
    }

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, { 
          // We store Content in 'value' field (string)
          value: args.base64,
          mimeType: args.mimeType,
          updatedAt: now 
      });
    } else {
      // Insert new
      await ctx.db.insert("settings", { 
          key: args.key, 
          value: args.base64, 
          mimeType: args.mimeType,
          updatedAt: now,
      });
    }
  },
});

// Get File Content (Base64)
export const getFileContent = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (!setting || !setting.value) return null;
    return setting.value; // Returns Base64 string
  },
});

// List Settings (Metadata Only - Optimized)
export const listSettings = query({
  handler: async (ctx) => {
    // Force deployment update TS: 12347
    const settings = await ctx.db.query("settings").collect();
    // Use Safe Access and Default Values
    return settings.map((doc) => ({
        _id: doc._id,
        _creationTime: doc._creationTime,
        key: doc.key || "unknown", // Fallback
        mimeType: doc.mimeType || "application/octet-stream",
        updatedAt: doc.updatedAt || doc._creationTime
    }));
  },
});

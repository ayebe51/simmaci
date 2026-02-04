import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate Upload URL
// Generate Upload URL
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // TEST: Check if function runs at all
    // return await ctx.storage.generateUploadUrl();
    return "https://mock-upload-url.com";
  },
});

// Save Document Metadata
export const saveDocument = mutation({
  args: {
    teacherId: v.id("teachers"),
    type: v.string(),
    blobId: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("teacher_archives", {
      teacherId: args.teacherId,
      type: args.type,
      blobId: args.blobId,
      notes: args.notes,
      uploadedAt: Date.now(),
    });
  },
});

// Get Documents by Teacher
export const getDocuments = query({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("teacher_archives")
      .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId))
      .collect();

    // Map to include image URL
    return await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.blobId),
      }))
    );
  },
});

// Delete Document
export const deleteDocument = mutation({
  args: { id: v.id("teacher_archives") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return;

    // Delete from storage
    await ctx.storage.delete(doc.blobId);
    
    // Delete from db
    await ctx.db.delete(args.id);
  },
});

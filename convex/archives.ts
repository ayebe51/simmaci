// @ts-nocheck
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateSession, requireAuth } from "./auth_helpers";

// Generate Upload URL for File Upload
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Create new archive record
export const create = mutation({
  args: {
    token: v.string(),
    schoolId: v.id("schools"),
    nomorSk: v.string(),
    title: v.string(),
    year: v.string(),
    category: v.string(),
    storageId: v.string(),
    fileUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.token);
    
    // RBAC: Verify user belongs to school (if operator)
    if (user.role === "operator") {
        const school = await ctx.db.get(args.schoolId);
        if (!school || school.nama !== user.unit) {
             throw new Error("Unauthorized: Cannot upload for another school");
        }
    }

    const id = await ctx.db.insert("sk_archives", {
      schoolId: args.schoolId,
      nomorSk: args.nomorSk,
      title: args.title,
      year: args.year,
      category: args.category,
      storageId: args.storageId,
      fileUrl: args.fileUrl,
      uploadedBy: user._id,
      createdAt: Date.now(),
    });

    return id;
  },
});

// List archives (Filtered by School for Operators)
export const list = query({
  args: {
    token: v.optional(v.string()), // Optional for public/admin, but strictly enforce for operator
    schoolId: v.optional(v.id("schools")), // Filter by specific school
  },
  handler: async (ctx, args) => {
    // Auth Check
    let user = null;
    if (args.token) {
        user = await validateSession(ctx, args.token);
    }

    // RBAC Logic for Operator
    if (user && user.role === "operator" && user.unit) {
        const school = await ctx.db
            .query("schools")
            .filter(q => q.eq(q.field("nama"), user.unit))
            .first();
            
        if (school) {
             return await ctx.db
                .query("sk_archives")
                .withIndex("by_school", q => q.eq("schoolId", school._id))
                .collect();
        } else {
            return [];
        }
    } 
    
    // Admin / Public with filter
    if (args.schoolId) {
        const targetSchoolId = args.schoolId;
        return await ctx.db
            .query("sk_archives")
            .withIndex("by_school", q => q.eq("schoolId", targetSchoolId))
            .collect();
    } 
    
    // Default (All)
    return await ctx.db
        .query("sk_archives")
        .order("desc")
        .collect();
  },
});

// Delete archive
export const remove = mutation({
  args: {
    token: v.string(),
    id: v.id("sk_archives"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.token);
    const archive = await ctx.db.get(args.id);
    
    if (!archive) throw new Error("Not found");

    // RBAC
    if (user.role === "operator") {
         const school = await ctx.db.get(archive.schoolId);
         if (!school || school.nama !== user.unit) {
             throw new Error("Unauthorized");
         }
    }

    // Delete file from storage
    if (archive.storageId) {
        await ctx.storage.delete(archive.storageId);
    }

    // Delete record
    await ctx.db.delete(args.id);
  },
});

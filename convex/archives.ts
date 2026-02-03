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
    let query = ctx.db.query("sk_archives");

    // Auth Check
    let user = null;
    if (args.token) {
        user = await validateSession(ctx, args.token);
    }

    // RBAC Logic
    if (user && user.role === "operator" && user.unit) {
        // Find school ID for this operator
        // Operator 'unit' is school Name. We need ID.
        // But the query arguments might pass schoolId.
        // We must ensure the passed schoolId MATCHES the operator's unit.
        // OR we just ignore args.schoolId and force filter by operator's school?
        
        // Let's resolve Operator's School ID first
        const school = await ctx.db
            .query("schools")
            .filter(q => q.eq(q.field("nama"), user.unit))
            .first();
            
        if (school) {
            // Force filter to this school
            query = query.withIndex("by_school", q => q.eq("schoolId", school._id));
        } else {
            // Operator has invalid school? Return empty.
            return [];
        }
    } else if (args.schoolId) {
        // Admin or Public filtering by specific school
        query = query.withIndex("by_school", q => q.eq("schoolId", args.schoolId));
    } else {
        // Admin seeing all? Or default sort?
        query = query.order("desc");
    }

    const results = await query.collect();
    
    // Enrich with school name if needed? 
    // For now returning raw data is fine, frontend handles lookups if needed.
    return results;
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

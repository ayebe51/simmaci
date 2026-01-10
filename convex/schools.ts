import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all schools with optional filters
export const list = query({
  args: {
    kecamatan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let schools = await ctx.db.query("schools").collect();
    
    // Apply filters
    if (args.kecamatan && args.kecamatan !== "all") {
      schools = schools.filter(s => s.kecamatan === args.kecamatan);
    }
    
    return schools;
  },
});

// Get single school by ID
export const get = query({
  args: { id: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get school by NSM
export const getByNsm = query({
  args: { nsm: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schools")
      .withIndex("by_nsm", (q) => q.eq("nsm", args.nsm))
      .first();
  },
});

// Create new school
export const create = mutation({
  args: {
    nsm: v.string(),
    nama: v.string(),
    npsn: v.optional(v.string()),
    alamat: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    telepon: v.optional(v.string()),
    email: v.optional(v.string()),
    kepalaMadrasah: v.optional(v.string()),
    akreditasi: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if NSM already exists
    const existing = await ctx.db
      .query("schools")
      .withIndex("by_nsm", (q) => q.eq("nsm", args.nsm))
      .first();
    
    if (existing) {
      throw new Error("NSM sudah terdaftar");
    }
    
    return await ctx.db.insert("schools", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update school
export const update = mutation({
  args: {
    id: v.id("schools"),
    nsm: v.optional(v.string()),
    nama: v.optional(v.string()),
    npsn: v.optional(v.string()),
    alamat: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    telepon: v.optional(v.string()),
    email: v.optional(v.string()),
    kepalaMadrasah: v.optional(v.string()),
    akreditasi: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    
    return id;
  },
});

// Delete school
export const remove = mutation({
  args: { id: v.id("schools") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Bulk create schools (for import)
export const bulkCreate = mutation({
  args: {
    schools: v.array(v.object({
      nsm: v.string(),
      nama: v.string(),
      npsn: v.optional(v.string()),
      alamat: v.optional(v.string()),
      kecamatan: v.optional(v.string()),
      telepon: v.optional(v.string()),
      email: v.optional(v.string()),
      kepalaMadrasah: v.optional(v.string()),
      akreditasi: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const results = [];
    
    for (const school of args.schools) {
      // Check duplicates
      const existing = await ctx.db
        .query("schools")
        .withIndex("by_nsm", (q) => q.eq("nsm", school.nsm))
        .first();
      
      if (!existing) {
        const id = await ctx.db.insert("schools", {
          ...school,
          createdAt: now,
          updatedAt: now,
        });
        results.push(id);
      }
    }
    
    return { count: results.length, ids: results };
  },
});

// Get school count
export const count = query({
  handler: async (ctx) => {
    const schools = await ctx.db.query("schools").collect();
    return schools.length;
  },
});

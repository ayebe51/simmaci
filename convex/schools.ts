import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

// Get paginated schools with optional filters
export const paginatedList = query({
  args: {
    paginationOpts: paginationOptsValidator,
    searchTerm: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { paginationOpts, searchTerm, kecamatan } = args;

    if (searchTerm) {
      // Use search index
      return await ctx.db
        .query("schools")
        .withSearchIndex("search_schools", (q) => {
          let query = q.search("nama", searchTerm);
          if (kecamatan && kecamatan !== "all") {
            query = query.eq("kecamatan", kecamatan);
          }
          return query;
        })
        .paginate(paginationOpts);
    } else {
      // Regular query with optional filter
      if (kecamatan && kecamatan !== "all") {
        return await ctx.db
          .query("schools")
          .withIndex("by_kecamatan", (q) => q.eq("kecamatan", kecamatan))
          .paginate(paginationOpts);
      } else {
        // Default sort by natural order (creation time)
        return await ctx.db
          .query("schools")
          .order("desc")
          .paginate(paginationOpts);
      }
    }
  },
});

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
    statusJamiyyah: v.optional(v.string()),
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
    kepalaMadrasah: v.optional(v.string()),
    akreditasi: v.optional(v.string()),
    statusJamiyyah: v.optional(v.string()),
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

// Delete school (hard delete - to prevent duplicates)
export const remove = mutation({
  args: { id: v.id("schools") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Bulk delete all schools
export const bulkDelete = mutation({
  args: {},
  handler: async (ctx) => {
    const allSchools = await ctx.db.query("schools").collect();
    for (const school of allSchools) {
      await ctx.db.delete(school._id);
    }
    return { count: allSchools.length };
  },
});

// Simple helper (consistent with auth.ts)
function hashPassword(password: string): string {
  return btoa(password);
}

// Create School Account (Operator)
export const createSchoolAccount = mutation({
  args: { 
    schoolId: v.id("schools"),
    customEmail: v.optional(v.string()), 
    customPassword: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) throw new Error("School not found");

    const email = args.customEmail || `${school.nsm}@maarif.nu`;
    const password = args.customPassword || "123456";

    // Check existing user
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
       // If exists, just update the unit/role linkage to be sure
       await ctx.db.patch(existing._id, {
           role: "operator",
           unit: school.nama,
           isActive: true
       });
       return { message: "Account updated", email, password: "(Unchanged)" };
    }

    // Create new user
    await ctx.db.insert("users", {
        email,
        name: `Admin ${school.nama}`,
        passwordHash: hashPassword(password),
        role: "operator",
        unit: school.nama,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });

    return { message: "Account created", email, password };
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
      statusJamiyyah: v.optional(v.string()),
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

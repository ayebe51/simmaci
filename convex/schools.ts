import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { validateSession, requireAuth } from "./auth_helpers";


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
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let schools = await ctx.db.query("schools").collect();
    
    // RBAC: Check if user is an Operator via Token
    // We try to get user from token if provided
    let user = null;
    if ((args as any).token) {
        user = await validateSession(ctx, (args as any).token);
    } 
    // Fallback? No, if token provided we rely on it. If not, public list?
    // Current behavior: Public list unless operator.
    
    // We can't change args signature easily without breaking unknown callers?
    // Actually we can add optional token arg.
    
    if (user && user.role === "operator" && user.unit) {

       if (user && user.role === "operator" && user.unit) {
           // Strict filter for operators: only return their own school
           const userUnit = user.unit;
           schools = schools.filter(s => s.nama === userUnit);
       }
    }

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

// Get current operator's school
export const getMyself = query({
  args: { token: v.string() }, 
  handler: async (ctx, args) => {
    const user = await validateSession(ctx, args.token);

    if (!user || !user.unit) return null;

    // 1. Try exact match
    let school = await ctx.db
      .query("schools")
      .filter(q => q.eq(q.field("nama"), user.unit))
      .first();
    
    const unitName = user.unit || "";

    // 2. Fallback: Try matching NSM if unit looks like NSM (digits)
    if (!school && /^\d+$/.test(unitName)) {
         school = await ctx.db
            .query("schools")
            .withIndex("by_nsm", q => q.eq("nsm", unitName))
            .first();
    }

    // 3. Fallback: Try case-insensitive search (expensive but necessary for manual inputs)
    // Note: This matches the search_schools index logic
    if (!school && unitName) {
        school = await ctx.db
            .query("schools")
            .withSearchIndex("search_schools", q => q.search("nama", unitName))
            .first();
    }
      
    return school;
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

// Bulk create school accounts (for initial distribution)
export const bulkCreateSchoolAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    const schools = await ctx.db.query("schools").collect();
    const results = [];

    for (const school of schools) {
      if (!school.nsm) continue;

      const email = `${school.nsm}@maarif.nu`;
      const password = "123456"; // Default
      
      let status = "Existing";
      
      // Check if user exists
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      if (!existing) {
        // Create
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
        status = "Created";
      } else {
           // Update linkage
           await ctx.db.patch(existing._id, {
               role: "operator",
               unit: school.nama,
           });
           status = "Updated";
      }

      results.push({
        nsm: school.nsm,
        nama: school.nama,
        email,
        password: "123456",
        status
      });
    }

    return results;
  }
});

// Update school profile (Self-service for Operators)
export const updateSelf = mutation({

  args: {
    token: v.string(), // Secure token
    alamat: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    telepon: v.optional(v.string()),
    // email: v.optional(v.string()), // Conflict with arg? No, school email field vs user email arg.
    // actually args.email is the identifying email.
    // But we also allow updating the school's email field.
    schoolEmail: v.optional(v.string()), // Renamed from email to avoid conflict
    kepalaMadrasah: v.optional(v.string()),
    akreditasi: v.optional(v.string()),
    npsn: v.optional(v.string()),
    statusJamiyyah: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.token);



    if (!user || user.role !== "operator" || !user.unit) {
      throw new Error("Unauthorized: Only operators can update their school profile.");
    }

    // Find the school by name (user.unit)
    // 1. Exact match
    let school = await ctx.db
      .query("schools")
      .filter(q => q.eq(q.field("nama"), user.unit))
      .first();

    const unitName = user.unit || "";

    // 2. Fallback: NSM
    if (!school && /^\d+$/.test(unitName)) {
         school = await ctx.db
            .query("schools")
            .withIndex("by_nsm", q => q.eq("nsm", unitName))
            .first();
    }

    // 3. Fallback: Search
    if (!school && unitName) {
        school = await ctx.db
            .query("schools")
            .withSearchIndex("search_schools", q => q.search("nama", unitName))
            .first();
    }

    if (!school) {
       throw new Error(`School not found: ${user.unit}`);
    }

    const updates: any = {
        updatedAt: Date.now()
    };
    
    if (args.alamat !== undefined) updates.alamat = args.alamat;
    if (args.kecamatan !== undefined) updates.kecamatan = args.kecamatan;
    if (args.telepon !== undefined) updates.telepon = args.telepon;
    if (args.schoolEmail !== undefined) updates.email = args.schoolEmail;
    if (args.kepalaMadrasah !== undefined) updates.kepalaMadrasah = args.kepalaMadrasah;
    if (args.akreditasi !== undefined) updates.akreditasi = args.akreditasi;
    if (args.npsn !== undefined) updates.npsn = args.npsn;
    if (args.statusJamiyyah !== undefined) updates.statusJamiyyah = args.statusJamiyyah;

    await ctx.db.patch(school._id, updates);

    return school._id;
  },
});

// Get school count
export const count = query({
  handler: async (ctx) => {
    const schools = await ctx.db.query("schools").collect();
    return schools.length;
  },
});

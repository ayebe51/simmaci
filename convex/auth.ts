import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createSession, validatePassword } from "./auth_helpers";

// Simple password hashing (in production, use proper bcrypt or Convex Auth)
function hashPassword(password: string): string {
  // Simple hash for demo - in production use proper encryption
  return btoa(password); // Base64 encoding using web API
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Register new user
export const register = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    password: v.string(),
    role: v.optional(v.string()),
    unit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (existing) {
      throw new Error("Email already registered");
    }
    
    // Create user
    validatePassword(args.password); // Enforce password policy

    // Resolve School ID if unit is provided
    let schoolId = undefined;
    if (args.unit) {
        const unitName = args.unit;
        // 1. Try exact name match
        let school = await ctx.db
            .query("schools")
            .filter((q) => q.eq(q.field("nama"), unitName))
            .first();
        
        // 2. Fallback: Try "MTs" instead of "MTsS" if starts with MTsS
        if (!school && unitName.startsWith("MTsS ")) {
             const normalized = unitName.replace("MTsS ", "MTs ");
             school = await ctx.db
                .query("schools")
                .filter((q) => q.eq(q.field("nama"), normalized))
                .first();
        }

        if (school) schoolId = school._id;
        
        // 3. Try NSM match if looks like number
        if (!schoolId && /^\d+$/.test(unitName)) {
             const byNsm = await ctx.db
                .query("schools")
                .withIndex("by_nsm", (q) => q.eq("nsm", unitName))
                .first();
             if (byNsm) schoolId = byNsm._id;
        }
    }

    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      passwordHash: hashPassword(args.password),
      role: args.role || "operator",
      unit: args.unit,
      schoolId: schoolId, // New field
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return { userId, email: args.email, name: args.name };
  },
});

// Login user
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (!user) {
      throw new Error("Invalid credentials");
    }
    
    // Verify password
    if (!verifyPassword(args.password, user.passwordHash)) {
      throw new Error("Invalid credentials");
    }
    
    // Check if active
    if (!user.isActive) {
      throw new Error("Account is inactive");
    }
    
    // Create session
    const token = await createSession(ctx, user._id);
    
    // Return user data (without password hash)
    return {
      user: {
        _id: user._id,  // Changed from 'id' to '_id' for consistency
        email: user.email,
        name: user.name,
        role: user.role,
        unitKerja: user.unit, // Map to frontend format
        schoolId: user.schoolId, // New field for frontend context
      },
      token, 
    };
  },
});

// Get current user
export const getCurrentUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      return null;
    }
    
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      unitKerja: user.unit, // Map to frontend format
      schoolId: user.schoolId, // New field context
      isActive: user.isActive,
    };
  },
});

// Create default admin user (run once)
export const createDefaultAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if admin exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "admin@maarif.nu"))
      .first();
    
    if (existing) {
      return { message: "Admin already exists", userId: existing._id };
    }
    
    // Create admin
    const userId = await ctx.db.insert("users", {
      email: "admin@maarif.nu",
      name: "Admin Maarif",
      passwordHash: hashPassword("admin123"),
      role: "super_admin",
      unit: undefined,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return { 
      message: "Default admin created", 
      userId,
      credentials: {
        email: "admin@maarif.nu",
        password: "admin123"
      }
    };
  },
});

// List all users (admin only check should be done in frontend/middleware)
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    try {
      const users = await ctx.db.query("users").collect();
      
      return users.map(u => ({
        id: u._id,
        email: u.email,
        name: u.name,
        role: u.role,
        unitKerja: u.unit, // Map to frontend format
        isActive: u.isActive,
        createdAt: u.createdAt,
      }));
    } catch (e: any) {
      console.error("Error in listUsers:", e);
      // Construct a safe error message
      const errorMessage = e.message || "Unknown error";
      console.error(`Detailed error stats: ${JSON.stringify(e)}`);
      throw new Error(`Failed to list users: ${errorMessage}`);
    }
  },
});

// Paginated User List for Management Page
export const listUsersPage = query({
  args: {
    paginationOpts: v.any(), // Using v.any() to pass pagination options safely or v.object({...}) 
    // Convex pagination options structure is specific, usually better to pass standard args and build opts inside?
    // Actually standard pattern is passing paginationOpts (cursor, numItems).
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db.query("users").order("desc");

    // Note: Search with filter is manual in Convex if not using search index.
    // For pagination + search, we usually use search index.
    // But `users` table doesn't have search index on name/email defined in this file (schema hidden).
    // If I use filter, I can't use `order("desc")` efficiently without index?
    // `order` requires index.
    // Let's stick to simple pagination first.
    // If search is present, we might need to filter manually?
    // If I filter manually, I can't use .paginate().
    // So for now, I'll paginate ALL users, and handle search via `withSearchIndex` if available, or just filter on client?
    // User wants pagination to reduce scroll.
    // Let's just implement simple pagination. Search can be done on client IF we fetch all?
    // No, if paginated, fetching all defeats point.
    // I'll check if `users` has search index. `dashboard.ts` used `withIndex("by_email")`.
    // I'll assume simple pagination on ALL users for now. Search will only work on LOADED page or I must use search query.
    
    // Using default pagination
    const results = await query.paginate(args.paginationOpts);

    return {
      ...results,
      page: results.page.map(u => ({
        id: u._id,
        email: u.email,
        name: u.name,
        role: u.role,
        unitKerja: u.unit,
        isActive: u.isActive,
        createdAt: u.createdAt,
      }))
    };
  }
});

// Update user's assigned school (unitKerja)
export const updateUserSchool = mutation({
  args: {
    userId: v.id("users"),
    schoolName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Update user's unit field
    await ctx.db.patch(args.userId, {
      unit: args.schoolName || undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
// Update user details (admin function)
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    role: v.optional(v.string()),
    unit: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    password: v.optional(v.string()), // Optional password reset
  },
  handler: async (ctx, args) => {
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.role !== undefined) updates.role = args.role;
    if (args.unit !== undefined) updates.unit = args.unit;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    
    // Only hash password if provided
    if (args.password) {
      validatePassword(args.password); // Enforce policy if updating password
      updates.passwordHash = hashPassword(args.password);
    }

    await ctx.db.patch(args.userId, updates);
    return { success: true };
  },
});

// Change password (user self-service)
export const changePassword = mutation({
  args: {
    userId: v.id("users"),
    oldPassword: v.string(),
    newPassword: v.string()
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify old password
    if (!verifyPassword(args.oldPassword, user.passwordHash)) {
      throw new Error("Password lama salah");
    }

    // Update with new password
    validatePassword(args.newPassword); // Enforce policy
    await ctx.db.patch(args.userId, {
      passwordHash: hashPassword(args.newPassword),
      updatedAt: Date.now()
    });

    return { success: true };
  }
});

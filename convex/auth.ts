import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      passwordHash: hashPassword(args.password),
      role: args.role || "operator",
      unit: args.unit,
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
    
    // Return user data (without password hash)
    return {
      user: {
        _id: user._id,  // Changed from 'id' to '_id' for consistency
        email: user.email,
        name: user.name,
        role: user.role,
        unitKerja: user.unit, // Map to frontend format
      },
      token: user._id, // Using user ID as token for simplicity
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
    let query = ctx.db.query("users").order("desc");

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
      updates.passwordHash = hashPassword(args.password);
    }

    await ctx.db.patch(args.userId, updates);
    return { success: true };
  },
});

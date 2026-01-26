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

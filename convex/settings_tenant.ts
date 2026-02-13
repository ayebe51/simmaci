import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth_helpers";

// Get Settings for the Current User's School
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user || !user.schoolId) return null;

    const settings = await ctx.db
      .query("tenant_settings")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .first();

    // Resolve Storage ID to URL for frontend
    if (settings?.kopSuratId) {
        const url = await ctx.storage.getUrl(settings.kopSuratId);
        return { ...settings, kopSuratUrl: url };
    }

    return settings;
  },
});

// Upsert Settings
export const update = mutation({
  args: {
    logoUrl: v.optional(v.string()),
    kopSuratId: v.optional(v.id("_storage")),
    kepalaSekolahNama: v.optional(v.string()),
    kepalaSekolahNip: v.optional(v.string()),
    nomorSuratFormat: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user || !user.schoolId) throw new Error("User not linked to a school!");

    // RESTRICTION: Only Admin Yayasan or Super Admin can change these settings
    // School Operators are Read-Only for these critical fields
    if (user.role !== "admin_yayasan" && user.role !== "super_admin") {
        throw new Error("Akses Ditolak: Pengaturan ini hanya dapat diubah oleh Admin Yayasan.");
    }

    const existing = await ctx.db
      .query("tenant_settings")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .first();

    if (existing) {
        await ctx.db.patch(existing._id, {
            ...args,
            updatedAt: Date.now(),
        });
    } else {
        await ctx.db.insert("tenant_settings", {
            schoolId: user.schoolId!,
            ...args,
            updatedAt: Date.now(),
        });
    }
  },
});

// Generate Upload URL for Images
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

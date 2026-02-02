import { mutation } from "./_generated/server";
import { v } from "convex/values";

function hashPassword(password: string): string {
  return btoa(password);
}

export const restoreLostAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    const usersToRestore = [
      { email: "alayyubi612@gmail.com", name: "Super Admin", role: "super_admin" },
      { email: "maarifnuclp@gmail.com", name: "Admin Yayasan", role: "admin_yayasan" }
    ];

    const results = [];

    for (const u of usersToRestore) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", u.email))
        .first();

      if (!existing) {
        await ctx.db.insert("users", {
          email: u.email,
          name: u.name,
          passwordHash: hashPassword("123456"),
          role: u.role,
          isActive: true, // Default to inactive until verified? No, auto-active for admins.
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        results.push(`Created ${u.email} as ${u.role}`);
      } else {
        // Force update role just in case
        await ctx.db.patch(existing._id, {
            role: u.role,
            isActive: true
        });
        results.push(`Updated ${u.email} as ${u.role}`);
      }
    }

    return results;
  },
});

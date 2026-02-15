import { query } from "./_generated/server";
import { v } from "convex/values";

export const checkDuplicates = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const emailMap = new Map();
    const duplicates = [];

    for (const u of users) {
        if (!u.email) continue;
        const email = u.email.toLowerCase();
        if (emailMap.has(email)) {
            duplicates.push({
                email,
                user1: emailMap.get(email),
                user2: { name: u.name, role: u.role, id: u._id }
            });
        } else {
            emailMap.set(email, { name: u.name, role: u.role, id: u._id });
        }
    }

    return {
        total_users: users.length,
        duplicate_count: duplicates.length,
        duplicates
    };
  },
});

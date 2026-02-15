import { query } from "./_generated/server";

export const dump = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    // Filter for super/admin roles manually
    const admins = users.filter(u => 
        (u.role || "").toLowerCase().includes("super") || 
        (u.role || "").toLowerCase().includes("admin_yayasan")
    );
    // return array of strings
    return admins.map(u => `EMAIL: ${u.email} | ROLE: ${u.role}`);
  }
});

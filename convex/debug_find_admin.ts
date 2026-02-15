import { query } from "./_generated/server";

export const findAdmin = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const admins = users.filter(u => 
        (u.email || "").includes("alayyubi") || 
        (u.role || "").includes("super")
    );
    return admins.map(u => ({ email: u.email, role: u.role, name: u.name }));
  }
});

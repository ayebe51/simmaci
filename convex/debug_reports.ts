import { query } from "./_generated/server";

export const checkTeacherRekapDebug = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const teachers = await ctx.db.query("teachers").collect();
    const users = await ctx.db.query("users").collect();
    
    return {
      hasIdentity: !!identity,
      identityEmail: identity?.email,
      totalTeachers: teachers.length,
      totalUsers: users.length,
      allEmails: users.map(u => u.email),
      userInDb: identity ? await ctx.db.query("users").withIndex("by_email", q => q.eq("email", identity.email!)).first() : null,
      sampleTeachers: teachers.slice(0, 3).map(t => ({ nama: t.nama, unit: t.unitKerja }))
    };
  }
});

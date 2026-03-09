import { query } from "./_generated/server";

export const dumpToday = query({
  handler: async (ctx) => {
    return await ctx.db.query("teacherAttendance").collect();
  }
});

import { query } from "./_generated/server";

export const testTeacherTable = query({
  handler: async (ctx) => {
    return await ctx.db.query("teacherAttendance").collect();
  }
});

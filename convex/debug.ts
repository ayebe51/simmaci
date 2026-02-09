import { query } from "./_generated/server";

export const listUniqueStatuses = query({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    const statusCounts: Record<string, number> = {};

    teachers.forEach((t) => {
        const s = (t.status || "(EMPTY)").trim().toUpperCase();
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    return statusCounts;
  },
});

import { query } from "./_generated/server";

export const getFirst = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("students").first();
  },
});

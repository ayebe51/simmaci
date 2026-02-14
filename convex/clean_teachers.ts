import { query } from "./_generated/server";

export const count = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("teachers").take(5);
    return docs.length;
  }
});


import { query } from "./_generated/server";

export const countAll = query({
  handler: async (ctx) => {
    const t = await ctx.db.query("teachers").take(1);
    const u = await ctx.db.query("users").take(1);
    const sk = await ctx.db.query("skDocuments").take(1);
    return {
        teachersAlive: t.length,
        usersAlive: u.length,
        skAlive: sk.length
    };
  }
});

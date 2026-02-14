import { query } from "./_generated/server";

export const scan = query({
  args: {},
  handler: async (ctx) => {
    // 1. Raw Dump of first 5 teachers
    const all = await ctx.db.query("teachers").take(5);
    
    // 2. Count Total Active
    const activeInfo = await ctx.db
        .query("teachers")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

    // 3. Count SkGenerated False/Undefined among Active
    const readyForSk = activeInfo.filter(t => t.isSkGenerated !== true);

    return {
        total_sample: all,
        count_active: activeInfo.length,
        count_ready_for_sk: readyForSk.length,
        sample_ready: readyForSk.slice(0, 3)
    };
  }
});

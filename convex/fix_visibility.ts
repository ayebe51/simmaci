import { mutation } from "./_generated/server";

export const resetAll = mutation({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    let count = 0;
    for (const t of teachers) {
        // Force reset visibility flags
        await ctx.db.patch(t._id, {
            isSkGenerated: false,
            isActive: true,
            updatedAt: Date.now() // Bump to top
        });
        count++;
    }
    return `Reset ${count} teachers. All should be visible now.`;
  },
});

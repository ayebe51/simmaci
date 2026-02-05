import { query } from "./_generated/server";

export const check = query({
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").collect();
    return settings.map(s => ({
        key: s.key,
        hasValue: !!s.value,
        valueLength: s.value ? s.value.length : 0,
        updatedAt: new Date(s.updatedAt).toISOString()
    }));
  },
});

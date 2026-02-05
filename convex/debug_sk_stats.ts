import { query } from "./_generated/server";

export const listStatuses = query({
  args: {},
  handler: async (ctx) => {
    const allSks = await ctx.db.query("skDocuments").collect();
    const statuses = allSks.map(sk => sk.status);
    const uniqueStatuses = [...new Set(statuses)];
    console.log("UNIQUE STATUSES:", uniqueStatuses);
    return uniqueStatuses;
  },
});

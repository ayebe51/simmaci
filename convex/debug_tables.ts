
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const tables = ["teachers", "users", "skDocuments", "headmasterTenures"]; // "students" excluded
    const report: any = {};
    for (const t of tables) {
        // @ts-ignore
        const docs = await ctx.db.query(t).take(1);
        report[t] = docs.length;
    }
    return report;
  }
});

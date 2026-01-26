import { mutation } from "./_generated/server";

export const cleanSk = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("Cleanup script started");
    const docs = await ctx.db.query("skDocuments").collect();
    console.log(`Found ${docs.length} docs`);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    console.log("Cleanup script finished");
    return docs.length;
  },
});

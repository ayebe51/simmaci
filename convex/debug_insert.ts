import { mutation } from "./_generated/server";

export const insertTest = mutation({
  args: {},
  handler: async (ctx) => {
    const id = await ctx.db.insert("teachers", {
        nama: "TEST DEBUG TEACHER",
        nuptk: "99999999",
        unitKerja: "DEBUG UNIT",
        isActive: true,
        isSkGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    });
    return id;
  },
});


import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const logReport = internalMutation({
    args: { report: v.any(), status: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.insert("debug_logs", {
            action: "debug_node:check",
            report: args.report,
            status: args.status,
            createdAt: Date.now()
        });
    }
});

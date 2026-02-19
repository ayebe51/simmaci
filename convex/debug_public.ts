
import { action, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const trigger = action({
  args: {},
  handler: async (ctx) => {
    // This calls the internal Node action which logs to DB
    const res = await ctx.runAction(internal.debug_actions.check);
    return res as any;
  }
});

export const getLatestLog = query({
    args: {},
    handler: async (ctx) => {
        const log = await ctx.db.query("debug_logs")
            .withIndex("by_created")
            .order("desc")
            .first();
        return log;
    }
});

export const readLogAsString = query({
    args: {},
    handler: async (ctx) => {
        const log = await ctx.db.query("debug_logs")
            .withIndex("by_created")
            .order("desc")
            .first();
        
        if (!log) return "NO_LOGS";
        
        // Throwing ensures CLI prints the message
        throw new Error("DEBUG_LOG_CONTENT: " + JSON.stringify(log.report, null, 2));
    }
});

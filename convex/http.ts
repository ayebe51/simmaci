
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/drive-debug",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
        const result = await ctx.runAction(internal.debug_actions.check);
        return new Response(JSON.stringify(result, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }, null, 2), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
  }),
});


// Expose latest log via HTTP JSON
http.route({
  path: "/drive-status",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const log = await ctx.runQuery(internal.debug_public.readLogAsString);
    // readLogAsString throws error string, so we need a query that returns JSON object
    // But wait, readLogAsString throws! I should use a new query or modify existing.
    // Let's use a simple inline query via runQuery is not possible strictly (needs export).
    // Let's use internal.debug_public.getLatestLog
    const latestLog = await ctx.runQuery(internal.debug_public.getLatestLog);
    
    return new Response(JSON.stringify(latestLog, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Allow browser debugging
      },
    });
  }),
});

export default http;

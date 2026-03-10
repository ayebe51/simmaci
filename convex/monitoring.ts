import { action } from "./_generated/server";
import { v } from "convex/values";

export const checkWaStatus = action({
  args: {
    gowaUrl: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Clean URL: ensure it starts with http
      let url = args.gowaUrl.trim();
      if (!url.startsWith("http")) {
        url = `https://${url}`;
      }
      // Remove trailing slash
      url = url.replace(/\/+$/, "");

      const tryEndpoints = [url, `${url}/send/message`];
      let lastError = null;

      for (const target of tryEndpoints) {
        try {
          // Use HEAD first if possible, then GET
          const response = await fetch(target, {
            method: "HEAD",
            headers: { "User-Agent": "Convex-Health-Check/1.0" },
            signal: AbortSignal.timeout(4000),
          }).catch(() => fetch(target, {
             method: "GET",
             headers: { "User-Agent": "Convex-Health-Check/1.0" },
             signal: AbortSignal.timeout(4000),
          }));

          // If we got ANY response, even 404/405, it's alive!
          if (response) {
            return { 
              online: true, 
              status: response.status,
              endpoint: target
            };
          }
        } catch (e: any) {
          lastError = e;
          continue;
        }
      }

      return { 
        online: false, 
        error: lastError?.message || "All endpoints unreachable" 
      };
    } catch (error: any) {
      return { online: false, error: error.message };
    }
  },
});

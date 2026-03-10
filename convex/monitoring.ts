import { action } from "./_generated/server";
import { v } from "convex/values";

export const checkWaStatus = action({
  args: {
    gowaUrl: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Clean URL: ensure it starts with http and doesn't have double slashes
      let url = args.gowaUrl;
      if (!url.startsWith("http")) {
        url = `https://${url}`;
      }
      
      // Ping the base URL
      // Try to fetch with a timeout and common headers
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Convex-Health-Check/1.0",
        },
        signal: AbortSignal.timeout(7000), // Slightly longer timeout
      });

      // If we got ANY response (200, 404, 405, 403), it means the server is REACHABLE
      // Especially if user says messages are sending, even a 404 on the root "/" 
      // means the tunnel and server are active.
      return { 
        online: true, 
        status: response.status,
        statusText: response.statusText
      };
    } catch (error: any) {
      console.error("WA Health Check Detail:", error);
      return { 
        online: false, 
        error: error.message || "Connection Failed" 
      };
    }
  },
});

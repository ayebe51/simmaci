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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(url, { 
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "Convex-Health-Check" }
      });
      
      clearTimeout(timeoutId);

      // If we got any response, the server is "up" enough to reach
      return { 
        online: response.status === 200 || response.status === 404 || response.status === 405, 
        status: response.status 
      };
    } catch (error) {
      console.log("Health check failed:", error);
      return { online: false, error: "Connection failed" };
    }
  },
});

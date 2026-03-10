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

      const functionalTarget = `${url}/send/message`;
      
      // Try functional endpoint with POST (most reliable if they can send messages)
      try {
        const response = await fetch(functionalTarget, {
          method: "POST",
          headers: { 
            "User-Agent": "Convex-Health-Check/1.0",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ping: true }),
          signal: AbortSignal.timeout(12000), // Significant timeout for Cloudflare tunnels
        });
        
        // If we got ANY response, it's alive
        return { online: true, status: response.status, method: "POST" };
      } catch (postError) {
        // Fallback to simple HEAD on root if POST fails
        const rootResponse = await fetch(url, {
          method: "HEAD",
          headers: { "User-Agent": "Convex-Health-Check/1.0" },
          signal: AbortSignal.timeout(5000),
        });
        return { online: true, status: rootResponse.status, method: "HEAD" };
      }
    } catch (error: any) {
      console.error("WA Health Check Final Failed:", error);
      return { online: false, error: error.message };
    }
  },
});

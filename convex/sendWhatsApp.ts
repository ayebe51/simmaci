import { action } from "./_generated/server";
import { v } from "convex/values";

export const sendMessage = action({
  args: {
    gowaUrl: v.string(), // e.g. "https://gowa-tunnel.trycloudflare.com"
    phone: v.string(),   // e.g. "08123456789"
    message: v.string(), // Message body
    deviceId: v.optional(v.string()), // Target GoWA Device ID
  },
  handler: async (ctx, args) => {
    try {
      // Clean phone number (replace starting '0' with '62', remove spaces/dashes)
      let cleanPhone = args.phone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "62" + cleanPhone.substring(1);
      }
      
      // WhatsApp JID format for GoWA
      const jid = `${cleanPhone}@s.whatsapp.net`;
      
      // Ensure URL doesn't have trailing slash
      const baseUrl = args.gowaUrl.replace(/\/$/, "");
      const sendUrl = `${baseUrl}/send/message`;
      
      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      // If a device ID is provided for multi-tenant setups
      if (args.deviceId) {
        reqHeaders["X-Device-ID"] = args.deviceId;
      }

      const response = await fetch(sendUrl, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({
          phone: jid,
          message: args.message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to send WhatsApp message:", errorText);
        return { success: false, error: "GoWA API Error" };
      }

      return { success: true };
    } catch (err) {
      console.error("Error communicating with GoWA:", err);
      return { success: false, error: "Connection Error" };
    }
  },
});

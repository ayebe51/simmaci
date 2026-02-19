import { action } from "./_generated/server";
import { v } from "convex/values";

// URL Web App from User
const GAS_UPLOAD_URL = "https://script.google.com/macros/s/AKfycbyot-tdYedtzLwuDkrr2Ue2VXzFESsTESFnT-to1vmD0beR3FP--Rw8BCUYe9nITml2Iw/exec";

export const uploadFile = action({
  args: {
    fileData: v.string(), // Base64 encoded file
    fileName: v.string(),
    mimeType: v.string(),
    folderId: v.optional(v.string()) // Ignored by GAS v1, but kept for compatibility
  },
  handler: async (ctx, args) => {
    try {
        // Validation: Max 500KB
        if (args.fileData.length > 700000) {
             return { success: false, error: "File exceeds 500KB limit." };
        }

        console.log("Proxying upload to Google Apps Script...");

        const response = await fetch(GAS_UPLOAD_URL, {
            method: "POST",
            body: JSON.stringify({
                fileData: args.fileData,
                fileName: args.fileName,
                mimeType: args.mimeType
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`GAS Error ${response.status}: ${text}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || "Unknown GAS Error");
        }

        console.log("GAS Upload Success:", result);

        return {
            success: true,
            id: result.id,
            url: result.url,
            downloadUrl: result.downloadUrl,
            thumbnail: result.thumbnail
        };

    } catch (e: any) {
        console.error("Drive Proxy Error:", e);
        return { success: false, error: e.message || "Unknown Error" };
    }
  }
});

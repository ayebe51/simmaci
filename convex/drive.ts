"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { google } from "googleapis";
import { Readable } from "stream";

// Helper to get Google Auth
const getGoogleAuth = () => {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google Credentials (GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY)");
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
};

export const uploadFile = action({
  args: {
    fileData: v.string(), // Base64 encoded file
    fileName: v.string(),
    mimeType: v.string(),
    folderId: v.optional(v.string()) // Optional override
  },
  handler: async (ctx, args) => {
    try {
      const auth = getGoogleAuth();
      const drive = google.drive({ version: 'v3', auth });

      // Decode Base64
      const buffer = Buffer.from(args.fileData, 'base64');
      const stream = Readable.from(buffer);

      const targetFolderId = args.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
      
      if (!targetFolderId) {
          return { success: false, error: "Missing GOOGLE_DRIVE_FOLDER_ID in server environment." };
      }

      console.log(`Uploading ${args.fileName} to Drive Folder: ${targetFolderId}...`);

      const fileMetadata = {
        name: args.fileName,
        parents: [targetFolderId],
      };

      const media = {
        mimeType: args.mimeType,
        body: stream,
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink, thumbnailLink',
      });

      console.log("Upload Success:", response.data);

      if (args.mimeType.startsWith('image/')) {
          try {
              await drive.permissions.create({
                  fileId: response.data.id!,
                  requestBody: {
                      role: 'reader',
                      type: 'anyone', // Public reading for KTA images
                  },
              });
              console.log("Made public for KTA");
          } catch(e) {
              console.error("Failed to make public:", e);
              // Non-fatal error
          }
      }

      return {
          success: true,
          id: response.data.id,
          url: response.data.webViewLink, // View in Drive
          downloadUrl: response.data.webContentLink, // Direct download/render often
          thumbnail: response.data.thumbnailLink
      };

    } catch (e: any) {
      console.error("Google Drive Upload Error:", e);
      // Return error to client instead of throwing Server Error
      return { success: false, error: e.message || "Unknown Google Drive Error" };
    }
  },
});

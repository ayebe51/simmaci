"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { google } from "googleapis";

export const check = internalAction({
  args: {},
  handler: async (ctx) => {
    const report: any = { status: "NODE_ACTION_START" };
    try {
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      report.env = {
          hasEmail: !!clientEmail,
          email: clientEmail,
          hasKey: !!privateKey,
          keyLen: privateKey?.length,
          hasFolder: !!folderId,
          folderId: folderId
      };

      if (!clientEmail || !privateKey || !folderId) {
        throw new Error("Missing Env Vars");
      }

      const formattedKey = privateKey.replace(/\\n/g, '\n');
      
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: formattedKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive'], 
      });

      const drive = google.drive({ version: 'v3', auth });

      // 1. Check Folder Exists
      try {
        const folder = await drive.files.get({
          fileId: folderId,
          fields: 'id, name, capabilities(canAddChildren, canEdit), permissions(emailAddress, role)',
        });
        
        report.folderFound = true;
        report.folderName = folder.data.name;
        report.permissions = folder.data.permissions;

        // 2. Try Uploading Dummy File
        try {
            const file = await drive.files.create({
                requestBody: {
                    name: `DEBUG_HTTP_${Date.now()}.txt`,
                    parents: [folderId],
                },
                media: {
                    mimeType: 'text/plain',
                    body: 'Test content from Node Internal Action',
                },
                fields: 'id',
            });
            
            report.uploadSuccess = true;
            report.fileId = file.data.id;
            
            // Clean up
            if (file.data.id) {
                await drive.files.delete({ fileId: file.data.id });
                report.cleanupSuccess = true;
            }

        } catch (uploadErr: any) {
             report.uploadSuccess = false;
             report.uploadError = uploadErr.message;
        }

      } catch (folderErr: any) {
         report.folderFound = false;
         report.error = folderErr.message;
      }

      await ctx.runMutation(internal.debug_logs.logReport, { report, status: "SUCCESS" });
      return { success: true, report };

    } catch (e: any) {
      const errorReport = { 
          success: false, 
          stage: "FATAL_NODE_CRASH", 
          error: e.message,
          stack: e.stack
      };
      // Try to log error if possible
      try {
        await ctx.runMutation(internal.debug_logs.logReport, { report: errorReport, status: "ERROR" });
      } catch (logErr) {
          console.error("Failed to log error to DB", logErr);
      }
      return errorReport;
    }
  },
});

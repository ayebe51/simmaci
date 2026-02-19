import { action } from "./_generated/server";
import { v } from "convex/values";
import * as jose from 'jose';

export const uploadFile = action({
  args: {
    fileData: v.string(), // Base64 encoded file
    fileName: v.string(),
    mimeType: v.string(),
    folderId: v.optional(v.string()) // Optional override
  },
  handler: async (ctx, args) => {
    try {
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        
        if (!clientEmail || !privateKey) {
            return { success: false, error: "Missing Google Credentials (GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY)" };
        }

        const targetFolderId = args.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!targetFolderId) {
            return { success: false, error: "Missing GOOGLE_DRIVE_FOLDER_ID environment variable." };
        }

        // 1. Sign JWT
        const alg = 'RS256';
        let key: jose.KeyLike | Uint8Array;
        try {
            key = await jose.importPKCS8(privateKey, alg);
        } catch (keyErr: any) {
            console.error("Key Import Error:", keyErr);
            return { success: false, error: "Invalid Private Key Format: " + keyErr.message };
        }

        const jwt = await new jose.SignJWT({ 
            scope: 'https://www.googleapis.com/auth/drive.file' 
        })
          .setProtectedHeader({ alg })
          .setIssuedAt()
          .setIssuer(clientEmail)
          .setSubject(clientEmail)
          .setAudience('https://oauth2.googleapis.com/token')
          .setExpirationTime('1h')
          .sign(key);
        
        // 2. Exchange JWT for Access Token
        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt
            })
        });

        if (!tokenResp.ok) {
            const tokenErr = await tokenResp.text();
            console.error("Token Error:", tokenErr);
            return { success: false, error: "Failed to get Access Token: " + tokenErr };
        }

        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;

        // 3. Upload File (Multipart/Related or Resumable)
        // Simple Upload for now (limit 5MB usually fine for simple upload, technically supports up to 5MB, 
        // but robust upload should be multipart. Let's do simple multipart.)
        
        const boundary = 'foo_bar_baz';
        const metadata = {
            name: args.fileName,
            parents: [targetFolderId]
        };
        
        // Decode Base64 to Uint8Array
        const binaryString = atob(args.fileData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Construct Body
        let body = `--${boundary}\r\n`;
        body += `Content-Type: application/json; charset=UTF-8\r\n\r\n`;
        body += JSON.stringify(metadata) + `\r\n`;
        body += `--${boundary}\r\n`;
        body += `Content-Type: ${args.mimeType}\r\n`;
        body += `Content-Transfer-Encoding: base64\r\n\r\n`;
        body += args.fileData + `\r\n`; // Send base64 directly? No, usually binary.
        // Wait, "uploadType=multipart" expects the *content* part to be the data.
        // If we send base64, we need "Content-Transfer-Encoding: base64".
        // Yes, that works.
        body += `--${boundary}--`;

        const uploadResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
                'Content-Length': body.length.toString()
            },
            body: body
        });
        
        if (!uploadResp.ok) {
             const uploadErr = await uploadResp.text();
             console.error("Upload Error:", uploadErr);
             return { success: false, error: "Drive Upload Failed: " + uploadErr };
        }

        const fileData = await uploadResp.json();
        console.log("Upload Success:", fileData);

        // 4. Make Public (for images)
        if (args.mimeType.startsWith('image/')) {
            await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                })
            }).catch(e => console.error("Permission Error (Ignored):", e));
        }

        return {
            success: true,
            id: fileData.id,
            url: fileData.webViewLink,
            downloadUrl: fileData.webContentLink,
            thumbnail: fileData.thumbnailLink
        };

    } catch (e: any) {
        console.error("V8 Drive Error:", e);
        return { success: false, error: e.message || "Unknown V8 Error" };
    }
  }
});

import { action } from "./_generated/server";

export const checkEnv = action({
  args: {},
  handler: async () => {
    const email = process.env.GOOGLE_CLIENT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;
    const folder = process.env.GOOGLE_DRIVE_FOLDER_ID;

    return {
      GOOGLE_CLIENT_EMAIL: email ? email.substring(0, 5) + "..." : "MISSING",
      GOOGLE_PRIVATE_KEY_LENGTH: key ? key.length : 0,
      GOOGLE_DRIVE_FOLDER_ID: folder ? folder : "MISSING",
      NODE_ENV: process.env.NODE_ENV
    };
  }
});

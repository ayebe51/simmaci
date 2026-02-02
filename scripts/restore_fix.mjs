import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://successful-bison-83.convex.cloud");

const targets = [
  { email: "alayyubi612@gmail.com", name: "Super Admin", role: "super_admin" },
  { email: "maarifnuclp@gmail.com", name: "Admin Yayasan", role: "admin_yayasan" }
];

async function run() {
  console.log("Starting restoration...");
  for (const t of targets) {
    console.log(`Processing ${t.email}...`);
    try {
      // Try Register
      await client.mutation(api.auth.register, {
        email: t.email,
        name: t.name,
        password: "123456",
        role: t.role
      });
      console.log("✅ Registered new account.");
    } catch (e) {
      if (e.message.includes("Email already registered")) {
        console.log("⚠️ Account exists. Attempting update...");
        try {
            // Find user ID via listUsers
            const allUsers = await client.query(api.auth.listUsers);
            const user = allUsers.find(u => u.email === t.email);
            
            if (user) {
                await client.mutation(api.auth.updateUser, {
                    userId: user.id,
                    role: t.role,
                    password: "123456", // Force reset password
                    isActive: true
                });
                console.log("✅ Updated existing account (Role + Password reset).");
            } else {
                console.log("❌ Error: Email registered but not found in listUsers. Inconsistent state.");
            }
        } catch (err) {
            console.log("❌ Update Failed:", err.message);
        }
      } else {
        console.log("❌ Register Failed:", e.message);
      }
    }
  }
}

run();

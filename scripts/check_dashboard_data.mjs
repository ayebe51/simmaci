import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import * as dotenv from "dotenv";

dotenv.config();

const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function checkLogs() {
    try {
        console.log("Checking activity_logs table...");
        const stats = await client.query(api.dashboard.getStats);
        console.log("Stats result:", JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error("Error checking stats:", e);
    }
}

checkLogs();

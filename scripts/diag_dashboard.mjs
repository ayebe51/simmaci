import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import * as dotenv from "dotenv";

dotenv.config();

const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function checkDashboard() {
    try {
        const stats = await client.query(api.dashboard.getStats);
        console.log("DASHBOARD_STATS_RESPONSE:", JSON.stringify({
            hasLogs: !!stats.recentLogs,
            logsLength: stats.recentLogs?.length,
            firstLog: stats.recentLogs?.[0]
        }, null, 2));
    } catch (e) {
        console.error("DIAGNOSTIC_ERROR:", e);
    }
}

checkDashboard();

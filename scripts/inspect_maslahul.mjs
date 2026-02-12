
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://uncommon-dachshund-623.convex.cloud");

console.log("🔍 Inspecting Data...");

async function run() {
    try {
        // 1. Fetch Teachers
        console.log("Fetching teachers...");
        const teachers = await client.query("teachers:list", {}); 
        const maslahul = teachers.find(t => t.nama && t.nama.toLowerCase().includes("maslahul"));
        
        if (maslahul) {
            console.log("\n✅ FOUND TEACHER: Maslahul");
            console.log("ID:", maslahul._id);
            console.log("Nama:", maslahul.nama);
            console.log("TMT RAW:", maslahul.tmt);
            console.log("TMT Type:", typeof maslahul.tmt);
            console.log("Status:", maslahul.status);
            console.log("SatMinkal:", maslahul.unitKerja);
        } else {
            console.log("\n❌ Teacher 'Maslahul' NOT FOUND in 'teachers:list'.");
        }

        // 2. Fetch Headmasters for ID
        console.log("\nFetching Headmaster Tenures...");
        const tenures = await client.query("headmasters:list", {});
        if (tenures && tenures.length > 0) {
            const first = tenures[0];
            console.log("Sample Tenure ID:", first._id);
            console.log("Teacher Name:", first.teacher?.nama);
            console.log("Status:", first.status);
        } else {
            console.log("No Headmaster Tenures found.");
        }

    } catch (e) {
        console.error("❌ Error querying Convex:", e);
    }
}

run();

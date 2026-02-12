
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://uncommon-dachshund-623.convex.cloud");

console.log("🔍 Inspecting ALL teachers named 'Maslahul'...");

async function run() {
    try {
        const teachers = await client.query("teachers:list", { unitKerja: "DEBUG_ALL" });
        const matches = teachers.filter(t => t.nama && t.nama.toLowerCase().includes("maslahul"));

        console.log(`Found ${matches.length} matches:`);
        matches.forEach(m => {
            console.log(`\n--------------------------------------------------`);
            console.log(`Name: ${m.nama}`);
            console.log(`ID: ${m._id}`);
            console.log(`TMT: "${m.tmt}"`); 
            console.log(`NUPTK: ${m.nuptk}`);
            console.log(`SatMinkal: ${m.unitKerja}`);
            console.log(`Is Active: ${m.isActive}`);
        });

        if (matches.length === 0) {
            console.log("❌ No teachers named 'Maslahul' found in the public list.");
        }

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

run();

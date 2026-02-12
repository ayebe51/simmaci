
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://uncommon-dachshund-623.convex.cloud");

console.log("🔍 Inspecting RAW Teacher Data (First 50)...");

async function run() {
    try {
        // Use DEBUG_ALL to bypass filters
        const teachers = await client.query("teachers:list", { unitKerja: "DEBUG_ALL" });
        
        console.log(`\n📦 Total Teachers Fetched: ${teachers.length}`);
        
        if (teachers.length > 0) {
            console.log("\n--- First 5 Samples ---");
            teachers.slice(0, 5).forEach((t, i) => {
                console.log(`\n[${i+1}] ID: ${t._id}`);
                console.log(`    Name: ${t.nama} (Type: ${typeof t.nama})`);
                console.log(`    TMT: ${t.tmt} (Type: ${typeof t.tmt})`);
                console.log(`    Unit: ${t.unitKerja}`);
            });
            
            // Try lenient search
            const search = "maslahul";
            console.log(`\n🔎 Lenient Search for '${search}'...`);
            const matches = teachers.filter(t => JSON.stringify(t).toLowerCase().includes(search));
            console.log(`Found ${matches.length} matches via JSON dump search.`);
            
            matches.forEach(m => {
                 console.log(`\n>>> MATCH FOUND:`);
                 console.log(m);
            });
            
        } else {
            console.error("❌ No teachers returned. DB might be empty or endpoint failed silently.");
        }

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

run();

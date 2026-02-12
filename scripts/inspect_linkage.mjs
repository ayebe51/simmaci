
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://uncommon-dachshund-623.convex.cloud");

// ID from User's Debug Alert (Headmaster Tenure ID)
const TENURE_ID = "jx79t573s6nbav3etsyw4peyc180z1q7"; 

console.log(`🔍 Inspecting Linkage for Tenure ID: ${TENURE_ID}...`);

async function run() {
    try {
        // 1. Fetch ALL Headmaster Tenures to find the specific one (Client verification limit workaround)
        // Note: In a real app we'd use .get(id), but here we trust list to include it.
        const tenures = await client.query("headmasters:list", {}); 
        let tenure = tenures.find(t => t._id === TENURE_ID || t.id === TENURE_ID);

        if (!tenure) {
            console.error("❌ Tenure ID NOT FOUND in headmasters:list (Public API might filter it?)");
            // Try matching by name as fallback
            tenure = tenures.find(t => t.teacher?.nama?.toLowerCase().includes("maslahul"));
            if (tenure) console.log("⚠️ Found via NAME matching instead:", tenure._id);
        }

        if (tenure) {
            console.log("\n✅ TENURE FOUND:");
            console.log("Tenure ID:", tenure._id);
            console.log("Linked Teacher ID:", tenure.teacherId);
            console.log("Teacher Name (in Tenure):", tenure.teacher?.nama);
            console.log("Teacher TMT (in Tenure):", tenure.teacher?.tmt);
            
            // 2. Fetch ALL Teachers to check for duplicates
            console.log("\n🔎 Searching ALL teachers named 'Maslahul'...");
            const teachers = await client.query("teachers:list", {});
            const matches = teachers.filter(t => t.nama && t.nama.toLowerCase().includes("maslahul"));

            console.log(`Found ${matches.length} matches:`);
            matches.forEach(m => {
                const isLinked = m._id === tenure.teacherId;
                console.log(`\n--------------------------------------------------`);
                console.log(`User: ${m.nama} ${isLinked ? " (👈 LINKED TO SK)" : ""}`);
                console.log(`ID: ${m._id}`);
                console.log(`TMT: "${m.tmt}"`); // Quote to see empty strings
                console.log(`NUPTK: ${m.nuptk}`);
                if (isLinked) {
                    console.log(`👉 THIS IS THE RECORD USED BY THE SYSTEM.`);
                    if (!m.tmt) console.log(`👉 AND IT HAS NO TMT!`);
                } else {
                     console.log(`👉 This record is NOT linked to the SK.`);
                     if (m.tmt) console.log(`👉 BUT IT HAS TMT! (Likely the one currently being edited)`);
                }
            });

        } else {
            console.log("❌ Cannot find tenure to inspect linkage.");
        }

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

run();

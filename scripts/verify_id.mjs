
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://uncommon-dachshund-623.convex.cloud");
const TEST_ID = "jx79t573s6nbav3etsyw4peyc180z1q7"; // ID from user screenshot

console.log(`🔍 Verifying Barcode Logic for ID: ${TEST_ID}...`);

async function run() {
    try {
        // Mocking the backend logic from verification.ts
        console.log("1. Simulating 'verifyByCode'...");
        
        // Step 1: Try Headmaster Tenures lookup (Simulated)
        const tenures = await client.query("headmasters:list", {}); 
        const target = tenures.find(t => t._id === TEST_ID || t.id === TEST_ID);

        if (target) {
            console.log("✅ FOUND Headmaster Tenure!");
            console.log("Status:", target.status);
            console.log("Teacher:", target.teacher?.nama);
            console.log("TMT (Available in API):", target.teacher?.tmt);
            
            if (!target.teacher?.tmt) {
                console.warn("⚠️ WARNING: Teacher TMT is NULL/Undefined in API response!");
            }
        } else {
            console.error("❌ ID NOT FOUND in headmasters:list");
        }

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

run();

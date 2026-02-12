
import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL);

async function testUpdate() {
    console.log("Testing Update on:", process.env.VITE_CONVEX_URL);
    
    // ID from screenshot: jh7egcag5t34z5v12zt1tdt16h80mv8p
    // Use a random ID if that one doesn't exist, but let's try to query first.
    // Actually, let's just use the ID from the screenshot if possible, or list one.
    
    // We can't easily get an ID without querying.
    // Let's list one teacher.
    
    // Note: We need to use `any` to bypass type checks for this raw test
    // mimicking the client's behavior.
    
    try {
        console.log("1. Fetching a teacher to update...");
        // valid token needed? list might be protected or filtered.
        // We'll try to update a fake ID first to see if we get "Invalid ID" or "Server Error".
        // If "Server Error", then it fails before ID check.
        
        const fakeId = "jh7egcag5t34z5v12zt1tdt16h80mv8p"; // From screenshot
        
        const payload = {
            id: fakeId,
            isCertified: true,
            kecamatan: "Gandrungmangu",
            mapel: "-",
            nama: "MASDUKI BAEHAKI, S.Pd.I",
            nuptk: "654231325",
            pdpkpnu: "Sudah",
            phoneNumber: "081235698789",
            status: "GTY",
            tanggallahir: "1978-02-21", // Legacy lower
            tempatlahir: "Cilacap", // Legacy lower
            tmt: "2004-07-16",
            token: "c4119541-4dda-41d9-ab4b-d14d4e996ff3", // From screenshot (likely expired, but format is valid)
            unitKerja: "MI Ma'arif Gandrungmanis"
        };
        
        console.log("2. Sending Payload:", JSON.stringify(payload, null, 2));
        
        await client.mutation("teachers:update", payload);
        console.log("✅ Update Success!");
        
    } catch (e) {
        console.error("❌ Update Failed!");
        console.error("Message:", e.message);
        console.error("Data:", e.data);
    }
}

testUpdate();

import { action } from "./_generated/server";
import { internal } from "./_generated/api";

export const runTest = action({
  args: {},
  handler: async (ctx) => {
    console.log("Running bulkCreate test...");
    
    // Mock Payload based on screenshot
    const payload = [
        {
            "Nama": "Muhtar",
            "Unit": "MI Al Ma'arif 01 Ciklapa",
            "TMT Raw": 39277,
            "TTL": "Cilacap, 1979-09-22",
            // Simulating extracted cols from screenshot
            "nama": "Muhtar",
            "unitKerja": "MI Al Ma'arif 01 Ciklapa",
            "nuptk": "00000000", // Dummy
            "tmt": "2007-07-13",
            "status": "GTY",
            "pdpkpnu": "Sudah"
        }
    ];

    try {
        // We can't call mutation directly from action easily without being authenticated as user.
        // BUT we can use `ctx.runMutation`.
        // However, `bulkCreate` checks `ctx.auth.getUserIdentity()`.
        // Since we run as admin/system, getUserIdentity is null.
        // My code throws "Unauthorized: Harap login terlebih dahulu." if !identity.
        
        // So this test MUST fail with "Unauthorized", NOT "Server Error".
        // If it fails with "Server Error", then the crash is BEFORE auth check or IN auth check.
        
        // @ts-ignore
        await ctx.runMutation(internal.teachers.bulkCreate, {
            teachers: payload
        });
        
        console.log("Success (Unexpected, should be Unauthorized)");
    } catch (err: any) {
        console.error("Caught Error:", err);
        console.error("Message:", err.message);
        console.error("Stack:", err.stack);
        if (err.data) console.error("Data:", err.data);
    }
  }
});

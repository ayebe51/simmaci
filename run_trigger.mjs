
import axios from 'axios';

// Ensure this matches the PROD environment 
const CONVEX_URL = "https://successful-bison-83.convex.cloud";

async function run() {
  console.log("Running Advanced User-School Sync (Fuzzy & ID-Based)...");
  try {
      const res = await axios.post(`${CONVEX_URL}/api/mutation`, {
          path: "fix_school_names:advancedSync", 
          args: {}
      });
      const json = res.data;
      if (json.status !== "success") {
          throw new Error(`Failed: ${json.errorMessage}`);
      }
      console.log("Sync Results:");
      // Limit output if too large
      const logs = json.value;
      if (logs.length > 50) {
          console.log(JSON.stringify(logs.slice(0, 50), null, 2));
          console.log(`... and ${logs.length - 50} more updates.`);
      } else {
          console.log(JSON.stringify(logs, null, 2));
      }
  } catch (e) {
      console.error("Error Details:", e.response ? e.response.data : e.message);
  }
}

run();

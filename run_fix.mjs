
import axios from 'axios';

const CONVEX_URL = "https://successful-bison-83.convex.cloud";

async function run() {
  console.log("Running Fix Mutation...");
  try {
      const res = await axios.post(`${CONVEX_URL}/api/mutation`, {
          path: "fix_data_integrity:runFix", 
          args: {}
      });
      const json = res.data;
      if (json.status !== "success") {
          throw new Error(`Failed: ${json.errorMessage}`);
      }
      console.log("Fix Results:");
      console.log(JSON.stringify(json.value, null, 2));
  } catch (e) {
      console.error(e.response ? e.response.data : e.message);
  }
}

run();

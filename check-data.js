
const { ConvexHttpClient } = require("convex/browser");
require("dotenv").config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL);

async function checkData() {
  console.log("Checking Teachers...");
  const teachers = await client.query("teachers:list", {}); // Assuming teachers:list calls db.query("teachers")
  console.log(`Total Teachers: ${teachers.length}`);
  if (teachers.length > 0) {
      console.log("Last 3 Teachers:");
      console.log(JSON.stringify(teachers.slice(-3), null, 2));
  }

  console.log("\nChecking SK Documents...");
  const sks = await client.query("sk:list", { jenisSk: "all" });
  console.log(`Total SK Documents: ${sks.length}`);
  if (sks.length > 0) {
      console.log("Last 3 SK Documents:");
      console.log(JSON.stringify(sks.slice(-3), null, 2));
  }
}

checkData().catch(console.error);

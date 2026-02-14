
const CONVEX_URL = "https://successful-bison-83.convex.cloud";

async function run() {
  console.log("Using URL:", CONVEX_URL);

  console.log("Running debug_school_check:checkCimanggu...");
  const res = await fetch(`${CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "debug_school_check:checkCimanggu", args: {} })
  });
  
  const json = await res.json();
  if (json.status !== "success") {
      console.error("Failed to run query:", json);
      return;
  }
  
  console.log("Debug Results:", JSON.stringify(json.value, null, 2));
}

run();


const CONVEX_URL = "https://successful-bison-83.convex.cloud";

async function main() {
  console.log("Checking recent teachers visibility...");
  
  try {
    const resp = await fetch(`${CONVEX_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            path: "debug_visibility:debugCheckHiddenTeachers",
            args: { limit: 10 },
            format: "json",
        }),
    });
    
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    console.log(JSON.stringify(data.value, null, 2));

  } catch (error) {
    console.error("Script Error:", error);
  }
}

main();

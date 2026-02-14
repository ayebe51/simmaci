
const CONVEX_URL = "https://successful-bison-83.convex.cloud";

async function run(path, args = {}) {
    const resp = await fetch(`${CONVEX_URL}/api/query`, { // Queries
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, args, format: "json" }),
    });
    const txt = await resp.text();
    try { return JSON.parse(txt); } catch { return txt; }
}

async function mutate(path, args = {}) {
    const resp = await fetch(`${CONVEX_URL}/api/mutation`, { // Mutations
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, args, format: "json" }),
    });
    const txt = await resp.text();
    try { return JSON.parse(txt); } catch { return txt; }
}

async function main() {
  console.log("1. Setup Test Teacher...");
  console.log(await mutate("debug_manual:setupTestTeacher"));

  console.log("2. Test Visibility...");
  console.log(await run("debug_manual:testVisibilityParams"));

  console.log("3. Cleanup...");
  console.log(await mutate("debug_manual:cleanupTestTeacher"));
}

main();

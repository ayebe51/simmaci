
// Hardcoded for reproduction
const CONVEX_URL = "https://successful-bison-83.convex.cloud";

async function main() {
  console.log("Listing all SKs to find a problematic one...");
  
  try {
    // 1. List all SKs
    const listResp = await fetch(`${CONVEX_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            path: "sk:list",
            args: {},
            format: "json",
        }),
    });
    
    if (!listResp.ok) throw new Error(await listResp.text());
    const sks = await listResp.json();
    console.log(`Found ${sks.value.length} SKs.`);

    // 2. Try to GET each one
    for (const sk of sks.value) {
        console.log(`Checking SK ${sk._id} (${sk.nomorSk})...`);
        const getResp = await fetch(`${CONVEX_URL}/api/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                path: "sk:get",
                args: { id: sk._id },
                format: "json",
            }),
        });

        if (!getResp.ok) {
            console.error(`❌ FAILED SK: ${sk._id}`);
            console.error(await getResp.text());
        } else {
            // console.log(`✅ OK SK: ${sk._id}`);
        }
    }
    
  } catch (error) {
    console.error("Script Error:", error);
  }
}

main();


const DEPLOYMENTS = [
  { name: "[BISON] successful-bison-83", url: "https://successful-bison-83.convex.cloud" },
  { name: "[DACHSHUND] uncommon-dachshund-623", url: "https://uncommon-dachshund-623.convex.cloud" }
];

async function ping(dep) {
    try {
        console.log(`\n🔍 Checking ${dep.name}...`);
        
        // Try debug inspect - this one I control and deployed to Bison
        const resp = await fetch(`${dep.url}/api/query`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                path: "debug_inspect:inspect",
                args: {}
            })
        });

        if (!resp.ok) {
            console.error(`❌ ${dep.name}: HTTP ${resp.status}`, await resp.text());
            return;
        }

        const data = await resp.json();
        const items = data.value || []; 

        if (items.length > 0) {
            console.log(`✅ ${dep.name}: FOUND ${items.length} Headmaster Records!`);
            items.forEach(h => {
                console.log(`   - ID: ${h._id} | School: ${h.school?.nama} | TMT: ${h.tmt}`);
            });
        } else {
             console.log(`⚠️ ${dep.name}: Database seems EMPTY (0 records returned).`);
        }

    } catch (e) {
        console.error(`❌ ${dep.name}: Connection Failed`, e.message);
    }
}

async function run() {
    for (const d of DEPLOYMENTS) {
        await ping(d);
    }
}

run();

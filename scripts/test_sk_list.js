
import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function main() {
  console.log("Testing sk:list with basic args...");
  try {
    const result = await client.query("sk:list", {
      paginationOpts: {
        numItems: 5,
        cursor: null,
      },
      status: "all",
      jenisSk: "all"
    });
    console.log("Success:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("FAILED sk:list:");
    console.error(error);
  }
}

main();

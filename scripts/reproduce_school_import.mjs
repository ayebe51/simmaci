
import { ConvexClient } from "convex/browser";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new ConvexClient(process.env.VITE_CONVEX_URL);

async function main() {
  console.log("Testing schools:bulkCreate...");

  const schools = [
    {
      nsm: "1234567890",
      nama: "Madrasah Test Import",
      npsn: "98765432",
      alamat: "Jl. Test No. 1",
      kecamatan: "Cilacap Selatan",
      telepon: "08123456789",
      email: "test@maarif.nu",
      kepalaMadrasah: "Bapak Test",
      akreditasi: "A",
      statusJamiyyah: "Maarif",
    },
    {
      nsm: "1234567891", // New NSM
      nama: "Madrasah Test Import 2",
      // Missing optional fields (undefined in JS)
    }
  ];

  try {
    const result = await client.mutation("schools:bulkCreate", { schools });
    console.log("Success:", result);
  } catch (error) {
    console.error("FAIL:", error);
    if (error.data) console.error("Error Data:", error.data);
  }
}

main().catch(console.error);

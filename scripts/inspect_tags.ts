import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
import JSZip from "jszip";

dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL);

async function checkTags() {
    const templates = ["sk_template_tendik", "sk_template_gty", "sk_template_gtt", "sk_template_kamad_pns", "sk_template_kamad_nonpns", "sk_template_kamad_plt"];
    for (const t of templates) {
        try {
            const dataBase64 = await client.query("settings_cloud:getContent", { key: t });
            if (!dataBase64) {
                console.log(`Template ${t} not found`);
                continue;
            }
            const block = dataBase64.split(";base64,");
            const realData = block[1] ? block[1] : dataBase64;
            const content = Buffer.from(realData, 'base64');
            
            const zip = await JSZip.loadAsync(content);
            const xml = await zip.file("word/document.xml")?.async("string");
            
            if (!xml) continue;

            const tags = xml.match(/{([^{}]+)}/g) || [];
            const mergeTags = xml.match(/«([^«»]+)»/g) || [];
            
            // Clean XML tags inside docxtemplater tags
            const cleanTags = tags.map(t => t.replace(/<[^>]+>/g, ''));
            const cleanMerge = mergeTags.map(t => t.replace(/<[^>]+>/g, ''));
            
            console.log(`\n--- Tags in ${t} ---`);
            console.log(Array.from(new Set([...cleanTags, ...cleanMerge])).join(",\\n"));
        } catch (e) {
            console.log(`Error reading ${t}:`, e.message);
        }
    }
}
checkTags();

import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import ImageModule from "docxtemplater-image-module-free"
import QRCode from "qrcode"
import { saveAs } from "file-saver"

// Helper: Convert Base64 DataURL to ArrayBuffer
function base64DataURLToArrayBuffer(dataURL: string) {
  const base64Regex = /^data:image\/(png|jpg|svg|svg\+xml);base64,/;
  if (!base64Regex.test(dataURL)) {
    return false;
  }
  const stringBase64 = dataURL.replace(base64Regex, "");
  let binaryString;
  if (typeof window !== "undefined") {
    binaryString = window.atob(stringBase64);
  } else {
    binaryString = new Buffer(stringBase64, "base64").toString("binary");
  }
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const ascii = binaryString.charCodeAt(i);
    bytes[i] = ascii;
  }
  return bytes.buffer;
}

// Helper to load base64 template
export const loadTemplate = (key: string): string | null => {
    const base64 = localStorage.getItem(key + "_blob")
    if (!base64) return null
    // Remove header if present
    const block = base64.split(";base64,");
    const realData = block[1] ? block[1] : (btoa(atob(base64)) === base64 ? base64 : null);
    if (!realData) return null
    return atob(realData)
}

// Logic to choose template based on SK Data
export const getTemplateId = (data: any) => {
    const jenis = (data.jenisSk || data.status || "").toLowerCase()
    const jabatan = (data.jabatan || "").toLowerCase()
    const nip = (data.nip || "").replace(/[^0-9]/g, "")

    if (jenis.includes("tetap yayasan") || jenis.includes("gty")) return "sk_template_gty"
    if (jenis.includes("tidak tetap") || jenis.includes("gtt")) return "sk_template_gtt"
    
    // Kamad Logic
    if (jenis.includes("kepala") || jenis.includes("kamad")) {
         if (jabatan.includes("plt") || jabatan.includes("pelaksana")) {
             return "sk_template_kamad_plt"
         }
         const isPns = nip.length > 10 || (data.statusKepegawaian || "").includes("PNS") || (data.statusKepegawaian || "").includes("ASN")
         if (isPns) return "sk_template_kamad_pns"
         return "sk_template_kamad_nonpns"
    }
    
    return "sk_template_tendik" // Default
}

// Main Function: Generate Single SK Docx
export const generateSingleSkDocx = async (skData: any, overridesContent?: any) => {
    try {
        // 1. Determine Template
        const templateId = getTemplateId(skData)
        
        // Use override if provided (ArrayBuffer or String), else load from LocalStorage
        const content = overridesContent || loadTemplate(templateId) || loadTemplate("sk_template_tendik")
        
        if (!content) {
            throw new Error(`Template tidak ditemukan (ID: ${templateId}). Pastikan sudah upload di Settings.`)
        }

        // 2. Generate QR Code
        // Use _id for verification URL, fallback to nomorSk
        const docId = skData.id || skData._id || skData.nomorSk || "INVALID";
        const verificationUrl = `${window.location.origin}/verify/${docId}`;
        const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 400, margin: 1 });

        // 3. Prepare Data (Map keys to Uppercase as preferred by templates)
        // Similar mapping logic to SkGeneratorPage
        const t = skData
        const renderData = {
             ...t,
             qrcode: qrDataUrl,
             
             // Uppercase Standard Keys
             NAMA: t.nama,
             JABATAN: t.jabatan,
             UNIT_KERJA: t.unitKerja,
             NOMOR_SURAT: t.nomorSurat || t.nomorSk || "-",
             
             // Additional Mapping if needed (keeping it simple for now as MySkPage data is already processed)
             // If MySkPage passes raw SkDocument, we might need more mapping.
             // Usually templates use {NAMA}, {JABATAN}, {UNIT_KERJA}, {NOMOR_SURAT}
        }

        // 4. Setup Docxtemplater
        const zip = new PizZip(content);
        const imageOpts = {
            getImage: function (tagValue: string) { return base64DataURLToArrayBuffer(tagValue); },
            getSize: function (img: any, tagValue: string, tagName: string) {
                if (tagName === "qrcode") return [100, 100];
                return [100, 100];
            },
        };
        const imageModule = new ImageModule(imageOpts);

        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            modules: [imageModule],
            nullGetter: () => ""
        });

        // 5. Render
        doc.render(renderData);

        // 6. Generate Blob
        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        // 7. Save
        const filename = `SK_${t.nama.replace(/[^a-zA-Z0-9]/g, '_')}.docx`
        saveAs(out, filename)
        
        return true

    } catch (error: any) {
        console.error("Generate Error", error)
        throw error
    }
}

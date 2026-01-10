import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * Generates a DOCX Blob from a Base64 template and data.
 * @param base64Template The base64 string of the .docx template
 * @param data Key-value pairs to replace in the template
 * @returns Blob of the generated document
 */
export const generateSkDocx = (base64Template: string, data: Record<string, any>): Blob => {
    try {
        // 1. Clean Base64 (remove data:application/vnd... prefix if exists)
        const cleanBase64 = base64Template.replace(/^data:.*;base64,/, "");
        
        // 2. Decode Base64 to Binary
        const binaryString = window.atob(cleanBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // 3. Load Zip
        const zip = new PizZip(bytes.buffer);

        // 4. Load Template
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => "" // Replace undefined/null with empty string
        });

        // 5. Render Data
        doc.render(data);

        // 6. Generate Blob
        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        return out;
    } catch (error) {
        console.error("Error generating DOCX:", error);
        throw new Error("Gagal memproses template Word. Pastikan file template valid (.docx).");
    }
};

/**
 * Helper to identify placeholder keys from data
 */
export const SK_PLACEHOLDERS = [
    "NAMA", "NIP", "JABATAN", "UNIT_KERJA", "STATUS", 
    "TTL", "PENDIDIKAN", "KETUA_NAMA", "SEKRETARIS_NAMA",
    "NOMOR_SK", "MASA_BHAKTI", "TMT", "TGL_SK"
];

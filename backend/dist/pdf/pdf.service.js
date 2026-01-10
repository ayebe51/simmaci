var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PdfService_1;
import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
let PdfService = PdfService_1 = class PdfService {
    logger = new Logger(PdfService_1.name);
    async createPdfStream(data) {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            this.generateHeader(doc);
            this.generateTitle(doc, data);
            this.generateBody(doc, data);
            await this.generateFooter(doc, data);
            doc.end();
            return doc;
        }
        catch (error) {
            this.logger.error('Error generating PDF', error);
            throw error;
        }
    }
    generateHeader(doc) {
        doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .text("LEMBAGA PENDIDIKAN MA'ARIF NU CILACAP", { align: 'center' });
        doc
            .fontSize(12)
            .text('BADAN HUKUM PERKUMPULAN NAHDLATUL ULAMA', { align: 'center' });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
    }
    generateTitle(doc, data) {
        doc
            .fontSize(16)
            .text('SURAT KEPUTUSAN', { align: 'center', underline: true });
        doc
            .fontSize(12)
            .text(`Nomor: ${data.nomor || '___/SK/___/VI/2024'}`, { align: 'center' });
        doc.moveDown(2);
    }
    generateBody(doc, data) {
        doc
            .fontSize(12)
            .font('Helvetica')
            .text(`Menetapkan Saudara/i: ${data.nama || '......................'}`, {
            align: 'left',
        });
        doc.text(`Sebagai: ${data.jabatan || 'Guru Tetap Yayasan'}`, {
            align: 'left',
        });
        doc.moveDown();
        doc.text("Diberikan hak dan kewajiban sebagaimana mestinya sesuai peraturan yang berlaku di lingkungan Lembaga Pendidikan Ma'arif NU Cilacap.", {
            align: 'justify'
        });
    }
    async generateFooter(doc, data) {
        const bottomY = doc.page.height - 200;
        const rightX = 350;
        doc.text('Ditetapkan di: Cilacap', rightX, bottomY);
        doc.text(`Pada Tanggal: ${new Date().toLocaleDateString('id-ID')}`, rightX, bottomY + 15);
        doc.moveDown();
        doc.moveDown();
        doc.text('Ketua Yayasan', rightX, doc.y + 10);
        const sigY = doc.y + 30;
        if (data.useQrValidation) {
            try {
                const validationUrl = `https://simmaci.nu/verifikasi-digital?sk=${encodeURIComponent(data.nomor || 'DRAFT')}&signer=KETUA_YAYASAN&uid=${Math.random().toString(36).substring(7)}`;
                const qrBuffer = await QRCode.toBuffer(validationUrl);
                doc.image(qrBuffer, rightX + 10, sigY - 10, { width: 80 });
                doc.fontSize(8).text(`Digital Signature: ${validationUrl}`, 50, bottomY + 105, { width: 150 });
                doc.fontSize(12);
            }
            catch (e) {
                this.logger.error("Failed to generate QR", e);
            }
        }
        doc.font('Helvetica-Bold');
        doc.text('(                                          )', rightX, sigY + 80);
        doc.text('H. MUNIR NAHIR, M.Pd.I', rightX + 20, sigY + 85);
    }
    async createCertificateStream(competition, participant, result) {
        const doc = new PDFDocument({ size: 'A4', margin: 50, layout: 'landscape' });
        doc.lineWidth(2).rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();
        doc.fontSize(24).font('Helvetica-Bold').text('SERTIFIKAT PENGHARGAAN', { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).font('Helvetica').text('Diberikan kepada:', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(28).font('Helvetica-Bold').text(participant.name, { align: 'center' });
        doc.fontSize(14).font('Helvetica').text(participant.institution || '', { align: 'center' });
        doc.moveDown(1.5);
        doc.fontSize(16).text('Atas partisipasinya sebagai', { align: 'center' });
        doc.fontSize(20).font('Helvetica-Bold').text(result?.rank ? `JUARA ${result.rank}` : 'PESERTA', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).font('Helvetica').text(`Dalam kejuaraan ${competition.name}`, { align: 'center' });
        if (competition.event) {
            doc.fontSize(14).text(`Event: ${competition.event.name}`, { align: 'center' });
        }
        doc.fontSize(14).text(`Kategori: ${competition.category}`, { align: 'center' });
        doc.text(new Date(competition.date).toLocaleDateString('id-ID', { dateStyle: 'full' }), { align: 'center' });
        doc.end();
        return doc;
    }
    async generateSkKepala(tenure) {
        return new Promise((resolve, reject) => {
            console.log("DEBUG: Starting PDF Generation...");
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 50 });
                const buffers = [];
                doc.on('data', (chunk) => buffers.push(chunk));
                doc.on('end', () => {
                    console.log("DEBUG: PDF Stream Ended. Total buffers:", buffers.length);
                    resolve(Buffer.concat(buffers));
                });
                doc.on('error', (err) => {
                    console.error("DEBUG: PDF Stream Error:", err);
                    reject(err);
                });
                const formatDate = (date) => {
                    try {
                        if (!date)
                            return '...';
                        return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                    }
                    catch {
                        return '...';
                    }
                };
                this.generateHeader(doc);
                doc.moveDown();
                doc.font('Helvetica-Bold').fontSize(14).text('SURAT KEPUTUSAN', { align: 'center', underline: true });
                doc.fontSize(12).text(`Nomor: ${tenure.nomorSk || '...../SK/...../...../....'}`, { align: 'center' });
                doc.moveDown();
                doc.font('Helvetica').fontSize(12);
                doc.text('Menimbang:', { continued: true }).text('   a. Bahwa demi kelancaran proses belajar mengajar di lingkungan madrasah perlu ditetapkan Kepala Madrasah;', { indent: 20 });
                doc.text('', { indent: 83 }).text('b. Bahwa saudara tersebut dipandang cakap dan mampu serta memenuhi syarat untuk diangkat sebagai Kepala Madrasah;', { indent: 20 });
                doc.moveDown();
                doc.text('Mengingat:', { continued: true }).text('    1. AD/ART Lembaga Pendidikan Ma\'arif NU;', { indent: 25 });
                doc.text('', { indent: 89 }).text('2. Peraturan-peraturan yang berlaku dilingkungan LP Ma\'arif NU;', { indent: 25 });
                doc.moveDown();
                doc.font('Helvetica-Bold').text('MEMUTUSKAN', { align: 'center' });
                doc.moveDown();
                doc.font('Helvetica').text('Menetapkan:', { continued: true }).text('   1. Mengangkat Saudara:', { indent: 20 });
                const rightX = 200;
                const startY = doc.y;
                doc.text(`Nama`, 100, doc.y + 10);
                doc.text(`: ${tenure.teacher?.nama || '...'}`, rightX, doc.y - 12);
                doc.text(`NUPTK/PegID`, 100, doc.y + 5);
                doc.text(`: ${tenure.teacher?.nuptk || '-'}`, rightX, doc.y - 12);
                doc.text(`Tempat, Tgl Lahir`, 100, doc.y + 5);
                const ttl = `${tenure.teacher?.birthPlace || '...'}, ${tenure.teacher?.birthDate || '...'}`;
                doc.text(`: ${ttl}`, rightX, doc.y - 12);
                doc.moveDown();
                doc.text(`Sebagai Kepala Madrasah: ${tenure.school?.nama || '...'}`, 100, doc.y + 20);
                const tmtDate = formatDate(tenure.tmt);
                const endDate = formatDate(tenure.endDate);
                doc.text(`Masa Bhakti: ${tmtDate} s/d ${endDate} (Periode ke-${tenure.periode || '1'})`, 100, doc.y + 5);
                doc.moveDown(2);
                doc.text('Keputusan ini berlalu sejak tanggal ditetapkan, dan apabila terdapat kekeliruan akan diperbaiki sebagaimana mestinya.', { align: 'justify' });
                const bottomY = doc.y + 50;
                const footerX = 350;
                doc.text(`Ditetapkan di: Cilacap`, footerX, bottomY);
                doc.text(`Pada Tanggal: ${formatDate(new Date())}`, footerX, bottomY + 15);
                doc.text('Ketua Yayasan', footerX, bottomY + 40);
                doc.text('(                                          )', footerX, bottomY + 100);
                doc.text('H. MUNIR NAHIR, M.Pd.I', footerX + 20, bottomY + 105, { underline: true });
                doc.end();
            }
            catch (e) {
                reject(e);
            }
        });
    }
};
PdfService = PdfService_1 = __decorate([
    Injectable()
], PdfService);
export { PdfService };
//# sourceMappingURL=pdf.service.js.map
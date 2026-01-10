export declare class PdfService {
    private readonly logger;
    createPdfStream(data: SkDataDto): Promise<PDFKit.PDFDocument>;
    private generateHeader;
    private generateTitle;
    private generateBody;
    private generateFooter;
    createCertificateStream(competition: any, participant: any, result: any): Promise<PDFKit.PDFDocument>;
    generateSkKepala(tenure: any): Promise<Buffer>;
}
export interface SkDataDto {
    nomor?: string;
    nama?: string;
    jabatan?: string;
    useQrValidation?: boolean;
}

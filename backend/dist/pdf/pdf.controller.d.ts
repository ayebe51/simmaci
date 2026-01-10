import { PdfService } from './pdf.service';
import type { Response } from 'express';
export declare class PdfController {
    private readonly pdfService;
    constructor(pdfService: PdfService);
    generateSk(data: any, res: Response): Promise<void>;
}

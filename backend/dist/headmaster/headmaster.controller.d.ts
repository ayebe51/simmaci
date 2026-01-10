import { HeadmasterService } from './headmaster.service';
import { PdfService } from '../pdf/pdf.service';
import type { Response } from 'express';
export declare class HeadmasterController {
    private readonly service;
    private readonly pdfService;
    constructor(service: HeadmasterService, pdfService: PdfService);
    create(data: any, req: any): any;
    findAll(): any;
    ping(): string;
    downloadPdf(id: string, res: Response): Promise<void>;
    verifyPublic(id: string): Promise<any>;
    verify(id: string): any;
    approve(id: string, body: {
        signatureUrl?: string;
        skUrl?: string;
    }): any;
    reject(id: string, body: {
        reason: string;
    }): any;
}

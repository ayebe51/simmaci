import { Controller, Post, Body, Res, Header } from '@nestjs/common';
import { PdfService } from './pdf.service';
import type { Response } from 'express';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('generate/sk')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=surat_keputusan.pdf')
  async generateSk(@Body() data: any, @Res() res: Response) {
    const doc = await this.pdfService.createPdfStream(data);
    doc.pipe(res as any);
  }
}

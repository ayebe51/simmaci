import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, Res, NotFoundException } from '@nestjs/common';
import { HeadmasterService } from './headmaster.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PdfService } from '../pdf/pdf.service';
import type { Response } from 'express';

@Controller('headmaster')
@UseGuards(JwtAuthGuard)
export class HeadmasterController {
  constructor(
      private readonly service: HeadmasterService,
      private readonly pdfService: PdfService
  ) {}

  @Post()
  create(@Body() data: any, @Request() req: any) {
    return this.service.create(data, req.user);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('ping')
  ping() {
      return "pong";
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    console.log("DEBUG: downloadPdf called with ID:", id);
    const tenure = await this.service.findOne(id);
    if (!tenure) {
        console.log("DEBUG: Tenure not found for ID:", id);
        throw new NotFoundException(`Data SK tidak ditemukan (${id})`);
    }

    try {
        console.log("DEBUG: Generating PDF for Tenure:", tenure.id);
        const buffer = await this.pdfService.generateSkKepala(tenure);
        console.log("DEBUG: PDF Generated successfully. Size:", buffer.length);

        const safeName = (tenure.teacher?.nama || 'Madrasah').replace(/[^a-zA-Z0-9]/g, '_');
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=SK_Kepala_${safeName}.pdf`,
          'Content-Length': buffer.length.toString(),
        });

        res.send(buffer);
    } catch (e: any) {
        console.error("PDF Fail:", e);
        res.status(500).json({ message: "Gagal generate PDF", error: e.message });
    }
  }

  @Get(':id/public-verify')
  async verifyPublic(@Param('id') id: string) {
      const result = await this.service.verifyPublic(id);
      if (!result) throw new NotFoundException('Data tidak ditemukan');
      return result;
  }

  @Patch(':id/verify')
  verify(@Param('id') id: string) {
    return this.service.verify(id);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() body: { signatureUrl?: string, skUrl?: string }) {
    return this.service.approve(id, body?.signatureUrl, body?.skUrl);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.service.reject(id, body.reason);
  }
}

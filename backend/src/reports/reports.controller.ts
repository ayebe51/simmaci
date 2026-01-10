import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('teacher-summary')
  async getTeacherSummary(
    @Query('unitKerja') unitKerja?: string,
    @Query('kecamatan') kecamatan?: string,
  ) {
    return this.reportsService.getTeacherSummary(unitKerja, kecamatan);
  }

  @Get('sk-summary')
  async getSKSummary(
    @Query('unitKerja') unitKerja?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSKSummary(unitKerja, startDate, endDate);
  }

  @Get('monthly-stats')
  async getMonthlyStats(@Query('year') year?: string) {
    return this.reportsService.getMonthlyStats(year);
  }
}

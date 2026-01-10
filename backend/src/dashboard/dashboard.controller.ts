import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(@Request() req: any) {
    return this.dashboardService.getStats(req.user);
  }

  // Phase 4: Manual cache clear endpoint
  @Post('clear-cache')
  clearCache() {
    this.dashboardService.clearCache();
    return { message: 'Dashboard cache cleared successfully' };
  }
}

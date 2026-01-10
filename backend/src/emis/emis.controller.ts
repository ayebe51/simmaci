import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { EmisService } from './emis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('emis')
export class EmisController {
  constructor(private readonly emisService: EmisService) {}

  @Post('import')
  @UseGuards(JwtAuthGuard)
  async import(@Body() data: any[], @Request() req: any) {
    return this.emisService.importStudents(data, req.user);
  }
}

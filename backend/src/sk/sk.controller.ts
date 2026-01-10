import { Controller, Get, Post, Put, Delete, Body, UseGuards, Request, Param, NotFoundException } from '@nestjs/common';
import { SkService } from './sk.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Sk } from './entities/sk.entity';

@Controller('sk')
@UseGuards(JwtAuthGuard)
export class SkController {
  constructor(private readonly skService: SkService) {}

  @Post()
  create(@Body() data: Partial<Sk>, @Request() req: any) {
    return this.skService.create(data, req.user);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.skService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.skService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Partial<Sk>) {
    return this.skService.update(id, data);
  }

  @Post('delete-all')
  deleteAll() {
    return this.skService.deleteAll();
  }
}

// Public verification endpoint (no auth required)
@Controller('sk')
export class SkPublicController {
  constructor(private readonly skService: SkService) {}

  @Get('verify/:id')
  async verifyPublic(@Param('id') id: string) {
    const result = await this.skService.verifyPublic(id);
    if (!result) {
      throw new NotFoundException('Data tidak ditemukan');
    }
    return result;
  }
}

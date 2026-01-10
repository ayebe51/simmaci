import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RagService } from './services/rag.service';

class AiQueryDto {
  @IsString()
  question: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private ragService: RagService) {}

  @Post('query')
  async naturalLanguageQuery(@Body() dto: AiQueryDto) {
    return this.ragService.query(dto.question);
  }

  @Get('suggested-questions')
  getSuggestedQuestions() {
    return {
      questions: [
        'Berapa jumlah guru yang belum sertifikasi?',
        'Tampilkan SK yang menunggu approval',
        'Siapa kepala madrasah yang masa jabatannya akan habis tahun ini?',
        'Berapa guru honorer di setiap kecamatan?',
        'SK apa saja yang diajukan bulan ini?',
      ],
    };
  }
}

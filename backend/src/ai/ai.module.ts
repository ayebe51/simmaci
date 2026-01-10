import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { GeminiService } from './services/gemini.service';
import { RagService } from './services/rag.service';

@Module({
  controllers: [AiController],
  providers: [GeminiService, RagService],
  exports: [GeminiService, RagService],
})
export class AiModule {}

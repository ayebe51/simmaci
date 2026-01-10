import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event } from './entities/event.entity';
import { Participant } from './entities/participant.entity';
import { Result } from './entities/result.entity';
import { Competition } from './entities/competition.entity';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Participant, Result, Competition]), PdfModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}

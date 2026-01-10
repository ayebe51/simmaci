var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event } from './entities/event.entity';
import { Participant } from './entities/participant.entity';
import { Result } from './entities/result.entity';
import { Competition } from './entities/competition.entity';
import { PdfModule } from '../pdf/pdf.module';
let EventsModule = class EventsModule {
};
EventsModule = __decorate([
    Module({
        imports: [TypeOrmModule.forFeature([Event, Participant, Result, Competition]), PdfModule],
        controllers: [EventsController],
        providers: [EventsService],
    })
], EventsModule);
export { EventsModule };
//# sourceMappingURL=events.module.js.map
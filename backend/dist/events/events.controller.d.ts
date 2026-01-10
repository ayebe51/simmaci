import * as express from 'express';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto } from './dto/create-event.dto';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { RegisterParticipantDto } from './dto/register-participant.dto';
import { InputResultDto } from './dto/input-result.dto';
export declare class EventsController {
    private readonly eventsService;
    constructor(eventsService: EventsService);
    create(createEventDto: CreateEventDto): any;
    findAll(): any;
    findOne(id: string): any;
    update(id: string, updateEventDto: UpdateEventDto): any;
    remove(id: string): any;
    createCompetition(id: string, createCompetitionDto: CreateCompetitionDto): any;
    findCompetition(id: string): any;
    removeCompetition(id: string): any;
    registerParticipant(id: string, dto: RegisterParticipantDto): any;
    removeParticipant(participantId: string): any;
    inputResult(id: string, dto: InputResultDto): any;
    getMedalTally(id: string): any;
    uploadTemplate(id: string, file: Express.Multer.File): Promise<any>;
    importResults(id: string, file: Express.Multer.File): Promise<any>;
    downloadCertificate(competitionId: string, participantId: string, res: express.Response): Promise<void>;
}

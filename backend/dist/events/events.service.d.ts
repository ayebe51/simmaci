import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { Competition } from './entities/competition.entity';
import { Participant } from './entities/participant.entity';
import { Result } from './entities/result.entity';
import { CreateEventDto, UpdateEventDto } from './dto/create-event.dto';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { RegisterParticipantDto } from './dto/register-participant.dto';
import { InputResultDto } from './dto/input-result.dto';
import { PdfService } from '../pdf/pdf.service';
export declare class EventsService {
    private readonly eventRepository;
    private readonly competitionRepository;
    private readonly participantRepository;
    private readonly resultRepository;
    private readonly pdfService;
    constructor(eventRepository: Repository<Event>, competitionRepository: Repository<Competition>, participantRepository: Repository<Participant>, resultRepository: Repository<Result>, pdfService: PdfService);
    create(createEventDto: CreateEventDto): Promise<Event>;
    findAll(): Promise<Event[]>;
    findOne(id: string): Promise<Event>;
    update(id: string, updateEventDto: UpdateEventDto): Promise<Event>;
    remove(id: string): Promise<void>;
    createCompetition(eventId: string, dto: CreateCompetitionDto): Promise<Competition>;
    findCompetition(id: string): Promise<Competition>;
    removeCompetition(id: string): Promise<void>;
    registerParticipant(competitionId: string, dto: RegisterParticipantDto): Promise<Participant>;
    removeParticipant(id: string): Promise<void>;
    inputResult(competitionId: string, dto: InputResultDto): Promise<Result>;
    generateCertificate(competitionId: string, participantId: string): Promise<PDFKit.PDFDocument>;
    getMedalTally(eventId: string): Promise<{
        gold: number;
        silver: number;
        bronze: number;
        total: number;
        institution: string;
    }[]>;
    importResults(competitionId: string, fileBuffer: Buffer): Promise<Result[]>;
    uploadTemplate(competitionId: string, filename: string): Promise<any>;
}

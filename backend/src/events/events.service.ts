import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Competition)
    private readonly competitionRepository: Repository<Competition>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    @InjectRepository(Result)
    private readonly resultRepository: Repository<Result>,
    private readonly pdfService: PdfService,
  ) {}

  // Event CRUD
  async create(createEventDto: CreateEventDto): Promise<Event> {
    const event = this.eventRepository.create(createEventDto);
    return this.eventRepository.save(event);
  }

  async findAll(): Promise<Event[]> {
    return this.eventRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['competitions'],
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    this.eventRepository.merge(event, updateEventDto);
    return this.eventRepository.save(event);
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepository.remove(event);
  }

  // Competition CRUD
  async createCompetition(eventId: string, dto: CreateCompetitionDto): Promise<Competition> {
    const event = await this.findOne(eventId);
    const competition = this.competitionRepository.create({
      ...dto,
      event,
    });
    return this.competitionRepository.save(competition);
  }

  async findCompetition(id: string): Promise<Competition> {
      const competition = await this.competitionRepository.findOne({
          where: { id },
          relations: ['participants', 'results', 'results.participant', 'event'],
      });
      if (!competition) throw new NotFoundException(`Competition with ID ${id} not found`);
      return competition;
  }

  async removeCompetition(id: string): Promise<void> {
      const comp = await this.findCompetition(id);
      await this.competitionRepository.remove(comp);
  }

  // Participant Management
  async registerParticipant(competitionId: string, dto: RegisterParticipantDto): Promise<Participant> {
    const competition = await this.findCompetition(competitionId);
    const participant = this.participantRepository.create({
      ...dto,
      competition,
    });
    return this.participantRepository.save(participant);
  }

  async removeParticipant(id: string): Promise<void> {
      const participant = await this.participantRepository.findOne({ where: { id } });
      if(!participant) throw new NotFoundException('Participant not found');
      await this.participantRepository.remove(participant);
  }

  // Result Management
  // Result Management
  async inputResult(competitionId: string, dto: InputResultDto): Promise<Result> {
    const competition = await this.findCompetition(competitionId);
    const participant = await this.participantRepository.findOne({ where: { id: dto.participantId } });

    if (!participant) {
      throw new NotFoundException(`Participant with ID ${dto.participantId} not found`);
    }

    // Check if result exists
    let result = await this.resultRepository.findOne({
      where: { competition: { id: competitionId }, participant: { id: dto.participantId } },
    });

    if (result) {
      // Update existing
      result.score = dto.score ?? result.score;
      result.rank = dto.rank ?? result.rank;
      result.notes = dto.notes ?? result.notes;
    } else {
      // Create new
      result = this.resultRepository.create({
        competition,
        participant,
        score: dto.score,
        rank: dto.rank,
        notes: dto.notes,
      });
    }

    return this.resultRepository.save(result);
  }

  async generateCertificate(competitionId: string, participantId: string): Promise<PDFKit.PDFDocument> {
    const competition = await this.findCompetition(competitionId);
    const participant = await this.participantRepository.findOne({ where: { id: participantId } });
    if (!participant) throw new NotFoundException('Participant not found');
    
    const result = await this.resultRepository.findOne({ where: { competition: { id: competitionId }, participant: { id: participantId } } });
    
    // We pass the full competition object (which includes the 'event' relation)
    return this.pdfService.createCertificateStream(competition, participant, result);
  }
  async getMedalTally(eventId: string) {
    const competitions = await this.competitionRepository.find({
      where: { event: { id: eventId } },
      relations: ['results', 'results.participant'],
    });

    console.log(`[MedalTally] Event ${eventId} - Found ${competitions.length} competitions`);

    const tallyMap = new Map<string, { gold: number; silver: number; bronze: number; total: number }>();

    for (const comp of competitions) {
      console.log(`[MedalTally] Comp ${comp.name} - Results: ${comp.results?.length}`);
      for (const res of comp.results) {
        console.log(`[MedalTally] Result: Rank=${res.rank}, Participant=${res.participant?.name}, Institution=${res.participant?.institution}`);
        if (!res.participant || !res.rank) continue;
        
        const institution = res.participant.institution || 'Tanpa Lembaga';
        if (!tallyMap.has(institution)) {
          tallyMap.set(institution, { gold: 0, silver: 0, bronze: 0, total: 0 });
        }
        
        const entry = tallyMap.get(institution)!;
        // Ensure rank is a number
        const rank = Number(res.rank);
        
        if (isNaN(rank) || rank <= 0) continue;

        if (rank === 1) entry.gold++;
        else if (rank === 2) entry.silver++;
        else if (rank === 3) entry.bronze++;
        
        if (rank >= 1 && rank <= 3) entry.total++;
      }
    }

    // Convert to array and sort
    const tally = Array.from(tallyMap.entries()).map(([institution, counts]) => ({
      institution,
      ...counts
    }));

    // Sort: Gold DESC, Silver DESC, Bronze DESC
    tally.sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      return b.bronze - a.bronze;
    });

    return tally;
  }

  async importResults(competitionId: string, fileBuffer: Buffer) {
     
    const XLSX = require('xlsx');
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const results: Result[] = [];
    
    // Pre-fetch all participants for this competition to minimize DB queries
    const existingParticipants = await this.participantRepository.find({ where: { competition: { id: competitionId } } });
    
    for (const row of data as any[]) {
      // Expected Columns: Juara (Rank), Nama, Lembaga (School), Nilai (Score)
      const rank = row['Juara'] || row['Rank'] ? Number(row['Juara'] || row['Rank']) : undefined;
      const name = row['Nama'] || row['Name'];
      
      if (!name) continue;

      // Find participant (case insensitive match)
      let participant = existingParticipants.find(p => p.name.toLowerCase() === String(name).toLowerCase());

      if (!participant) {
        // Create new participant if strictly necessary, OR we could skip.
        // For flexibility, let's create a new one.
        participant = this.participantRepository.create({
          competition: { id: competitionId },
          name: String(name),
          institution: row['Lembaga'] || row['Sekolah'] || row['Institution'] || '-',
        });
        await this.participantRepository.save(participant);
        existingParticipants.push(participant); // Add to cache
      }

      // Upsert Result
      let result = await this.resultRepository.findOne({ 
          where: { competition: { id: competitionId }, participant: { id: participant.id } }
      });

      if (!result) {
        result = this.resultRepository.create({
           competition: { id: competitionId },
           participant: { id: participant.id }
        });
      }

      const scoreVal = row['Nilai'] || row['Score'];

      result.rank = rank;
      result.score = scoreVal ? parseFloat(scoreVal) : undefined;
      
      await this.resultRepository.save(result);
      results.push(result);
    }
    
    return results;
  }

  async uploadTemplate(competitionId: string, filename: string) {
      const competition = await this.findCompetition(competitionId);
      competition.certificateTemplate = filename;
      return this.competitionRepository.save(competition);
  }
}

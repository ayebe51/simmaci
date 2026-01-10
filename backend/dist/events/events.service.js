var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { Competition } from './entities/competition.entity';
import { Participant } from './entities/participant.entity';
import { Result } from './entities/result.entity';
import { PdfService } from '../pdf/pdf.service';
let EventsService = class EventsService {
    eventRepository;
    competitionRepository;
    participantRepository;
    resultRepository;
    pdfService;
    constructor(eventRepository, competitionRepository, participantRepository, resultRepository, pdfService) {
        this.eventRepository = eventRepository;
        this.competitionRepository = competitionRepository;
        this.participantRepository = participantRepository;
        this.resultRepository = resultRepository;
        this.pdfService = pdfService;
    }
    async create(createEventDto) {
        const event = this.eventRepository.create(createEventDto);
        return this.eventRepository.save(event);
    }
    async findAll() {
        return this.eventRepository.find({ order: { createdAt: 'DESC' } });
    }
    async findOne(id) {
        const event = await this.eventRepository.findOne({
            where: { id },
            relations: ['competitions'],
        });
        if (!event) {
            throw new NotFoundException(`Event with ID ${id} not found`);
        }
        return event;
    }
    async update(id, updateEventDto) {
        const event = await this.findOne(id);
        this.eventRepository.merge(event, updateEventDto);
        return this.eventRepository.save(event);
    }
    async remove(id) {
        const event = await this.findOne(id);
        await this.eventRepository.remove(event);
    }
    async createCompetition(eventId, dto) {
        const event = await this.findOne(eventId);
        const competition = this.competitionRepository.create({
            ...dto,
            event,
        });
        return this.competitionRepository.save(competition);
    }
    async findCompetition(id) {
        const competition = await this.competitionRepository.findOne({
            where: { id },
            relations: ['participants', 'results', 'results.participant', 'event'],
        });
        if (!competition)
            throw new NotFoundException(`Competition with ID ${id} not found`);
        return competition;
    }
    async removeCompetition(id) {
        const comp = await this.findCompetition(id);
        await this.competitionRepository.remove(comp);
    }
    async registerParticipant(competitionId, dto) {
        const competition = await this.findCompetition(competitionId);
        const participant = this.participantRepository.create({
            ...dto,
            competition,
        });
        return this.participantRepository.save(participant);
    }
    async removeParticipant(id) {
        const participant = await this.participantRepository.findOne({ where: { id } });
        if (!participant)
            throw new NotFoundException('Participant not found');
        await this.participantRepository.remove(participant);
    }
    async inputResult(competitionId, dto) {
        const competition = await this.findCompetition(competitionId);
        const participant = await this.participantRepository.findOne({ where: { id: dto.participantId } });
        if (!participant) {
            throw new NotFoundException(`Participant with ID ${dto.participantId} not found`);
        }
        let result = await this.resultRepository.findOne({
            where: { competition: { id: competitionId }, participant: { id: dto.participantId } },
        });
        if (result) {
            result.score = dto.score ?? result.score;
            result.rank = dto.rank ?? result.rank;
            result.notes = dto.notes ?? result.notes;
        }
        else {
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
    async generateCertificate(competitionId, participantId) {
        const competition = await this.findCompetition(competitionId);
        const participant = await this.participantRepository.findOne({ where: { id: participantId } });
        if (!participant)
            throw new NotFoundException('Participant not found');
        const result = await this.resultRepository.findOne({ where: { competition: { id: competitionId }, participant: { id: participantId } } });
        return this.pdfService.createCertificateStream(competition, participant, result);
    }
    async getMedalTally(eventId) {
        const competitions = await this.competitionRepository.find({
            where: { event: { id: eventId } },
            relations: ['results', 'results.participant'],
        });
        console.log(`[MedalTally] Event ${eventId} - Found ${competitions.length} competitions`);
        const tallyMap = new Map();
        for (const comp of competitions) {
            console.log(`[MedalTally] Comp ${comp.name} - Results: ${comp.results?.length}`);
            for (const res of comp.results) {
                console.log(`[MedalTally] Result: Rank=${res.rank}, Participant=${res.participant?.name}, Institution=${res.participant?.institution}`);
                if (!res.participant || !res.rank)
                    continue;
                const institution = res.participant.institution || 'Tanpa Lembaga';
                if (!tallyMap.has(institution)) {
                    tallyMap.set(institution, { gold: 0, silver: 0, bronze: 0, total: 0 });
                }
                const entry = tallyMap.get(institution);
                const rank = Number(res.rank);
                if (isNaN(rank) || rank <= 0)
                    continue;
                if (rank === 1)
                    entry.gold++;
                else if (rank === 2)
                    entry.silver++;
                else if (rank === 3)
                    entry.bronze++;
                if (rank >= 1 && rank <= 3)
                    entry.total++;
            }
        }
        const tally = Array.from(tallyMap.entries()).map(([institution, counts]) => ({
            institution,
            ...counts
        }));
        tally.sort((a, b) => {
            if (b.gold !== a.gold)
                return b.gold - a.gold;
            if (b.silver !== a.silver)
                return b.silver - a.silver;
            return b.bronze - a.bronze;
        });
        return tally;
    }
    async importResults(competitionId, fileBuffer) {
        const XLSX = require('xlsx');
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        const results = [];
        const existingParticipants = await this.participantRepository.find({ where: { competition: { id: competitionId } } });
        for (const row of data) {
            const rank = row['Juara'] || row['Rank'] ? Number(row['Juara'] || row['Rank']) : undefined;
            const name = row['Nama'] || row['Name'];
            if (!name)
                continue;
            let participant = existingParticipants.find(p => p.name.toLowerCase() === String(name).toLowerCase());
            if (!participant) {
                participant = this.participantRepository.create({
                    competition: { id: competitionId },
                    name: String(name),
                    institution: row['Lembaga'] || row['Sekolah'] || row['Institution'] || '-',
                });
                await this.participantRepository.save(participant);
                existingParticipants.push(participant);
            }
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
    async uploadTemplate(competitionId, filename) {
        const competition = await this.findCompetition(competitionId);
        competition.certificateTemplate = filename;
        return this.competitionRepository.save(competition);
    }
};
EventsService = __decorate([
    Injectable(),
    __param(0, InjectRepository(Event)),
    __param(1, InjectRepository(Competition)),
    __param(2, InjectRepository(Participant)),
    __param(3, InjectRepository(Result)),
    __metadata("design:paramtypes", [Repository,
        Repository,
        Repository,
        Repository, typeof (_a = typeof PdfService !== "undefined" && PdfService) === "function" ? _a : Object])
], EventsService);
export { EventsService };
//# sourceMappingURL=events.service.js.map
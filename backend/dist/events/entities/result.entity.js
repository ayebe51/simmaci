var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b;
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Competition } from './competition.entity';
import { Participant } from './participant.entity';
let Result = class Result {
    id;
    competitionId;
    competition;
    participantId;
    participant;
    score;
    rank;
    notes;
    createdAt;
    updatedAt;
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], Result.prototype, "id", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Result.prototype, "competitionId", void 0);
__decorate([
    ManyToOne(() => Competition, (competition) => competition.results, { onDelete: 'CASCADE' }),
    JoinColumn({ name: 'competitionId' }),
    __metadata("design:type", typeof (_a = typeof Competition !== "undefined" && Competition) === "function" ? _a : Object)
], Result.prototype, "competition", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Result.prototype, "participantId", void 0);
__decorate([
    ManyToOne(() => Participant, { onDelete: 'CASCADE' }),
    JoinColumn({ name: 'participantId' }),
    __metadata("design:type", typeof (_b = typeof Participant !== "undefined" && Participant) === "function" ? _b : Object)
], Result.prototype, "participant", void 0);
__decorate([
    Column({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], Result.prototype, "score", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", Number)
], Result.prototype, "rank", void 0);
__decorate([
    Column({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Result.prototype, "notes", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], Result.prototype, "createdAt", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], Result.prototype, "updatedAt", void 0);
Result = __decorate([
    Entity('results')
], Result);
export { Result };
//# sourceMappingURL=result.entity.js.map
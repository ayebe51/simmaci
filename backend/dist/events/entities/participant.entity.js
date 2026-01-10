var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Competition } from './competition.entity';
let Participant = class Participant {
    id;
    competitionId;
    competition;
    name;
    institution;
    contact;
    createdAt;
    updatedAt;
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], Participant.prototype, "id", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Participant.prototype, "competitionId", void 0);
__decorate([
    ManyToOne(() => Competition, (competition) => competition.participants, { onDelete: 'CASCADE' }),
    JoinColumn({ name: 'competitionId' }),
    __metadata("design:type", typeof (_a = typeof Competition !== "undefined" && Competition) === "function" ? _a : Object)
], Participant.prototype, "competition", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Participant.prototype, "name", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Participant.prototype, "institution", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Participant.prototype, "contact", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], Participant.prototype, "createdAt", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], Participant.prototype, "updatedAt", void 0);
Participant = __decorate([
    Entity('participants')
], Participant);
export { Participant };
//# sourceMappingURL=participant.entity.js.map
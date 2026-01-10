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
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, } from 'typeorm';
import { Event } from './event.entity';
import { Participant } from './participant.entity';
import { Result } from './result.entity';
let Competition = class Competition {
    id;
    eventId;
    event;
    name;
    category;
    type;
    certificateTemplate;
    date;
    location;
    participants;
    results;
    createdAt;
    updatedAt;
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], Competition.prototype, "id", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Competition.prototype, "eventId", void 0);
__decorate([
    ManyToOne(() => Event, (event) => event.competitions, { onDelete: 'CASCADE' }),
    JoinColumn({ name: 'eventId' }),
    __metadata("design:type", typeof (_a = typeof Event !== "undefined" && Event) === "function" ? _a : Object)
], Competition.prototype, "event", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Competition.prototype, "name", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Competition.prototype, "category", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Competition.prototype, "type", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Competition.prototype, "certificateTemplate", void 0);
__decorate([
    Column({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Competition.prototype, "date", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Competition.prototype, "location", void 0);
__decorate([
    OneToMany(() => Participant, (participant) => participant.competition),
    __metadata("design:type", Array)
], Competition.prototype, "participants", void 0);
__decorate([
    OneToMany(() => Result, (result) => result.competition),
    __metadata("design:type", Array)
], Competition.prototype, "results", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], Competition.prototype, "createdAt", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], Competition.prototype, "updatedAt", void 0);
Competition = __decorate([
    Entity('competitions')
], Competition);
export { Competition };
//# sourceMappingURL=competition.entity.js.map
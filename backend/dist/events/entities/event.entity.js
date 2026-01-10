var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Competition } from './competition.entity';
let Event = class Event {
    id;
    name;
    category;
    type;
    date;
    location;
    status;
    description;
    competitions;
    createdAt;
    updatedAt;
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], Event.prototype, "id", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Event.prototype, "name", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Event.prototype, "category", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Event.prototype, "type", void 0);
__decorate([
    Column({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Event.prototype, "date", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Event.prototype, "location", void 0);
__decorate([
    Column({ default: 'DRAFT' }),
    __metadata("design:type", String)
], Event.prototype, "status", void 0);
__decorate([
    Column({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Event.prototype, "description", void 0);
__decorate([
    OneToMany(() => Competition, (competition) => competition.event),
    __metadata("design:type", Array)
], Event.prototype, "competitions", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], Event.prototype, "createdAt", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], Event.prototype, "updatedAt", void 0);
Event = __decorate([
    Entity('events')
], Event);
export { Event };
//# sourceMappingURL=event.entity.js.map
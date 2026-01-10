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
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Teacher } from '../../master-data/entities/teacher.entity';
import { School } from '../../master-data/entities/school.entity';
export var HeadmasterStatus;
(function (HeadmasterStatus) {
    HeadmasterStatus["DRAFT"] = "Draft";
    HeadmasterStatus["SUBMITTED"] = "Submitted";
    HeadmasterStatus["VERIFIED"] = "Verified";
    HeadmasterStatus["APPROVED"] = "Approved";
    HeadmasterStatus["REJECTED"] = "Rejected";
    HeadmasterStatus["ACTIVE"] = "Active";
    HeadmasterStatus["EXPIRED"] = "Expired";
})(HeadmasterStatus || (HeadmasterStatus = {}));
let HeadmasterTenure = class HeadmasterTenure {
    id;
    teacher;
    teacherId;
    school;
    schoolId;
    periode;
    skNumber;
    tmt;
    endDate;
    status;
    documents;
    keterangan;
    suratPermohonanUrl;
    suratPermohonanNumber;
    suratPermohonanDate;
    digitalSignatureUrl;
    skUrl;
    createdAt;
    updatedAt;
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], HeadmasterTenure.prototype, "id", void 0);
__decorate([
    ManyToOne(() => Teacher, { eager: true, onDelete: 'CASCADE' }),
    JoinColumn({ name: 'teacherId' }),
    __metadata("design:type", typeof (_a = typeof Teacher !== "undefined" && Teacher) === "function" ? _a : Object)
], HeadmasterTenure.prototype, "teacher", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], HeadmasterTenure.prototype, "teacherId", void 0);
__decorate([
    ManyToOne(() => School, { eager: true, onDelete: 'CASCADE' }),
    JoinColumn({ name: 'schoolId' }),
    __metadata("design:type", typeof (_b = typeof School !== "undefined" && School) === "function" ? _b : Object)
], HeadmasterTenure.prototype, "school", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], HeadmasterTenure.prototype, "schoolId", void 0);
__decorate([
    Column({ default: 1 }),
    __metadata("design:type", Number)
], HeadmasterTenure.prototype, "periode", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], HeadmasterTenure.prototype, "skNumber", void 0);
__decorate([
    Column({ type: 'date' }),
    __metadata("design:type", Date)
], HeadmasterTenure.prototype, "tmt", void 0);
__decorate([
    Column({ type: 'date' }),
    __metadata("design:type", Date)
], HeadmasterTenure.prototype, "endDate", void 0);
__decorate([
    Column({
        type: 'simple-enum',
        enum: HeadmasterStatus,
        default: HeadmasterStatus.DRAFT,
    }),
    __metadata("design:type", String)
], HeadmasterTenure.prototype, "status", void 0);
__decorate([
    Column({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], HeadmasterTenure.prototype, "documents", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], HeadmasterTenure.prototype, "keterangan", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], HeadmasterTenure.prototype, "suratPermohonanUrl", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], HeadmasterTenure.prototype, "suratPermohonanNumber", void 0);
__decorate([
    Column({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], HeadmasterTenure.prototype, "suratPermohonanDate", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], HeadmasterTenure.prototype, "digitalSignatureUrl", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], HeadmasterTenure.prototype, "skUrl", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], HeadmasterTenure.prototype, "createdAt", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], HeadmasterTenure.prototype, "updatedAt", void 0);
HeadmasterTenure = __decorate([
    Entity()
], HeadmasterTenure);
export { HeadmasterTenure };
//# sourceMappingURL=headmaster-tenure.entity.js.map
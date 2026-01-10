var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
let Teacher = class Teacher {
    id;
    nuptk;
    nama;
    status;
    satminkal;
    kecamatan;
    mapel;
    jabatan;
    pdpkpnu;
    gender;
    birthPlace;
    birthDate;
    phoneNumber;
    isCertified;
    pendidikanTerakhir;
    tmt;
    isActive;
    suratPermohonanUrl;
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], Teacher.prototype, "id", void 0);
__decorate([
    Column({ unique: true }),
    __metadata("design:type", String)
], Teacher.prototype, "nuptk", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Teacher.prototype, "nama", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Teacher.prototype, "status", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Teacher.prototype, "satminkal", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Teacher.prototype, "kecamatan", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Teacher.prototype, "mapel", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Teacher.prototype, "jabatan", void 0);
__decorate([
    Column({ default: 'Belum' }),
    __metadata("design:type", String)
], Teacher.prototype, "pdpkpnu", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Teacher.prototype, "gender", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Teacher.prototype, "birthPlace", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Teacher.prototype, "birthDate", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Teacher.prototype, "phoneNumber", void 0);
__decorate([
    Column({ default: false }),
    __metadata("design:type", Boolean)
], Teacher.prototype, "isCertified", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Teacher.prototype, "pendidikanTerakhir", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Teacher.prototype, "tmt", void 0);
__decorate([
    Column({ default: true }),
    __metadata("design:type", Boolean)
], Teacher.prototype, "isActive", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Teacher.prototype, "suratPermohonanUrl", void 0);
Teacher = __decorate([
    Entity(),
    Index('idx_teacher_satminkal', ['satminkal']),
    Index('idx_teacher_isActive', ['isActive']),
    Index('idx_teacher_isCertified', ['isCertified']),
    Index('idx_teacher_pdpkpnu', ['pdpkpnu']),
    Index('idx_teacher_kecamatan', ['kecamatan']),
    Index('idx_teacher_status', ['status'])
], Teacher);
export { Teacher };
//# sourceMappingURL=teacher.entity.js.map
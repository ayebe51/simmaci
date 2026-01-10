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
let School = class School {
    id;
    nsm;
    npsn;
    nama;
    alamat;
    kecamatan;
    kepala;
    status;
    noHpKepala;
    statusJamiyyah;
    akreditasi;
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], School.prototype, "id", void 0);
__decorate([
    Column({ unique: true }),
    __metadata("design:type", String)
], School.prototype, "nsm", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], School.prototype, "npsn", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], School.prototype, "nama", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], School.prototype, "alamat", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], School.prototype, "kecamatan", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], School.prototype, "kepala", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], School.prototype, "status", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], School.prototype, "noHpKepala", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], School.prototype, "statusJamiyyah", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], School.prototype, "akreditasi", void 0);
School = __decorate([
    Entity(),
    Index('idx_school_nama', ['nama'])
], School);
export { School };
//# sourceMappingURL=school.entity.js.map
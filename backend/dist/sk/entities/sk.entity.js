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
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
let Sk = class Sk {
    id;
    jenis;
    jenisPengajuan;
    nomorSurat;
    nama;
    niy;
    jabatan;
    unitKerja;
    keterangan;
    status;
    fileUrl;
    suratPermohonanUrl;
    user;
    userId;
    createdAt;
    updatedAt;
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], Sk.prototype, "id", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Sk.prototype, "jenis", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Sk.prototype, "jenisPengajuan", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Sk.prototype, "nomorSurat", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Sk.prototype, "nama", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Sk.prototype, "niy", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Sk.prototype, "jabatan", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], Sk.prototype, "unitKerja", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Sk.prototype, "keterangan", void 0);
__decorate([
    Column({ default: 'Pending' }),
    __metadata("design:type", String)
], Sk.prototype, "status", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Sk.prototype, "fileUrl", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Sk.prototype, "suratPermohonanUrl", void 0);
__decorate([
    ManyToOne(() => User, { nullable: true }),
    JoinColumn({ name: 'userId' }),
    __metadata("design:type", typeof (_a = typeof User !== "undefined" && User) === "function" ? _a : Object)
], Sk.prototype, "user", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], Sk.prototype, "userId", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], Sk.prototype, "createdAt", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], Sk.prototype, "updatedAt", void 0);
Sk = __decorate([
    Entity(),
    Index('idx_sk_status', ['status']),
    Index('idx_sk_unitKerja', ['unitKerja']),
    Index('idx_sk_userId', ['userId']),
    Index('idx_sk_createdAt', ['createdAt'])
], Sk);
export { Sk };
//# sourceMappingURL=sk.entity.js.map
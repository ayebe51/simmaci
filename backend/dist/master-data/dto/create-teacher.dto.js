var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsNotEmpty, IsOptional, IsString, Matches, Length, IsBoolean, } from 'class-validator';
export class CreateTeacherDto {
    nuptk;
    nama;
    phoneNumber;
    status;
    satminkal;
    kecamatan;
    pdpkpnu;
    isCertified;
    birthPlace;
    birthDate;
}
__decorate([
    IsNotEmpty({ message: 'Nomor Induk tidak boleh kosong' }),
    IsString(),
    __metadata("design:type", String)
], CreateTeacherDto.prototype, "nuptk", void 0);
__decorate([
    IsNotEmpty({ message: 'Nama tidak boleh kosong' }),
    IsString(),
    Length(3, 100, { message: 'Nama harus antara 3-100 karakter' }),
    __metadata("design:type", String)
], CreateTeacherDto.prototype, "nama", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Matches(/^(\+62|62|0)[0-9]{9,12}$/, {
        message: 'Nomor telepon harus format Indonesia yang valid (contoh: 081234567890)',
    }),
    __metadata("design:type", String)
], CreateTeacherDto.prototype, "phoneNumber", void 0);
__decorate([
    IsNotEmpty({ message: 'Status tidak boleh kosong' }),
    IsString(),
    __metadata("design:type", String)
], CreateTeacherDto.prototype, "status", void 0);
__decorate([
    IsNotEmpty({ message: 'Satminkal tidak boleh kosong' }),
    IsString(),
    __metadata("design:type", String)
], CreateTeacherDto.prototype, "satminkal", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], CreateTeacherDto.prototype, "kecamatan", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], CreateTeacherDto.prototype, "pdpkpnu", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateTeacherDto.prototype, "isCertified", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], CreateTeacherDto.prototype, "birthPlace", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], CreateTeacherDto.prototype, "birthDate", void 0);
//# sourceMappingURL=create-teacher.dto.js.map
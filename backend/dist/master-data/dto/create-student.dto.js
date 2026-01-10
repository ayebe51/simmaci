var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsString, IsNotEmpty, IsEnum, IsOptional, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
export class CreateStudentDto {
    nisn;
    nomorIndukMaarif;
    nama;
    jenisKelamin;
    tempatLahir;
    tanggalLahir;
    alamat;
    kecamatan;
    namaSekolah;
    kelas;
    nomorTelepon;
    namaWali;
}
__decorate([
    IsString(),
    IsNotEmpty({ message: 'NISN tidak boleh kosong' }),
    Length(10, 10, { message: 'NISN harus 10 digit' }),
    Matches(/^\d+$/, { message: 'NISN harus berupa angka' }),
    Transform(({ value }) => String(value).trim()),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "nisn", void 0);
__decorate([
    IsString(),
    IsOptional(),
    Length(0, 50),
    Transform(({ value }) => value ? String(value).trim() : ''),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "nomorIndukMaarif", void 0);
__decorate([
    IsString(),
    IsNotEmpty({ message: 'Nama tidak boleh kosong' }),
    Length(3, 100, { message: 'Nama harus 3-100 karakter' }),
    Transform(({ value }) => sanitizeHtml(String(value).trim())),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "nama", void 0);
__decorate([
    IsEnum(['L', 'P'], { message: 'Jenis kelamin harus L atau P' }),
    IsNotEmpty({ message: 'Jenis kelamin tidak boleh kosong' }),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "jenisKelamin", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Length(0, 100),
    Transform(({ value }) => value ? sanitizeHtml(String(value).trim()) : ''),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "tempatLahir", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD' }),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "tanggalLahir", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Length(0, 200),
    Transform(({ value }) => value ? sanitizeHtml(String(value).trim()) : ''),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "alamat", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Length(0, 50),
    Transform(({ value }) => value ? sanitizeHtml(String(value).trim()) : ''),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "kecamatan", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Length(0, 100),
    Transform(({ value }) => value ? sanitizeHtml(String(value).trim()) : ''),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "namaSekolah", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Length(0, 10),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "kelas", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Length(0, 15),
    Matches(/^[\d\s\+\-\(\)]*$/, { message: 'Nomor telepon tidak valid' }),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "nomorTelepon", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Length(0, 100),
    Transform(({ value }) => value ? sanitizeHtml(String(value).trim()) : ''),
    __metadata("design:type", String)
], CreateStudentDto.prototype, "namaWali", void 0);
function sanitizeHtml(input) {
    if (!input)
        return '';
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}
//# sourceMappingURL=create-student.dto.js.map
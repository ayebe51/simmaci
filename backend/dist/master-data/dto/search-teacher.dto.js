var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsOptional, IsString } from 'class-validator';
export class SearchTeacherDto {
    search;
    status;
    satminkal;
    kecamatan;
    isCertified;
    pdpkpnu;
}
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SearchTeacherDto.prototype, "search", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SearchTeacherDto.prototype, "status", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SearchTeacherDto.prototype, "satminkal", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SearchTeacherDto.prototype, "kecamatan", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SearchTeacherDto.prototype, "isCertified", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SearchTeacherDto.prototype, "pdpkpnu", void 0);
//# sourceMappingURL=search-teacher.dto.js.map
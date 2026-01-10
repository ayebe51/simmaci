var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';
export class CreateEventDto {
    name;
    category;
    type;
    date;
    location;
    status;
    description;
}
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateEventDto.prototype, "name", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateEventDto.prototype, "category", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateEventDto.prototype, "type", void 0);
__decorate([
    IsDateString(),
    IsOptional(),
    __metadata("design:type", String)
], CreateEventDto.prototype, "date", void 0);
__decorate([
    IsString(),
    IsOptional(),
    __metadata("design:type", String)
], CreateEventDto.prototype, "location", void 0);
__decorate([
    IsString(),
    IsOptional(),
    IsIn(['DRAFT', 'OPEN', 'CLOSED', 'COMPLETED']),
    __metadata("design:type", String)
], CreateEventDto.prototype, "status", void 0);
__decorate([
    IsString(),
    IsOptional(),
    __metadata("design:type", String)
], CreateEventDto.prototype, "description", void 0);
export class UpdateEventDto extends CreateEventDto {
}
//# sourceMappingURL=create-event.dto.js.map
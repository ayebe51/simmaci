var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, } from 'typeorm';
let ApprovalHistory = class ApprovalHistory {
    id;
    skId;
    skNumber;
    skType;
    approvedBy;
    approvedByName;
    approvedByRole;
    status;
    notes;
    createdAt;
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    __metadata("design:type", String)
], ApprovalHistory.prototype, "id", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], ApprovalHistory.prototype, "skId", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], ApprovalHistory.prototype, "skNumber", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], ApprovalHistory.prototype, "skType", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], ApprovalHistory.prototype, "approvedBy", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], ApprovalHistory.prototype, "approvedByName", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], ApprovalHistory.prototype, "approvedByRole", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], ApprovalHistory.prototype, "status", void 0);
__decorate([
    Column({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ApprovalHistory.prototype, "notes", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], ApprovalHistory.prototype, "createdAt", void 0);
ApprovalHistory = __decorate([
    Entity('approval_history')
], ApprovalHistory);
export { ApprovalHistory };
//# sourceMappingURL=approval-history.entity.js.map
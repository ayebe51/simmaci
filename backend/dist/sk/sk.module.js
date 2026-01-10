var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkService } from './sk.service';
import { SkController, SkPublicController } from './sk.controller';
import { Sk } from './entities/sk.entity';
import { ApprovalHistory } from './entities/approval-history.entity';
import { User } from '../users/entities/user.entity';
let SkModule = class SkModule {
};
SkModule = __decorate([
    Module({
        imports: [TypeOrmModule.forFeature([Sk, ApprovalHistory, User])],
        controllers: [SkController, SkPublicController],
        providers: [SkService],
        exports: [SkService],
    })
], SkModule);
export { SkModule };
//# sourceMappingURL=sk.module.js.map
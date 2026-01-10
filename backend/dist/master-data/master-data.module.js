var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from './entities/school.entity';
import { Student } from './entities/student.entity';
import { Teacher } from './entities/teacher.entity';
import { MasterDataService } from './master-data.service';
import { MasterDataController } from './master-data.controller';
import { ExcelService } from '../common/services/excel.service';
let MasterDataModule = class MasterDataModule {
};
MasterDataModule = __decorate([
    Module({
        imports: [TypeOrmModule.forFeature([Student, School, Teacher])],
        controllers: [MasterDataController],
        providers: [MasterDataService, ExcelService],
        exports: [MasterDataService, TypeOrmModule],
    })
], MasterDataModule);
export { MasterDataModule };
//# sourceMappingURL=master-data.module.js.map
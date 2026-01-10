var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeadmasterTenure } from './entities/headmaster-tenure.entity';
import { Teacher } from '../master-data/entities/teacher.entity';
import { HeadmasterController } from './headmaster.controller';
import { HeadmasterService } from './headmaster.service';
import { MasterDataModule } from '../master-data/master-data.module';
import { UsersModule } from '../users/users.module';
import { PdfModule } from '../pdf/pdf.module';
let HeadmasterModule = class HeadmasterModule {
};
HeadmasterModule = __decorate([
    Module({
        imports: [
            TypeOrmModule.forFeature([HeadmasterTenure, Teacher]),
            MasterDataModule,
            UsersModule,
            PdfModule,
        ],
        controllers: [HeadmasterController],
        providers: [HeadmasterService],
        exports: [HeadmasterService],
    })
], HeadmasterModule);
export { HeadmasterModule };
//# sourceMappingURL=headmaster.module.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { EmisService } from './emis.service';
import { EmisController } from './emis.controller';
import { MasterDataModule } from '../master-data/master-data.module';
let EmisModule = class EmisModule {
};
EmisModule = __decorate([
    Module({
        imports: [MasterDataModule],
        controllers: [EmisController],
        providers: [EmisService],
        exports: [EmisService],
    })
], EmisModule);
export { EmisModule };
//# sourceMappingURL=emis.module.js.map
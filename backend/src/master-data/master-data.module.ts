import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from './entities/school.entity';
import { Student } from './entities/student.entity';
import { Teacher } from './entities/teacher.entity';
import { MasterDataService } from './master-data.service';
import { MasterDataController } from './master-data.controller';
import { ExcelService } from '../common/services/excel.service';

@Module({
  imports: [TypeOrmModule.forFeature([Student, School, Teacher])],
  controllers: [MasterDataController],
  providers: [MasterDataService, ExcelService],
  exports: [MasterDataService, TypeOrmModule],
})
export class MasterDataModule {}

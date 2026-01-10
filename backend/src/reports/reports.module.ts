import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Teacher } from '../master-data/entities/teacher.entity';
import { Sk } from '../sk/entities/sk.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Teacher, Sk])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

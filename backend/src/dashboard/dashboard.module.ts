import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { User } from '../users/entities/user.entity';
import { School } from '../master-data/entities/school.entity';
import { Student } from '../master-data/entities/student.entity';
import { Sk } from '../sk/entities/sk.entity';
import { Teacher } from '../master-data/entities/teacher.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, School, Student, Sk, Teacher]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

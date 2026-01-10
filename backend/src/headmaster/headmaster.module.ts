import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeadmasterTenure } from './entities/headmaster-tenure.entity';
import { Teacher } from '../master-data/entities/teacher.entity';
import { HeadmasterController } from './headmaster.controller';
import { HeadmasterService } from './headmaster.service';
import { MasterDataModule } from '../master-data/master-data.module';
import { UsersModule } from '../users/users.module';
import { PdfModule } from '../pdf/pdf.module'; // Also adding PdfModule for Controller

@Module({
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
export class HeadmasterModule {}

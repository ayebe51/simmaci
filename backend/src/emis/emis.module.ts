import { Module } from '@nestjs/common';
import { EmisService } from './emis.service';
import { EmisController } from './emis.controller';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [MasterDataModule],
  controllers: [EmisController],
  providers: [EmisService],
  exports: [EmisService],
})
export class EmisModule {}

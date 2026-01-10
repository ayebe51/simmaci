import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkService } from './sk.service';
import { SkController, SkPublicController } from './sk.controller';
import { Sk } from './entities/sk.entity';
import { ApprovalHistory } from './entities/approval-history.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sk, ApprovalHistory, User])],
  controllers: [SkController, SkPublicController],
  providers: [SkService],
  exports: [SkService],
})
export class SkModule {}

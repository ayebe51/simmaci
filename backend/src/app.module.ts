import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Import all modules
import { MasterDataModule } from './master-data/master-data.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SkModule } from './sk/sk.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import { HeadmasterModule } from './headmaster/headmaster.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmisModule } from './emis/emis.module';
import { EventsModule } from './events/events.module';
import { PdfModule } from './pdf/pdf.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres', // Changed from 'sqlite'
        url: configService.get('DATABASE_URL'),
        ssl: {
          rejectUnauthorized: false, // Required for Supabase
        },
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true, // Auto-creates tables (dev only!)
        logging: process.env.NODE_ENV !== 'production',
      }),
      inject: [ConfigService],
    }),
    MasterDataModule,
    DashboardModule,
    SkModule,
    AuthModule,
    UsersModule,
    ReportsModule,
    HeadmasterModule,
    NotificationsModule,
    EmisModule,
    EventsModule,
    PdfModule,
  ],
})
export class AppModule {}

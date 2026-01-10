import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';  // SECURITY: Rate limiting
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MasterDataModule } from './master-data/master-data.module';
import { EmisModule } from './emis/emis.module';
import { PdfModule } from './pdf/pdf.module';
import { SkModule } from './sk/sk.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventsModule } from './events/events.module';
import { HeadmasterModule } from './headmaster/headmaster.module';
import { AiModule } from './ai/ai.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // SECURITY: Rate limiting - prevent brute force & DDoS attacks
    ThrottlerModule.forRoot([{
      ttl: 60000,  // 60 seconds
      limit: 60,   // 60 requests per minute per IP
    }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // Default to sqlite if not specified!
        const dbType = configService.get<string>('DB_TYPE', 'sqlite');
        if (dbType === 'sqlite') {
            return {
                type: 'sqlite',
                database: configService.get<string>('DB_DATABASE', 'simmaci.db'),
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: true,
            }
        }
        return {
            type: 'postgres',
            host: configService.get<string>('DB_HOST'),
            port: configService.get<number>('DB_PORT'),
            username: configService.get<string>('DB_USERNAME'),
            password: configService.get<string>('DB_PASSWORD'),
            database: configService.get<string>('DB_NAME'),
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true, // Only for development!
        }
      },
      inject: [ConfigService],
    }),
    MasterDataModule,
    AuthModule,
    UsersModule, // Ensure UsersModule is imported
    EmisModule,
    PdfModule,
    SkModule,
    DashboardModule,
    EventsModule,
    HeadmasterModule,
    AiModule,
    ReportsModule, // Phase A: Reports module
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

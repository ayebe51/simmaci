var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
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
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        imports: [
            ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            ThrottlerModule.forRoot([{
                    ttl: 60000,
                    limit: 60,
                }]),
            TypeOrmModule.forRootAsync({
                imports: [ConfigModule],
                useFactory: async (configService) => {
                    const dbType = configService.get('DB_TYPE', 'sqlite');
                    if (dbType === 'sqlite') {
                        return {
                            type: 'sqlite',
                            database: configService.get('DB_DATABASE', 'simmaci.db'),
                            entities: [__dirname + '/**/*.entity{.ts,.js}'],
                            synchronize: true,
                        };
                    }
                    return {
                        type: 'postgres',
                        host: configService.get('DB_HOST'),
                        port: configService.get('DB_PORT'),
                        username: configService.get('DB_USERNAME'),
                        password: configService.get('DB_PASSWORD'),
                        database: configService.get('DB_NAME'),
                        entities: [__dirname + '/**/*.entity{.ts,.js}'],
                        synchronize: true,
                    };
                },
                inject: [ConfigService],
            }),
            MasterDataModule,
            AuthModule,
            UsersModule,
            EmisModule,
            PdfModule,
            SkModule,
            DashboardModule,
            EventsModule,
            HeadmasterModule,
            AiModule,
            ReportsModule,
        ],
        controllers: [AppController],
        providers: [AppService],
    })
], AppModule);
export { AppModule };
//# sourceMappingURL=app.module.js.map
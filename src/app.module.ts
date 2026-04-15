import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';

import { ScaleModule } from './modules/scale/scale.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { PluginModule } from './modules/plugin/plugin.module';
import { OrgModule } from './modules/org/org.module';
import { TaskModule } from './modules/task/task.module';
import { ResultModule } from './modules/result/result.module';
import { AlertModule } from './modules/alert/alert.module';
import { ConsentModule } from './modules/consent/consent.module';
import { CoreModule } from './modules/core/core.module';
import { AdminModule } from './modules/admin/admin.module';
import { ExportModule } from './modules/export/export.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import {
  Scale,
  ScaleItem,
  ScaleOption,
  ScoringRule,
  ScoreRange,
  Grade,
  Class,
  Student,
  User,
  Role,
  Permission,
  Task,
  TaskAnswer,
  TaskAnswerItem,
  TaskResult,
  Plugin,
  PluginHook,
  PluginLog,
  ConsentRecord,
  AuditLog,
  AlertRecord,
  AlertNotification,
  SystemConfig,
} from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_DATABASE', 'psych_scale'),
        entities: [
          Scale,
          ScaleItem,
          ScaleOption,
          ScoringRule,
          ScoreRange,
          Grade,
          Class,
          Student,
          User,
          Role,
          Permission,
          Task,
          TaskAnswer,
          TaskAnswerItem,
          TaskResult,
          Plugin,
          PluginHook,
          PluginLog,
          ConsentRecord,
          AuditLog,
          AlertRecord,
          AlertNotification,
          SystemConfig,
        ],
        synchronize: config.get('DB_SYNC', 'false') === 'true',
        logging: config.get('DB_LOGGING', 'false') === 'true',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: config.get('DB_SYNC', 'false') !== 'true',
      }),
      inject: [ConfigService],
    }),
    CoreModule,
    AuthModule,
    AuditModule,
    ConsentModule,
    OrgModule,
    ScaleModule,
    ScoringModule,
    TaskModule,
    ResultModule,
    AlertModule,
    PluginModule,
    AdminModule,
    ExportModule,
    DashboardModule,
    HealthModule,
  ],
})
export class AppModule {}

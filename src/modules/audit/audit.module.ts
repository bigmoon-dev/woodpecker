import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLog } from '../../entities/audit/audit-log.entity';
import { Student } from '../../entities/org/student.entity';
import { AuditInterceptor } from './audit.interceptor';
import { DataRetentionService } from './data-retention.service';
import { AuditIntegrityService } from './audit-integrity.service';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, Student])],
  controllers: [AuditLogController],
  providers: [
    AuditInterceptor,
    DataRetentionService,
    AuditIntegrityService,
    AuditLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [
    AuditInterceptor,
    DataRetentionService,
    AuditIntegrityService,
    AuditLogService,
  ],
})
export class AuditModule {}

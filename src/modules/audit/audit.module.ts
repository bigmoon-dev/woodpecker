import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLog } from '../../entities/audit/audit-log.entity';
import { Student } from '../../entities/org/student.entity';
import { AuditInterceptor } from './audit.interceptor';
import { DataRetentionService } from './data-retention.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, Student])],
  providers: [
    AuditInterceptor,
    DataRetentionService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditInterceptor, DataRetentionService],
})
export class AuditModule {}

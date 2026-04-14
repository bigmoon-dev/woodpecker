import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { ResultModule } from '../result/result.module';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AlertRecord, TaskResult, TaskAnswer]),
    ResultModule,
    CoreModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}

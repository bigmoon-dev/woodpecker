import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { ResultModule } from '../result/result.module';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AlertRecord,
      TaskResult,
      TaskAnswer,
      Student,
      Class,
      Grade,
    ]),
    ResultModule,
    CoreModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}

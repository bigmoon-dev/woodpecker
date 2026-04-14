import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { ConsentRecord } from '../../entities/consent/consent-record.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { ResultService } from './result.service';
import { ResultController } from './result.controller';
import { ReportExportController } from './report-export.controller';
import { ConsentModule } from '../consent/consent.module';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskResult,
      TaskAnswer,
      ConsentRecord,
      Student,
      Class,
    ]),
    ConsentModule,
    CoreModule,
  ],
  controllers: [ResultController, ReportExportController],
  providers: [ResultService],
  exports: [ResultService],
})
export class ResultModule {}

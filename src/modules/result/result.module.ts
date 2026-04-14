import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { ResultService } from './result.service';
import { ResultController } from './result.controller';
import { ReportExportController } from './report-export.controller';
import { ConsentModule } from '../consent/consent.module';

@Module({
  imports: [TypeOrmModule.forFeature([TaskResult, TaskAnswer]), ConsentModule],
  controllers: [ResultController, ReportExportController],
  providers: [ResultService],
  exports: [ResultService],
})
export class ResultModule {}

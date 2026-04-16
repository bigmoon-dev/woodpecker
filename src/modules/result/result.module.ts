import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Task } from '../../entities/task/task.entity';
import { ConsentRecord } from '../../entities/consent/consent-record.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { ReportTemplate } from '../../entities/report/report-template.entity';
import { ResultService } from './result.service';
import { ResultController } from './result.controller';
import { ReportExportController } from './report-export.controller';
import { InterventionAnalysisService } from './intervention-analysis.service';
import {
  ReportTemplateService,
  ReportGeneratorService,
} from './report-generator.service';
import { ConsentModule } from '../consent/consent.module';
import { CoreModule } from '../core/core.module';
import { ExportModule } from '../export/export.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskResult,
      TaskAnswer,
      Task,
      ConsentRecord,
      Student,
      Class,
      ReportTemplate,
    ]),
    ConsentModule,
    CoreModule,
    ExportModule,
  ],
  controllers: [ResultController, ReportExportController],
  providers: [
    ResultService,
    InterventionAnalysisService,
    ReportTemplateService,
    ReportGeneratorService,
  ],
  exports: [
    ResultService,
    InterventionAnalysisService,
    ReportTemplateService,
    ReportGeneratorService,
  ],
})
export class ResultModule {}

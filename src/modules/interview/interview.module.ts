import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Interview } from '../../entities/interview/interview.entity';
import { InterviewFile } from '../../entities/interview/interview-file.entity';
import { InterviewTemplate } from '../../entities/interview/interview-template.entity';
import { FollowUpReminder } from '../../entities/interview/follow-up-reminder.entity';
import { Student } from '../../entities/org/student.entity';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { InterviewService } from './interview.service';
import { InterviewController } from './interview.controller';
import { OcrService } from './ocr.service';
import { TemplateService } from './template.service';
import { TimelineService } from './timeline.service';
import { FollowUpService } from './follow-up.service';
import { SummaryExtractionService } from './summary-extraction.service';
import { CoreModule } from '../core/core.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MulterModule.register({ dest: './public/uploads/interviews' }),
    TypeOrmModule.forFeature([
      Interview,
      InterviewFile,
      InterviewTemplate,
      FollowUpReminder,
      Student,
      User,
      Role,
      TaskResult,
      AlertRecord,
    ]),
    CoreModule,
    AuthModule,
  ],
  controllers: [InterviewController],
  providers: [
    InterviewService,
    OcrService,
    TemplateService,
    TimelineService,
    FollowUpService,
    SummaryExtractionService,
  ],
  exports: [
    InterviewService,
    TemplateService,
    TimelineService,
    FollowUpService,
    SummaryExtractionService,
  ],
})
export class InterviewModule {}

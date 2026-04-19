import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { AlertHandlingRecord } from '../../entities/audit/alert-handling-record.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Interview } from '../../entities/interview/interview.entity';
import { FollowUpReminder } from '../../entities/interview/follow-up-reminder.entity';
import { StudentProfileService } from './student-profile.service';
import {
  StudentProfileController,
  FollowupController,
} from './student-profile.controller';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      Class,
      Grade,
      AlertRecord,
      AlertHandlingRecord,
      TaskResult,
      TaskAnswer,
      Interview,
      FollowUpReminder,
    ]),
    CoreModule,
  ],
  controllers: [StudentProfileController, FollowupController],
  providers: [StudentProfileService],
  exports: [StudentProfileService],
})
export class StudentModule {}

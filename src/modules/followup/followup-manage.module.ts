import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Interview } from '../../entities/interview/interview.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { FollowupManageService } from './followup-manage.service';
import { FollowupManageController } from './followup-manage.controller';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskResult,
      TaskAnswer,
      Interview,
      Student,
      Class,
      Grade,
    ]),
    CoreModule,
  ],
  controllers: [FollowupManageController],
  providers: [FollowupManageService],
  exports: [FollowupManageService],
})
export class FollowupManageModule {}

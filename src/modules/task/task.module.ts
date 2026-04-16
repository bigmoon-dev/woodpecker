import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../../entities/task/task.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { TaskAnswerItem } from '../../entities/task/task-answer-item.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { ConsentRecord } from '../../entities/consent/consent-record.entity';
import { Student } from '../../entities/org/student.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { ScoringModule } from '../scoring/scoring.module';
import { ScaleModule } from '../scale/scale.module';
import { PluginModule } from '../plugin/plugin.module';
import { ConsentModule } from '../consent/consent.module';
import { AlertModule } from '../alert/alert.module';
import { AlertService } from '../alert/alert.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      TaskAnswer,
      TaskAnswerItem,
      TaskResult,
      ConsentRecord,
      Student,
    ]),
    ScoringModule,
    ScaleModule,
    PluginModule,
    ConsentModule,
    AlertModule,
  ],
  controllers: [TaskController],
  providers: [
    TaskService,
    {
      provide: 'AlertServiceWrapper',
      useFactory: (taskService: TaskService, alertService: AlertService) => {
        taskService.setAlertService(alertService);
      },
      inject: [TaskService, AlertService],
    },
  ],
  exports: [TaskService],
})
export class TaskModule {}

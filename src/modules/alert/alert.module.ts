import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { AlertHandlingRecord } from '../../entities/audit/alert-handling-record.entity';
import { AlertNotification } from '../../entities/audit/alert-notification.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { AlertService } from './alert.service';
import { AlertController } from './alert.controller';
import { PluginModule } from '../plugin/plugin.module';
import { ResultModule } from '../result/result.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AlertRecord,
      AlertHandlingRecord,
      AlertNotification,
      Student,
      Class,
      User,
      Role,
      TaskResult,
      TaskAnswer,
    ]),
    PluginModule,
    ResultModule,
  ],
  controllers: [AlertController],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {}

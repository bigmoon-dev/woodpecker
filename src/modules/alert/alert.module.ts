import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { AlertNotification } from '../../entities/audit/alert-notification.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { AlertService } from './alert.service';
import { AlertController } from './alert.controller';
import { PluginModule } from '../plugin/plugin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AlertRecord,
      AlertNotification,
      Student,
      Class,
      User,
      Role,
    ]),
    PluginModule,
  ],
  controllers: [AlertController],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {}

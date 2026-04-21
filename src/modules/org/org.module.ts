import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Grade } from '../../entities/org/grade.entity';
import { Class } from '../../entities/org/class.entity';
import { Student } from '../../entities/org/student.entity';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { OrgService } from './org.service';
import { OrgImportService } from './org-import.service';
import { OrgController } from './org.controller';
import { StudentLoginService } from './student-login.service';
import { EncryptionService } from '../core/encryption.service';

@Module({
  imports: [TypeOrmModule.forFeature([Grade, Class, Student, User, Role])],
  controllers: [OrgController],
  providers: [
    OrgService,
    OrgImportService,
    EncryptionService,
    StudentLoginService,
  ],
  exports: [OrgService],
})
export class OrgModule {}

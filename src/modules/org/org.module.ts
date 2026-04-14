import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Grade } from '../../entities/org/grade.entity';
import { Class } from '../../entities/org/class.entity';
import { Student } from '../../entities/org/student.entity';
import { OrgService } from './org.service';
import { OrgController } from './org.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Grade, Class, Student])],
  controllers: [OrgController],
  providers: [OrgService],
  exports: [OrgService],
})
export class OrgModule {}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';

export interface DataScope {
  scope: 'own' | 'class' | 'grade' | 'all';
  userId: string;
  classId?: string;
  gradeId?: string;
}

@Injectable()
export class DataScopeFilter {
  constructor(
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(Class)
    private classRepo: Repository<Class>,
  ) {}

  async getStudentIds(dataScope: DataScope): Promise<string[]> {
    switch (dataScope.scope) {
      case 'own': {
        const student = await this.studentRepo
          .createQueryBuilder('s')
          .innerJoin('users', 'u', 'u.studentRecordId = s.id')
          .where('u.id = :userId', { userId: dataScope.userId })
          .getOne();
        return student ? [student.id] : [];
      }
      case 'class':
        if (!dataScope.classId) return [];
        return (
          await this.studentRepo.find({
            where: { classId: dataScope.classId },
          })
        ).map((s) => s.id);
      case 'grade': {
        if (!dataScope.gradeId) return [];
        const classes = await this.classRepo.find({
          where: { gradeId: dataScope.gradeId },
        });
        if (classes.length === 0) return [];
        return (
          await this.studentRepo.find({
            where: { classId: In(classes.map((c) => c.id)) },
          })
        ).map((s) => s.id);
      }
      case 'all':
        return (
          await this.studentRepo.find({ select: ['id'] })
        ).map((s) => s.id);
    }
  }
}

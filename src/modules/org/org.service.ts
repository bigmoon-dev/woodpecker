import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Grade } from '../../entities/org/grade.entity';
import { Class } from '../../entities/org/class.entity';
import { Student } from '../../entities/org/student.entity';
import { HookBus } from '../plugin/hook-bus';
import { DataScopeFilter, DataScope } from '../auth/data-scope-filter';

@Injectable()
export class OrgService {
  constructor(
    @InjectRepository(Grade)
    private gradeRepo: Repository<Grade>,
    @InjectRepository(Class)
    private classRepo: Repository<Class>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    private hookBus: HookBus,
    private dataScopeFilter: DataScopeFilter,
  ) {}

  async createGrade(data: Partial<Grade>): Promise<Grade> {
    const grade = this.gradeRepo.create(data);
    return this.gradeRepo.save(grade);
  }

  async findAllGrades(
    dataScope: DataScope,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: Grade[]; total: number }> {
    if (dataScope.scope === 'all') {
      const [data, total] = await this.gradeRepo.findAndCount({
        skip: (page - 1) * pageSize,
        take: pageSize,
        order: { sortOrder: 'ASC' },
      });
      return { data, total };
    }

    const studentIds = await this.dataScopeFilter.getStudentIds(dataScope);
    if (studentIds.length === 0) return { data: [], total: 0 };

    const students = await this.studentRepo.find({
      where: studentIds.map((id) => ({ id })),
      select: ['id', 'classId'],
    });
    const classIds = [
      ...new Set(students.map((s) => s.classId).filter(Boolean)),
    ];
    if (classIds.length === 0) return { data: [], total: 0 };

    const classes = await this.classRepo.find({
      where: classIds.map((id) => ({ id })),
      select: ['id', 'gradeId'],
    });
    const gradeIds = [
      ...new Set(classes.map((c) => c.gradeId).filter(Boolean)),
    ];
    if (gradeIds.length === 0) return { data: [], total: 0 };

    const [data, total] = await this.gradeRepo.findAndCount({
      where: { id: In(gradeIds) },
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { sortOrder: 'ASC' },
    });
    return { data, total };
  }

  async findOneGrade(id: string): Promise<Grade> {
    const grade = await this.gradeRepo.findOne({
      where: { id },
      relations: ['classes'],
    });
    if (!grade) throw new NotFoundException(`Grade ${id} not found`);
    return grade;
  }

  async removeGrade(id: string): Promise<void> {
    await this.gradeRepo.delete(id);
  }

  async updateGrade(id: string, data: Partial<Grade>): Promise<Grade> {
    const grade = await this.gradeRepo.findOne({ where: { id } });
    if (!grade) throw new NotFoundException(`Grade ${id} not found`);
    Object.assign(grade, data);
    return this.gradeRepo.save(grade);
  }

  async createClass(data: Partial<Class>): Promise<Class> {
    const cls = this.classRepo.create(data);
    return this.classRepo.save(cls);
  }

  async findAllClasses(
    dataScope: DataScope,
    gradeId?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: Class[]; total: number }> {
    const where: Record<string, any> = gradeId ? { gradeId } : {};

    if (dataScope.scope !== 'all') {
      const studentIds = await this.dataScopeFilter.getStudentIds(dataScope);
      if (studentIds.length === 0) return { data: [], total: 0 };

      const students = await this.studentRepo.find({
        where: studentIds.map((id) => ({ id })),
        select: ['id', 'classId'],
      });
      const allowedClassIds = [
        ...new Set(students.map((s) => s.classId).filter(Boolean)),
      ];
      if (allowedClassIds.length === 0) return { data: [], total: 0 };

      where.id = In(allowedClassIds);
    }

    const [data, total] = await this.classRepo.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { sortOrder: 'ASC' },
    });
    return { data, total };
  }

  async findOneClass(id: string): Promise<Class> {
    const cls = await this.classRepo.findOne({
      where: { id },
      relations: ['students'],
    });
    if (!cls) throw new NotFoundException(`Class ${id} not found`);
    return cls;
  }

  async removeClass(id: string): Promise<void> {
    await this.classRepo.delete(id);
  }

  async updateClass(id: string, data: Partial<Class>): Promise<Class> {
    const cls = await this.classRepo.findOne({ where: { id } });
    if (!cls) throw new NotFoundException(`Class ${id} not found`);
    Object.assign(cls, data);
    return this.classRepo.save(cls);
  }

  async createStudent(data: Partial<Student>): Promise<Student> {
    const student = this.studentRepo.create(data);
    const saved = await this.studentRepo.save(student);
    await this.hookBus
      .emit('on:student.imported', {
        studentId: saved.id,
        classId: saved.classId,
      })
      .catch(() => {});
    return saved;
  }

  async findAllStudents(
    dataScope: DataScope,
    classId?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: Student[]; total: number }> {
    const where: Record<string, any> = classId ? { classId } : {};

    if (dataScope.scope !== 'all') {
      const studentIds = await this.dataScopeFilter.getStudentIds(dataScope);
      if (studentIds.length === 0) return { data: [], total: 0 };

      where.id = In(studentIds);
    }

    const [data, total] = await this.studentRepo.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total };
  }

  async findOneStudent(id: string): Promise<Student> {
    const student = await this.studentRepo.findOne({ where: { id } });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    return student;
  }

  async removeStudent(id: string): Promise<void> {
    await this.studentRepo.delete(id);
  }

  async updateStudent(id: string, data: Partial<Student>): Promise<Student> {
    const student = await this.studentRepo.findOne({ where: { id } });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    Object.assign(student, data);
    return this.studentRepo.save(student);
  }
}

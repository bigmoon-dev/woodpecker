import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as crypto from 'crypto';
import { Grade } from '../../entities/org/grade.entity';
import { Class } from '../../entities/org/class.entity';
import { Student } from '../../entities/org/student.entity';
import { HookBus } from '../plugin/hook-bus';
import { DataScopeFilter, DataScope } from '../auth/data-scope-filter';
import { EncryptionService } from '../core/encryption.service';
import { AuditLogService } from '../audit/audit-log.service';

interface CreateStudentInput {
  classId: string;
  name?: string;
  studentNumber?: string;
  gender?: string;
}

interface Operator {
  id: string;
  name: string;
}

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
    private encryptionService: EncryptionService,
    private auditLogService: AuditLogService,
  ) {}

  async createGrade(data: Partial<Grade>): Promise<Grade> {
    if (data.sortOrder === undefined || data.sortOrder === null) {
      const maxResult: { maxSort: number | null } | undefined =
        await this.gradeRepo
          .createQueryBuilder('grade')
          .select('MAX(grade.sortOrder)', 'maxSort')
          .getRawOne();
      data.sortOrder = (maxResult?.maxSort ?? -1) + 1;
    }
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

  async updateGrade(id: string, data: Partial<Grade>): Promise<Grade> {
    const grade = await this.gradeRepo.findOne({ where: { id } });
    if (!grade) throw new NotFoundException(`Grade ${id} not found`);
    Object.assign(grade, data);
    return this.gradeRepo.save(grade);
  }

  async updateGradeStatus(
    id: string,
    status: 'active' | 'archived',
    operator?: Operator,
  ): Promise<Grade> {
    const grade = await this.gradeRepo.findOne({ where: { id } });
    if (!grade) throw new NotFoundException(`Grade ${id} not found`);
    const oldStatus = grade.status;
    grade.status = status;
    const saved = await this.gradeRepo.save(grade);
    if (operator) {
      await this.auditLogService
        .log({
          operatorId: operator.id,
          operatorName: operator.name,
          action: 'grade.update_status',
          entityType: 'grade',
          entityId: id,
          changes: { status: { before: oldStatus, after: status } },
        })
        .catch(() => {});
    }
    return saved;
  }

  async createClass(data: Partial<Class>): Promise<Class> {
    if (data.sortOrder === undefined || data.sortOrder === null) {
      const maxResult: { maxSort: number | null } | undefined =
        await this.classRepo
          .createQueryBuilder('cls')
          .select('MAX(cls.sortOrder)', 'maxSort')
          .getRawOne();
      data.sortOrder = (maxResult?.maxSort ?? -1) + 1;
    }
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

  async updateClass(id: string, data: Partial<Class>): Promise<Class> {
    const cls = await this.classRepo.findOne({ where: { id } });
    if (!cls) throw new NotFoundException(`Class ${id} not found`);
    Object.assign(cls, data);
    return this.classRepo.save(cls);
  }

  async updateClassStatus(
    id: string,
    status: 'active' | 'archived',
    operator?: Operator,
  ): Promise<Class> {
    const cls = await this.classRepo.findOne({ where: { id } });
    if (!cls) throw new NotFoundException(`Class ${id} not found`);
    const oldStatus = cls.status;
    cls.status = status;
    const saved = await this.classRepo.save(cls);
    if (operator) {
      await this.auditLogService
        .log({
          operatorId: operator.id,
          operatorName: operator.name,
          action: 'class.update_status',
          entityType: 'class',
          entityId: id,
          changes: { status: { before: oldStatus, after: status } },
        })
        .catch(() => {});
    }
    return saved;
  }

  async createStudent(
    data: Partial<Student> & {
      name?: string;
      studentNumber?: string;
      studentNo?: string;
    },
  ): Promise<Student> {
    const input = data as unknown as CreateStudentInput;
    const studentNumberRaw: string | undefined =
      input.studentNumber ||
      ((data as Record<string, unknown>).studentNo as string | undefined);
    const encryptedName = input.name
      ? await this.encryptionService.encrypt(input.name)
      : null;
    const encryptedStudentNumber = studentNumberRaw
      ? await this.encryptionService.encrypt(studentNumberRaw)
      : null;
    const studentNumberHash = studentNumberRaw
      ? crypto.createHash('sha256').update(studentNumberRaw).digest('hex')
      : null;

    const student = this.studentRepo.create({
      classId: data.classId,
      gender: data.gender,
      encryptedName,
      encryptedStudentNumber,
      studentNumberHash,
    });
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
  ): Promise<{ data: any[]; total: number }> {
    const where: Record<string, any> = classId ? { classId } : {};

    if (dataScope.scope !== 'all') {
      const studentIds = await this.dataScopeFilter.getStudentIds(dataScope);
      if (studentIds.length === 0) return { data: [], total: 0 };

      where.id = In(studentIds);
    }

    const [students, total] = await this.studentRepo.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: ['class'],
    });

    if (students.length === 0) return { data: [], total };

    const piiMap = await this.encryptionService.batchDecrypt(
      students.map((s) => s.id),
    );

    const data = students.map((s) => {
      const pii = piiMap.get(s.id);
      return {
        id: s.id,
        classId: s.classId,
        className: s.class?.name ?? '',
        name: pii?.name ?? '',
        studentNo: pii?.studentNumber ?? '',
        gender: s.gender,
        status: s.status || 'active',
        createdAt: s.createdAt,
      };
    });

    return { data, total };
  }

  async findOneStudent(id: string): Promise<Student> {
    const student = await this.studentRepo.findOne({ where: { id } });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    return student;
  }

  private static readonly ARCHIVED_STATUSES = new Set([
    'suspended',
    'graduated',
    'transferred',
  ]);

  private assertNotArchied(student: Student): void {
    if (OrgService.ARCHIVED_STATUSES.has(student.status)) {
      throw new BadRequestException(
        `学生已归档（状态: ${student.status}），无法修改`,
      );
    }
  }

  async updateStudent(
    id: string,
    data: Partial<Student> & { name?: string; studentNumber?: string },
    operator?: Operator,
  ): Promise<Student> {
    const student = await this.studentRepo.findOne({ where: { id } });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    this.assertNotArchied(student);
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (data.name) {
      student.encryptedName = await this.encryptionService.encrypt(data.name);
      changes.name = { before: '[encrypted]', after: '[encrypted]' };
    }
    if (data.studentNumber) {
      student.encryptedStudentNumber = await this.encryptionService.encrypt(
        data.studentNumber,
      );
      student.studentNumberHash = crypto
        .createHash('sha256')
        .update(data.studentNumber)
        .digest('hex');
      changes.studentNumber = { before: '[encrypted]', after: '[encrypted]' };
    }
    if (data.classId) {
      changes.classId = { before: student.classId, after: data.classId };
      student.classId = data.classId;
    }
    if (data.gender !== undefined) {
      changes.gender = { before: student.gender, after: data.gender };
      student.gender = data.gender;
    }
    const saved = await this.studentRepo.save(student);
    if (operator && Object.keys(changes).length > 0) {
      await this.auditLogService
        .log({
          operatorId: operator.id,
          operatorName: operator.name,
          action: 'student.update',
          entityType: 'student',
          entityId: id,
          changes,
        })
        .catch(() => {});
    }
    return saved;
  }

  async updateStudentStatus(
    id: string,
    status: 'active' | 'suspended' | 'graduated' | 'transferred',
    operator?: Operator,
  ): Promise<Student> {
    const student = await this.studentRepo.findOne({ where: { id } });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    this.assertNotArchied(student);
    const oldStatus = student.status;
    student.status = status;
    student.statusChangedAt = new Date();
    const saved = await this.studentRepo.save(student);
    if (operator) {
      await this.auditLogService
        .log({
          operatorId: operator.id,
          operatorName: operator.name,
          action: 'student.update_status',
          entityType: 'student',
          entityId: id,
          changes: { status: { before: oldStatus, after: status } },
        })
        .catch(() => {});
    }
    return saved;
  }
}

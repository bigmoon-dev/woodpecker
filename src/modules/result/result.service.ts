import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { DataScopeFilter, DataScope } from '../auth/data-scope-filter';
import { EncryptionService } from '../core/encryption.service';

export interface ResultWithContext {
  result: TaskResult;
  studentId: string;
  studentName: string;
  studentNumber: string;
  className: string;
  gradeName: string;
  taskTitle: string;
  scaleName: string;
}

export type ResultDetail = ResultWithContext;

export interface RetestComparison {
  studentId: string;
  scaleId: string;
  scaleName: string;
  history: {
    date: Date;
    totalScore: number;
    dimensionScores: Record<string, number> | null;
    level: string;
    color: string;
  }[];
  delta: number | null;
  dimensionDeltas: Record<string, number> | null;
  trend: 'rising' | 'declining' | 'stable' | 'insufficient';
  levelTransition: string | null;
}

@Injectable()
export class ResultService {
  constructor(
    @InjectRepository(TaskResult)
    private resultRepo: Repository<TaskResult>,
    @InjectRepository(TaskAnswer)
    private answerRepo: Repository<TaskAnswer>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(Class)
    private classRepo: Repository<Class>,
    @InjectRepository(Grade)
    private gradeRepo: Repository<Grade>,
    private dataScopeFilter: DataScopeFilter,
    private encryptionService: EncryptionService,
    private dataSource: DataSource,
  ) {}

  async compareResults(
    studentId: string,
    scaleId: string,
  ): Promise<RetestComparison> {
    const answers = await this.answerRepo
      .createQueryBuilder('ta')
      .innerJoinAndSelect('ta.task', 'task')
      .leftJoinAndSelect('task.scale', 'scale')
      .where('ta.student_id = :studentId', { studentId })
      .andWhere('task.scale_id = :scaleId', { scaleId })
      .andWhere('ta.status = :status', { status: 'submitted' })
      .orderBy('ta.submitted_at', 'ASC')
      .getMany();

    if (answers.length === 0) {
      return {
        studentId,
        scaleId,
        scaleName: '',
        history: [],
        delta: null,
        dimensionDeltas: null,
        trend: 'insufficient',
        levelTransition: null,
      };
    }

    const answerIds = answers.map((a) => a.id);
    const results = await this.resultRepo.find({
      where: answerIds.map((id) => ({ answerId: id })),
      order: { createdAt: 'ASC' },
    });

    const history = results.map((r) => ({
      date: r.createdAt,
      totalScore: r.totalScore,
      dimensionScores: r.dimensionScores,
      level: r.level,
      color: r.color,
    }));

    const delta =
      results.length >= 2
        ? results[results.length - 1].totalScore - results[0].totalScore
        : null;

    let dimensionDeltas: Record<string, number> | null = null;
    if (results.length >= 2) {
      const first = results[0].dimensionScores || {};
      const last = results[results.length - 1].dimensionScores || {};
      const keys = new Set([...Object.keys(first), ...Object.keys(last)]);
      dimensionDeltas = {};
      for (const key of keys) {
        dimensionDeltas[key] = (last[key] || 0) - (first[key] || 0);
      }
    }

    let trend: RetestComparison['trend'] = 'insufficient';
    if (delta !== null) {
      if (delta > 0) trend = 'rising';
      else if (delta < 0) trend = 'declining';
      else trend = 'stable';
    }

    const levelTransition =
      results.length >= 2
        ? `${results[0].level} → ${results[results.length - 1].level}`
        : null;

    const firstAnswer = answers[0];
    const scaleName = firstAnswer?.task?.scale?.name ?? '';

    return {
      studentId,
      scaleId,
      scaleName,
      history,
      delta,
      dimensionDeltas,
      trend,
      levelTransition,
    };
  }

  async findByStudent(studentId: string): Promise<ResultWithContext[]> {
    const answers = await this.answerRepo.find({
      where: { studentId },
      relations: ['task', 'task.scale'],
    });
    const answerIds = answers.map((a) => a.id);
    if (answerIds.length === 0) return [];

    const results = await this.resultRepo.find({
      where: answerIds.map((id) => ({ answerId: id })),
      order: { createdAt: 'DESC' },
    });

    const piiMap = await this.encryptionService.batchDecrypt([studentId]);
    const pii = piiMap.get(studentId);

    const student = await this.studentRepo.findOne({
      where: { id: studentId },
    });
    const classEntity = student
      ? await this.classRepo.findOne({ where: { id: student.classId } })
      : null;
    const gradeEntity = classEntity
      ? await this.gradeRepo.findOne({ where: { id: classEntity.gradeId } })
      : null;

    const answerMap = new Map(answers.map((a) => [a.id, a]));

    return results.map((r) => {
      const answer = answerMap.get(r.answerId);
      return {
        result: r,
        studentId,
        studentName: pii?.name ?? '',
        studentNumber: pii?.studentNumber ?? '',
        className: classEntity?.name ?? '',
        gradeName: gradeEntity?.name ?? '',
        taskTitle: answer?.task?.title ?? '',
        scaleName: answer?.task?.scale?.name ?? '',
      };
    });
  }

  async findByScope(dataScope: DataScope): Promise<TaskResult[]> {
    if (dataScope.scope === 'all') {
      return this.resultRepo.find({ order: { createdAt: 'DESC' } });
    }
    const studentIds = await this.dataScopeFilter.getStudentIds(dataScope);
    if (studentIds.length === 0) return [];
    const answers = await this.answerRepo.find({
      where: studentIds.map((id) => ({ studentId: id })),
    });
    const answerIds = answers.map((a) => a.id);
    if (answerIds.length === 0) return [];
    return this.resultRepo.find({
      where: answerIds.map((id) => ({ answerId: id })),
    });
  }

  async findOne(resultId: string, dataScope: DataScope): Promise<ResultDetail> {
    const result = await this.resultRepo.findOne({ where: { id: resultId } });
    if (!result) throw new NotFoundException(`Result ${resultId} not found`);

    const answer = await this.answerRepo.findOne({
      where: { id: result.answerId },
      relations: ['task', 'task.scale'],
    });
    if (!answer)
      throw new NotFoundException(`Answer for result ${resultId} not found`);

    const studentId = answer.studentId;

    if (dataScope.scope !== 'all') {
      const allowedIds = await this.dataScopeFilter.getStudentIds(dataScope);
      if (!allowedIds.includes(studentId)) {
        throw new ForbiddenException('You do not have access to this result');
      }
    }

    const pii = await this.encryptionService.batchDecrypt([studentId]);
    const studentData = pii.get(studentId);

    const student = await this.studentRepo.findOne({
      where: { id: studentId },
    });
    const classEntity = student
      ? await this.classRepo.findOne({ where: { id: student.classId } })
      : null;
    const gradeEntity = classEntity
      ? await this.gradeRepo.findOne({ where: { id: classEntity.gradeId } })
      : null;

    return {
      result,
      studentId,
      studentName: studentData?.name ?? '',
      studentNumber: studentData?.studentNumber ?? '',
      className: classEntity?.name ?? '',
      gradeName: gradeEntity?.name ?? '',
      taskTitle: answer.task?.title ?? '',
      scaleName: answer.task?.scale?.name ?? '',
    };
  }

  async findByClass(
    classId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: ResultWithContext[]; total: number }> {
    const students = await this.studentRepo.find({
      where: { classId },
    });
    return this.buildResultsWithContext(
      students.map((s) => s.id),
      classId,
      page,
      pageSize,
    );
  }

  async findByGrade(
    gradeId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: ResultWithContext[]; total: number }> {
    const classes = await this.classRepo.find({ where: { gradeId } });
    const classIds = classes.map((c) => c.id);
    if (classIds.length === 0) return { data: [], total: 0 };
    const students = await this.studentRepo.find({
      where: { classId: In(classIds) },
    });
    return this.buildResultsWithContext(
      students.map((s) => s.id),
      gradeId,
      page,
      pageSize,
    );
  }

  async findByFilter(filter: {
    taskId?: string;
    classId?: string;
    gradeId?: string;
    dataScope: DataScope;
  }): Promise<ResultWithContext[]> {
    let studentIds: string[] = [];

    if (filter.classId) {
      const students = await this.studentRepo.find({
        where: { classId: filter.classId },
      });
      studentIds = students.map((s) => s.id);
    } else if (filter.gradeId) {
      const classes = await this.classRepo.find({
        where: { gradeId: filter.gradeId },
      });
      const classIds = classes.map((c) => c.id);
      if (classIds.length > 0) {
        const students = await this.studentRepo.find({
          where: { classId: In(classIds) },
        });
        studentIds = students.map((s) => s.id);
      }
    } else if (filter.dataScope.scope !== 'all') {
      studentIds = await this.dataScopeFilter.getStudentIds(filter.dataScope);
    }

    let answerQuery = this.answerRepo
      .createQueryBuilder('ta')
      .leftJoinAndSelect('ta.task', 'task')
      .leftJoinAndSelect('task.scale', 'scale');

    if (filter.taskId) {
      answerQuery = answerQuery.andWhere('ta.task_id = :taskId', {
        taskId: filter.taskId,
      });
    }
    if (studentIds.length > 0) {
      answerQuery = answerQuery.andWhere('ta.student_id IN (:...studentIds)', {
        studentIds,
      });
    }

    const answers = await answerQuery
      .andWhere('ta.status = :status', { status: 'submitted' })
      .getMany();

    if (answers.length === 0) return [];

    const answerIds = answers.map((a) => a.id);
    const results = await this.resultRepo.find({
      where: answerIds.map((id) => ({ answerId: id })),
    });

    const uniqueStudentIds = [...new Set(answers.map((a) => a.studentId))];
    const userRows: { id: string; studentId: string }[] =
      await this.dataSource.query(
        'SELECT id, "studentId" FROM users WHERE id = ANY($1::uuid[])',
        [uniqueStudentIds],
      );
    const userToStudent = new Map(userRows.map((r) => [r.id, r.studentId]));
    const realStudentIds = [...new Set(userToStudent.values())].filter(Boolean);
    const piiMap = await this.encryptionService.batchDecrypt(realStudentIds);

    const answerMap = new Map(answers.map((a) => [a.id, a]));

    const studentRecords = await this.studentRepo.find({
      where: { id: In(realStudentIds) },
    });
    const classIds = [...new Set(studentRecords.map((s) => s.classId))];
    const classRecords =
      classIds.length > 0
        ? await this.classRepo.find({ where: { id: In(classIds) } })
        : [];
    const gradeIds = [...new Set(classRecords.map((c) => c.gradeId))];
    const gradeRecords =
      gradeIds.length > 0
        ? await this.gradeRepo.find({ where: { id: In(gradeIds) } })
        : [];
    const classMap = new Map(classRecords.map((c) => [c.id, c]));
    const gradeMap = new Map(gradeRecords.map((g) => [g.id, g]));
    const studentClassMap = new Map(
      studentRecords.map((s) => [s.id, s.classId]),
    );

    return results.map((r) => {
      const answer = answerMap.get(r.answerId);
      const realId = answer
        ? userToStudent.get(answer.studentId) ?? answer.studentId
        : '';
      const pii = piiMap.get(realId);
      const taskEntity = answer?.task;
      const studentClassId = realId ? studentClassMap.get(realId) : undefined;
      const classEntity = studentClassId
        ? classMap.get(studentClassId)
        : undefined;
      const gradeEntity = classEntity
        ? gradeMap.get(classEntity.gradeId)
        : undefined;
      return {
        result: r,
        studentId: realId,
        studentName: pii?.name ?? '',
        studentNumber: pii?.studentNumber ?? '',
        className: classEntity?.name ?? '',
        gradeName: gradeEntity?.name ?? '',
        taskTitle: taskEntity?.title ?? '',
        scaleName: taskEntity?.scale?.name ?? '',
      };
    });
  }

  private async buildResultsWithContext(
    studentIds: string[],
    scopeId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: ResultWithContext[]; total: number }> {
    if (studentIds.length === 0) return { data: [], total: 0 };

    const answers = await this.answerRepo.find({
      where: studentIds.map((id) => ({ studentId: id })),
      relations: ['task', 'task.scale'],
    });
    const answerIds = answers.map((a) => a.id);
    if (answerIds.length === 0) return { data: [], total: 0 };

    const results = await this.resultRepo.find({
      where: answerIds.map((id) => ({ answerId: id })),
      order: { createdAt: 'DESC' },
    });

    const piiMap = await this.encryptionService.batchDecrypt(studentIds);
    const answerMap = new Map(answers.map((a) => [a.id, a]));

    const studentRecords = await this.studentRepo.find({
      where: { id: In(studentIds) },
    });
    const classIds = [...new Set(studentRecords.map((s) => s.classId))];
    const classRecords =
      classIds.length > 0
        ? await this.classRepo.find({ where: { id: In(classIds) } })
        : [];
    const gradeIds = [...new Set(classRecords.map((c) => c.gradeId))];
    const gradeRecords =
      gradeIds.length > 0
        ? await this.gradeRepo.find({ where: { id: In(gradeIds) } })
        : [];
    const classMap = new Map(classRecords.map((c) => [c.id, c]));
    const gradeMap = new Map(gradeRecords.map((g) => [g.id, g]));
    const studentClassMap = new Map(
      studentRecords.map((s) => [s.id, s.classId]),
    );

    const all: ResultWithContext[] = results.map((r) => {
      const answer = answerMap.get(r.answerId);
      const pii = answer ? piiMap.get(answer.studentId) : undefined;
      const taskEntity = answer?.task;
      const studentClassId = answer
        ? studentClassMap.get(answer.studentId)
        : undefined;
      const classEntity = studentClassId
        ? classMap.get(studentClassId)
        : undefined;
      const gradeEntity = classEntity
        ? gradeMap.get(classEntity.gradeId)
        : undefined;
      return {
        result: r,
        studentId: answer?.studentId ?? '',
        studentName: pii?.name ?? '',
        studentNumber: pii?.studentNumber ?? '',
        className: classEntity?.name ?? '',
        gradeName: gradeEntity?.name ?? '',
        taskTitle: taskEntity?.title ?? '',
        scaleName: taskEntity?.scale?.name ?? '',
      };
    });

    const total = all.length;
    const start = (page - 1) * pageSize;
    const data = all.slice(start, start + pageSize);
    return { data, total };
  }
}

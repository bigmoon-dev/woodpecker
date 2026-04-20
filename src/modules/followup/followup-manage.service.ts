import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Interview } from '../../entities/interview/interview.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { DataScopeFilter, DataScope } from '../auth/data-scope-filter';
import { EncryptionService } from '../core/encryption.service';
import { ConfigReloadService } from '../core/config-reload.service';

export interface FollowupStudent {
  studentId: string;
  studentName: string;
  studentNumber: string;
  className: string;
  gradeName: string;
  riskLevel: string;
  riskColor: string;
  interviewCount: number;
  lastInterviewDate: Date | null;
  status: string;
}

@Injectable()
export class FollowupManageService {
  constructor(
    @InjectRepository(TaskResult)
    private resultRepo: Repository<TaskResult>,
    @InjectRepository(TaskAnswer)
    private answerRepo: Repository<TaskAnswer>,
    @InjectRepository(Interview)
    private interviewRepo: Repository<Interview>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(Class)
    private classRepo: Repository<Class>,
    @InjectRepository(Grade)
    private gradeRepo: Repository<Grade>,
    private dataScopeFilter: DataScopeFilter,
    private encryptionService: EncryptionService,
    private configService: ConfigReloadService,
  ) {}

  async getStudents(
    dataScope: DataScope,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: FollowupStudent[]; total: number }> {
    const threshold = this.configService.get<string>(
      'followup.risk_threshold',
      'yellow',
    );
    const colorSet = threshold === 'red' ? ['red'] : ['yellow', 'red'];

    let scopeStudentIds: string[] | null = null;
    if (dataScope.scope !== 'all') {
      scopeStudentIds = await this.dataScopeFilter.getStudentIds(dataScope);
      if (scopeStudentIds.length === 0) return { data: [], total: 0 };
    }

    const riskAnswers = await this.answerRepo
      .createQueryBuilder('ta')
      .getMany();

    const riskAnswerIds = riskAnswers.map((a) => a.id);
    const riskResults =
      riskAnswerIds.length > 0
        ? await this.resultRepo.find({
            where: riskAnswerIds.map((id) => ({ answerId: id })),
          })
        : [];

    const riskStudentMap = new Map<string, { color: string; level: string }>();
    for (const r of riskResults) {
      if (!colorSet.includes(r.color)) continue;
      const answer = riskAnswers.find((a) => a.id === r.answerId);
      if (!answer) continue;
      const existing = riskStudentMap.get(answer.studentId);
      if (!existing) {
        riskStudentMap.set(answer.studentId, {
          color: r.color,
          level: r.level,
        });
      }
    }

    const interviews = await this.interviewRepo.find();
    const interviewStudentMap = new Map<
      string,
      { count: number; lastDate: Date | null }
    >();
    for (const iv of interviews) {
      const existing = interviewStudentMap.get(iv.studentId);
      if (existing) {
        existing.count++;
        if (
          iv.interviewDate &&
          (!existing.lastDate || iv.interviewDate > existing.lastDate)
        ) {
          existing.lastDate = iv.interviewDate;
        }
      } else {
        interviewStudentMap.set(iv.studentId, {
          count: 1,
          lastDate: iv.interviewDate ?? null,
        });
      }
    }

    const allStudentIds = new Set([
      ...riskStudentMap.keys(),
      ...interviewStudentMap.keys(),
    ]);

    let filteredIds = [...allStudentIds];
    if (scopeStudentIds) {
      const scopeSet = new Set(scopeStudentIds);
      filteredIds = filteredIds.filter((id) => scopeSet.has(id));
    }

    if (filteredIds.length === 0) return { data: [], total: 0 };

    const total = filteredIds.length;
    const start = (page - 1) * pageSize;
    const pageIds = filteredIds.slice(start, start + pageSize);

    const piiMap = await this.encryptionService.batchDecrypt(pageIds);
    const students = await this.studentRepo.find({
      where: { id: In(pageIds) },
    });
    const classIds = [...new Set(students.map((s) => s.classId))];
    const classes =
      classIds.length > 0
        ? await this.classRepo.find({ where: { id: In(classIds) } })
        : [];
    const gradeIds = [...new Set(classes.map((c) => c.gradeId))];
    const grades =
      gradeIds.length > 0
        ? await this.gradeRepo.find({ where: { id: In(gradeIds) } })
        : [];
    const classMap = new Map(classes.map((c) => [c.id, c]));
    const gradeMap = new Map(grades.map((g) => [g.id, g]));
    const studentClassMap = new Map(students.map((s) => [s.id, s.classId]));

    const data: FollowupStudent[] = pageIds.map((id) => {
      const pii = piiMap.get(id);
      const classId = studentClassMap.get(id);
      const cls = classId ? classMap.get(classId) : undefined;
      const grade = cls ? gradeMap.get(cls.gradeId) : undefined;
      const risk = riskStudentMap.get(id);
      const interview = interviewStudentMap.get(id);
      return {
        studentId: id,
        studentName: pii?.name ?? '',
        studentNumber: pii?.studentNumber ?? '',
        className: cls?.name ?? '',
        gradeName: grade?.name ?? '',
        riskLevel: risk?.level ?? '',
        riskColor: risk?.color ?? '',
        interviewCount: interview?.count ?? 0,
        lastInterviewDate: interview?.lastDate ?? null,
        status: risk ? 'at_risk' : interview ? 'interviewed' : '',
      };
    });

    return { data, total };
  }

  async getStudentDetail(
    studentId: string,
    dataScope: DataScope,
  ): Promise<any> {
    if (dataScope.scope !== 'all') {
      const allowedIds = await this.dataScopeFilter.getStudentIds(dataScope);
      if (!allowedIds.includes(studentId)) {
        throw new ForbiddenException('No access to this student');
      }
    }

    const pii = await this.encryptionService.batchDecrypt([studentId]);
    const studentData = pii.get(studentId);
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const cls = await this.classRepo.findOne({
      where: { id: student.classId },
    });
    const grade = cls
      ? await this.gradeRepo.findOne({ where: { id: cls.gradeId } })
      : null;

    const interviews = await this.interviewRepo.find({
      where: { studentId },
      order: { interviewDate: 'DESC' },
    });

    const answers = await this.answerRepo.find({ where: { studentId } });
    const answerIds = answers.map((a) => a.id);
    const results =
      answerIds.length > 0
        ? await this.resultRepo.find({
            where: answerIds.map((id) => ({ answerId: id })),
          })
        : [];

    return {
      studentId,
      studentName: studentData?.name ?? '',
      studentNumber: studentData?.studentNumber ?? '',
      className: cls?.name ?? '',
      gradeName: grade?.name ?? '',
      interviews: interviews.map((iv) => ({
        id: iv.id,
        interviewDate: iv.interviewDate,
        riskLevel: iv.riskLevel,
        status: iv.status,
        structuredSummary: iv.structuredSummary,
      })),
      results: results.map((r) => ({
        id: r.id,
        totalScore: r.totalScore,
        dimensionScores: r.dimensionScores,
        level: r.level,
        color: r.color,
        createdAt: r.createdAt,
      })),
    };
  }

  getThreshold(): { threshold: string } {
    const val = this.configService.get('followup.risk_threshold', 'yellow');
    return { threshold: val };
  }

  async updateThreshold(
    threshold: string,
    updatedBy: string,
  ): Promise<{ threshold: string; oldValue: string }> {
    const oldValue = this.configService.get(
      'followup.risk_threshold',
      'yellow',
    );
    await this.configService.set(
      'followup.risk_threshold',
      threshold,
      updatedBy,
    );
    return { threshold, oldValue };
  }
}

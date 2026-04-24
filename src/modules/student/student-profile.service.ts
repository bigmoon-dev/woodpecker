import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { AlertHandlingRecord } from '../../entities/audit/alert-handling-record.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Interview } from '../../entities/interview/interview.entity';
import { FollowUpReminder } from '../../entities/interview/follow-up-reminder.entity';
import { User } from '../../entities/auth/user.entity';
import { EncryptionService } from '../core/encryption.service';

export interface StudentProfile {
  student: {
    id: string;
    name: string;
    gradeName: string;
    className: string;
    gender: string | null;
  };
  currentRiskLevel: string | null;
  lastAssessmentDate: Date | null;
  assessmentHistory: TaskResult[];
  interviewHistory: Interview[];
  alertHistory: (AlertRecord & { handlingHistory: AlertHandlingRecord[] })[];
  pendingFollowups: FollowUpReminder[];
  riskLevelSuggestion: {
    suggestedLevel: string;
    basedOnResultId: string;
    previousLevel: string;
  } | null;
}

@Injectable()
export class StudentProfileService {
  constructor(
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(Class)
    private classRepo: Repository<Class>,
    @InjectRepository(Grade)
    private gradeRepo: Repository<Grade>,
    @InjectRepository(AlertRecord)
    private alertRepo: Repository<AlertRecord>,
    @InjectRepository(AlertHandlingRecord)
    private handlingRepo: Repository<AlertHandlingRecord>,
    @InjectRepository(TaskResult)
    private resultRepo: Repository<TaskResult>,
    @InjectRepository(TaskAnswer)
    private answerRepo: Repository<TaskAnswer>,
    @InjectRepository(Interview)
    private interviewRepo: Repository<Interview>,
    @InjectRepository(FollowUpReminder)
    private followupRepo: Repository<FollowUpReminder>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private encryptionService: EncryptionService,
  ) {}

  async getProfile(studentId: string): Promise<StudentProfile> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        studentId,
      )
    ) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: ['class'],
    });
    if (!student) throw new NotFoundException(`Student ${studentId} not found`);

    let gradeName = '';
    if (student.class?.gradeId) {
      const grade = await this.gradeRepo.findOne({
        where: { id: student.class.gradeId },
      });
      gradeName = grade?.name ?? '';
    }

    const pii = await this.encryptionService.batchDecrypt([studentId]);
    const studentPii = pii.get(studentId);

    const className = student.class?.name ?? '';

    const [alerts, interviews, followups, answers] = await Promise.all([
      this.alertRepo.find({
        where: { studentId },
        order: { createdAt: 'DESC' },
      }),
      this.interviewRepo.find({
        where: { studentId },
        order: { createdAt: 'DESC' },
      }),
      this.followupRepo.find({
        where: { studentId, completed: false },
        order: { reminderDate: 'ASC' },
      }),
      this.answerRepo.find({ where: { studentId } }),
    ]);

    const answerIds = answers.map((a) => a.id);
    const results =
      answerIds.length > 0
        ? await this.resultRepo.find({
            where: answerIds.map((id) => ({ answerId: id })),
            order: { createdAt: 'DESC' },
          })
        : [];

    const currentRiskLevel = alerts.length > 0 ? alerts[0].level : null;

    const lastAssessmentDate = results.length > 0 ? results[0].createdAt : null;

    const alertsWithHistory = await Promise.all(
      alerts.map(async (alert) => {
        const handlingHistory = await this.handlingRepo.find({
          where: { alertId: alert.id },
          order: { createdAt: 'ASC' },
        });
        return { ...alert, handlingHistory };
      }),
    );

    let riskLevelSuggestion: StudentProfile['riskLevelSuggestion'] = null;
    if (results.length >= 2 && currentRiskLevel) {
      const latest = results[0];
      const latestColor = latest.color;
      if (latestColor && latestColor !== currentRiskLevel) {
        riskLevelSuggestion = {
          suggestedLevel: latestColor,
          basedOnResultId: latest.id,
          previousLevel: currentRiskLevel,
        };
      }
    }

    return {
      student: {
        id: student.id,
        name: studentPii?.name ?? '',
        gradeName,
        className,
        gender: student.gender,
      },
      currentRiskLevel,
      lastAssessmentDate,
      assessmentHistory: results,
      interviewHistory: interviews,
      alertHistory: alertsWithHistory,
      pendingFollowups: followups,
      riskLevelSuggestion,
    };
  }

  async getPendingFollowups(): Promise<
    {
      id: string;
      studentId: string;
      studentName: string;
      className: string;
      alertLevel: string;
      alertCreatedAt: Date;
      status: string;
    }[]
  > {
    const followups = await this.followupRepo.find({
      where: { completed: false },
      order: { reminderDate: 'ASC' },
    });

    if (followups.length === 0) return [];

    const followupStudentIds = [...new Set(followups.map((f) => f.studentId))];

    const users = await this.userRepo.find({
      where: { id: In(followupStudentIds) },
      select: ['id', 'studentId'],
    });
    const userToStudent = new Map<string, string>();
    for (const u of users) {
      if (u.studentId) userToStudent.set(u.id, u.studentId);
    }

    const studentIds = [
      ...new Set(followupStudentIds.map((id) => userToStudent.get(id) ?? id)),
    ];
    const piiMap = await this.encryptionService.batchDecrypt(studentIds);

    const students = await this.studentRepo.find({
      where: studentIds.map((id) => ({ id })),
      relations: ['class'],
    });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const alerts = await this.alertRepo.find({
      where: studentIds.map((id) => ({ studentId: id })),
      order: { createdAt: 'DESC' },
    });
    const latestAlertMap = new Map<string, AlertRecord>();
    for (const a of alerts) {
      if (!latestAlertMap.has(a.studentId)) {
        latestAlertMap.set(a.studentId, a);
      }
    }

    return followups.map((f) => {
      const realStudentId = userToStudent.get(f.studentId) ?? f.studentId;
      const student = studentMap.get(realStudentId);
      const pii = piiMap.get(realStudentId);
      const alert = latestAlertMap.get(realStudentId);

      let status = 'pending';
      if (f.interviewId) status = 'interviewed';
      if (alert?.status === 'followup') status = 'followup';

      return {
        id: f.id,
        studentId: f.studentId,
        studentName: pii?.name ?? '',
        className: student?.class?.name ?? '',
        alertLevel: alert?.level ?? '',
        alertCreatedAt: alert?.createdAt ?? f.createdAt,
        status,
      };
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { AlertHandlingRecord } from '../../entities/audit/alert-handling-record.entity';
import { AlertNotification } from '../../entities/audit/alert-notification.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { HookBus } from '../plugin/hook-bus';
import { DataScopeFilter, DataScope } from '../auth/data-scope-filter';
import { ResultService } from '../result/result.service';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { EncryptionService } from '../core/encryption.service';

export interface FollowupResponse {
  alert: AlertRecord;
  retestComparisonUrl: string | null;
}

@Injectable()
export class AlertService {
  constructor(
    @InjectRepository(AlertRecord)
    private alertRepo: Repository<AlertRecord>,
    @InjectRepository(AlertHandlingRecord)
    private handlingRepo: Repository<AlertHandlingRecord>,
    @InjectRepository(AlertNotification)
    private notificationRepo: Repository<AlertNotification>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(Class)
    private classRepo: Repository<Class>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(TaskResult)
    private resultRepo: Repository<TaskResult>,
    @InjectRepository(TaskAnswer)
    private answerRepo: Repository<TaskAnswer>,
    private hookBus: HookBus,
    private dataScopeFilter: DataScopeFilter,
    private resultService: ResultService,
    private encryptionService: EncryptionService,
  ) {}

  async findAll(
    dataScope: DataScope,
    status?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: any[]; total: number }> {
    const where: Record<string, any> = status ? { status } : {};

    if (dataScope.scope !== 'all') {
      const studentIds = await this.dataScopeFilter.getStudentIds(dataScope);
      if (studentIds.length === 0) return { data: [], total: 0 };

      where.studentId = In(studentIds);
    }

    const [records, total] = await this.alertRepo.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    const alertUserIds = [...new Set(records.map((r) => r.studentId))];
    const users =
      alertUserIds.length > 0
        ? await this.userRepo.find({
            where: { id: In(alertUserIds) },
            select: ['id', 'studentId'],
          })
        : [];
    const userStudentMap = new Map(
      users.filter((u) => u.studentId).map((u) => [u.id, u.studentId]),
    );

    const dbStudentIds = [...new Set(userStudentMap.values())];
    const piiMap =
      dbStudentIds.length > 0
        ? await this.encryptionService.batchDecrypt(dbStudentIds)
        : new Map<string, { name: string; studentNumber: string }>();

    const data = records.map((r) => {
      const dbStudentId = userStudentMap.get(r.studentId);
      const pii = dbStudentId ? piiMap.get(dbStudentId) : undefined;
      return {
        ...r,
        studentName: pii?.name ?? '',
      };
    });

    return { data, total };
  }

  async findOne(id: string): Promise<AlertRecord> {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    return alert;
  }

  async create(data: Partial<AlertRecord>): Promise<AlertRecord> {
    const alert = this.alertRepo.create(data);
    return this.alertRepo.save(alert);
  }

  async handle(
    id: string,
    handledById: string,
    handleNote: string,
  ): Promise<AlertRecord> {
    const alert = await this.findOne(id);
    alert.status = 'handled';
    alert.handledById = handledById;
    alert.handleNote = handleNote;
    alert.handledAt = new Date();
    const saved = await this.alertRepo.save(alert);

    await this.handlingRepo.save(
      this.handlingRepo.create({
        alertId: saved.id,
        handledById,
        action: 'handle',
        note: handleNote,
      }),
    );

    await this.hookBus
      .emit('on:alert.resolved', {
        alertId: saved.id,
        status: saved.status,
        handledById: saved.handledById,
        handleNote: saved.handleNote,
      })
      .catch(() => {});
    return saved;
  }

  async followup(
    id: string,
    handledById: string,
    handleNote: string,
  ): Promise<FollowupResponse> {
    const alert = await this.findOne(id);
    alert.status = 'followup';
    alert.handledById = handledById;
    alert.handleNote = handleNote;
    alert.handledAt = new Date();
    const saved = await this.alertRepo.save(alert);

    await this.handlingRepo.save(
      this.handlingRepo.create({
        alertId: saved.id,
        handledById,
        action: 'followup',
        note: handleNote,
      }),
    );

    await this.hookBus
      .emit('on:alert.resolved', {
        alertId: saved.id,
        status: saved.status,
        handledById: saved.handledById,
        handleNote: saved.handleNote,
      })
      .catch(() => {});

    let retestComparisonUrl: string | null = null;
    try {
      const result = await this.resultRepo.findOne({
        where: { id: saved.resultId },
      });
      if (result) {
        const answer = await this.answerRepo
          .createQueryBuilder('ta')
          .innerJoinAndSelect('ta.task', 'task')
          .where('ta.id = :answerId', { answerId: result.answerId })
          .getOne();
        if (answer?.task?.scaleId) {
          retestComparisonUrl = `/api/results/compare?studentId=${saved.studentId}&scaleId=${answer.task.scaleId}`;
        }
      }
    } catch {
      retestComparisonUrl = null;
    }

    return { alert: saved, retestComparisonUrl };
  }

  async triggerAlert(
    resultId: string,
    studentId: string,
    level: string,
  ): Promise<AlertRecord> {
    const saved = await this.create({
      resultId,
      studentId,
      level,
      status: 'pending',
    });
    await this.hookBus
      .emit('on:alert.triggered', {
        alertId: saved.id,
        studentId: saved.studentId,
        level: saved.level,
      })
      .catch(() => {});
    if (level === 'red' || level === 'yellow') {
      await this.notifyRelevantUsers(saved.id, studentId, level);
    }
    return saved;
  }

  private async notifyRelevantUsers(
    alertId: string,
    studentId: string,
    level: string,
  ) {
    try {
      const student = await this.studentRepo.findOne({
        where: { id: studentId },
      });
      if (!student) return;

      const targetRoleNames =
        level === 'red' ? ['心理老师', '班主任'] : ['心理老师'];
      const users = await this.userRepo.find({ relations: ['roles'] });
      const targetUsers = users.filter((u) =>
        u.roles?.some((r) => targetRoleNames.includes(r.name)),
      );

      const notifications = targetUsers.map((u) =>
        this.notificationRepo.create({
          alertId,
          targetUserId: u.id,
          targetRole: u.roles.find((r) => targetRoleNames.includes(r.name))
            ?.name,
          read: false,
        }),
      );
      if (notifications.length > 0) {
        await this.notificationRepo.save(notifications);
      }
    } catch (err) {
      console.error('[AlertService] Failed to notify users:', err);
    }
  }

  async findNotifications(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: AlertNotification[]; total: number }> {
    const [data, total] = await this.notificationRepo.findAndCount({
      where: { targetUserId: userId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    return { data, total };
  }

  async markNotificationRead(id: string): Promise<AlertNotification> {
    const notif = await this.notificationRepo.findOne({ where: { id } });
    if (!notif) throw new NotFoundException(`Notification ${id} not found`);
    notif.read = true;
    return this.notificationRepo.save(notif);
  }

  async findHandlingHistory(alertId: string): Promise<AlertHandlingRecord[]> {
    return this.handlingRepo.find({
      where: { alertId },
      order: { createdAt: 'ASC' },
    });
  }

  async findByStudent(
    studentId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: any[]; total: number }> {
    const [records, total] = await this.alertRepo.findAndCount({
      where: { studentId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    const data = records.map((r) => ({ ...r }));
    return { data, total };
  }
}

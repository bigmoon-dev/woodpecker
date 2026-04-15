import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { AlertNotification } from '../../entities/audit/alert-notification.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { HookBus } from '../plugin/hook-bus';
import { DataScopeFilter, DataScope } from '../auth/data-scope-filter';

@Injectable()
export class AlertService {
  constructor(
    @InjectRepository(AlertRecord)
    private alertRepo: Repository<AlertRecord>,
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
    private hookBus: HookBus,
    private dataScopeFilter: DataScopeFilter,
  ) {}

  async findAll(
    dataScope: DataScope,
    status?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: AlertRecord[]; total: number }> {
    const where: Record<string, any> = status ? { status } : {};

    if (dataScope.scope !== 'all') {
      const studentIds = await this.dataScopeFilter.getStudentIds(dataScope);
      if (studentIds.length === 0) return { data: [], total: 0 };

      where.studentId = In(studentIds);
    }

    const [data, total] = await this.alertRepo.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
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
  ): Promise<AlertRecord> {
    const alert = await this.findOne(id);
    alert.status = 'followup';
    alert.handledById = handledById;
    alert.handleNote = handleNote;
    alert.handledAt = new Date();
    const saved = await this.alertRepo.save(alert);
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
}

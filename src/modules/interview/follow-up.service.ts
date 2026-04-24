/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { FollowUpReminder } from '../../entities/interview/follow-up-reminder.entity';
import { User } from '../../entities/auth/user.entity';
import { EncryptionService } from '../core/encryption.service';

@Injectable()
export class FollowUpService {
  constructor(
    @InjectRepository(FollowUpReminder)
    private reminderRepo: Repository<FollowUpReminder>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private encryptionService: EncryptionService,
  ) {}

  async create(dto: any): Promise<FollowUpReminder> {
    const data: Partial<FollowUpReminder> = { ...dto };
    if (dto.reminderDate) {
      data.reminderDate = new Date(dto.reminderDate as string | number | Date);
    }
    const reminder = this.reminderRepo.create(data);
    return this.reminderRepo.save(reminder);
  }

  async findByStudent(studentId: string): Promise<FollowUpReminder[]> {
    return this.reminderRepo.find({
      where: { studentId },
      order: { reminderDate: 'DESC' },
    });
  }

  async markComplete(id: string): Promise<FollowUpReminder> {
    const reminder = await this.reminderRepo.findOne({ where: { id } });
    if (!reminder)
      throw new NotFoundException(`Follow-up reminder ${id} not found`);
    reminder.completed = true;
    return this.reminderRepo.save(reminder);
  }

  async findPending(): Promise<any[]> {
    const reminders = await this.reminderRepo.find({
      where: {
        reminderDate: LessThanOrEqual(new Date()),
        completed: false,
      },
      order: { reminderDate: 'ASC' },
    });

    const studentIds = [
      ...new Set(reminders.map((r) => r.studentId).filter(Boolean)),
    ];
    const pii = new Map<string, { name: string; studentNumber: string }>();
    const userToStudent = new Map<string, string>();

    if (studentIds.length > 0) {
      const users = await this.userRepo.find({
        where: { id: In(studentIds) },
        select: ['id', 'studentId'],
      });
      for (const u of users) {
        if (u.studentId) userToStudent.set(u.id, u.studentId);
      }
      const realStudentIds = [...new Set(userToStudent.values())];
      if (realStudentIds.length > 0) {
        const decrypted =
          await this.encryptionService.batchDecrypt(realStudentIds);
        for (const [k, v] of decrypted) pii.set(k, v);
      }
    }

    return reminders.map((r) => ({
      ...r,
      studentName:
        r.studentId && userToStudent.has(r.studentId)
          ? (pii.get(userToStudent.get(r.studentId)!)?.name ?? '')
          : '',
    }));
  }
}

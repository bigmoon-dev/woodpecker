/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { FollowUpReminder } from '../../entities/interview/follow-up-reminder.entity';

@Injectable()
export class FollowUpService {
  constructor(
    @InjectRepository(FollowUpReminder)
    private reminderRepo: Repository<FollowUpReminder>,
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

  async findPending(): Promise<FollowUpReminder[]> {
    return this.reminderRepo.find({
      where: {
        reminderDate: LessThanOrEqual(new Date()),
        completed: false,
      },
      order: { reminderDate: 'ASC' },
    });
  }
}

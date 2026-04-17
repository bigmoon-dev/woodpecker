import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview } from '../../entities/interview/interview.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { AlertRecord } from '../../entities/audit/alert-record.entity';

export interface TimelineEvent {
  type: string;
  date: Date;
  summary: string;
  details: Record<string, unknown>;
}

@Injectable()
export class TimelineService {
  constructor(
    @InjectRepository(Interview)
    private interviewRepo: Repository<Interview>,
    @InjectRepository(TaskResult)
    private resultRepo: Repository<TaskResult>,
    @InjectRepository(AlertRecord)
    private alertRepo: Repository<AlertRecord>,
  ) {}

  async getTimeline(studentId: string): Promise<{ events: TimelineEvent[] }> {
    const events: TimelineEvent[] = [];

    const interviews = await this.interviewRepo.find({
      where: { studentId },
      order: { interviewDate: 'DESC' },
    });

    for (const iv of interviews) {
      events.push({
        type: 'interview',
        date: iv.interviewDate,
        summary: `Interview - ${iv.status}`,
        details: { id: iv.id, status: iv.status, riskLevel: iv.riskLevel },
      });
    }

    const results = await this.resultRepo
      .createQueryBuilder('tr')
      .innerJoinAndSelect('tr.answer', 'ta')
      .where('ta.studentId = :studentId', { studentId })
      .orderBy('tr.createdAt', 'DESC')
      .getMany();

    for (const r of results) {
      events.push({
        type: 'task_result',
        date: r.createdAt,
        summary: `Assessment - ${r.level}`,
        details: {
          id: r.id,
          level: r.level,
          color: r.color,
          totalScore: r.totalScore,
        },
      });
    }

    const alerts = await this.alertRepo.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });

    for (const a of alerts) {
      events.push({
        type: 'alert',
        date: a.createdAt,
        summary: `Alert - ${a.level}`,
        details: { id: a.id, level: a.level, status: a.status },
      });
    }

    events.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return { events };
  }
}

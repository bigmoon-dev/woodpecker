import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Task } from '../../entities/task/task.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { TaskAnswerItem } from '../../entities/task/task-answer-item.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { Student } from '../../entities/org/student.entity';
import { ScoringEngine } from '../scoring/scoring.engine';
import { ScaleService } from '../scale/scale.service';
import { ScoringRule } from '../../entities/scale/scoring-rule.entity';
import { ScoreRange } from '../../entities/scale/score-range.entity';
import { HookBus } from '../plugin/hook-bus';
import { AlertService } from '../alert/alert.service';

export interface ScopedQuery {
  createdById?: string;
  classId?: string;
  status?: string;
}

@Injectable()
export class TaskService {
  private alertService: AlertService | null = null;

  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    @InjectRepository(TaskAnswer)
    private answerRepo: Repository<TaskAnswer>,
    @InjectRepository(TaskAnswerItem)
    private answerItemRepo: Repository<TaskAnswerItem>,
    @InjectRepository(TaskResult)
    private resultRepo: Repository<TaskResult>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    private scoringEngine: ScoringEngine,
    private scaleService: ScaleService,
    private hookBus: HookBus,
    private dataSource: DataSource,
  ) {}

  setAlertService(alertService: AlertService) {
    this.alertService = alertService;
  }

  async create(data: Partial<Task>): Promise<Task> {
    const task = this.taskRepo.create({ ...data, status: 'draft' });
    const saved = await this.taskRepo.save(task);
    await this.hookBus
      .emit('on:task.created', {
        taskId: saved.id,
        scaleId: saved.scaleId,
        createdBy: saved.createdById,
      })
      .catch(() => {});
    return saved;
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['scale', 'scale.items', 'scale.items.options'],
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async findAll(
    page = 1,
    pageSize = 20,
    scope?: ScopedQuery,
  ): Promise<{ data: Task[]; total: number }> {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.scale', 'scale')
      .orderBy('task.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (scope?.createdById) {
      qb.andWhere('task.createdById = :createdById', {
        createdById: scope.createdById,
      });
    }

    if (scope?.classId) {
      qb.andWhere(
        'task.targetIds @> :classId::jsonb AND task.status = :status',
        { classId: JSON.stringify([scope.classId]), status: 'published' },
      );
    } else if (scope?.status) {
      qb.andWhere('task.status = :status', { status: scope.status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getStudentClassId(userId: string): Promise<string | null> {
    const user: { studentId?: string } | null = await this.dataSource
      .getRepository('users')
      .createQueryBuilder('u')
      .select('u.studentId')
      .where('u.id = :userId', { userId })
      .getRawOne();

    if (!user?.studentId) return null;

    const student = await this.studentRepo.findOne({
      where: { id: user.studentId },
      select: ['classId'],
    });
    return student?.classId ?? null;
  }

  async update(
    id: string,
    data: Partial<Task>,
    userId?: string,
  ): Promise<Task> {
    const task = await this.findOne(id);

    if (task.status !== 'draft') {
      throw new BadRequestException(
        `Cannot update task in ${task.status} status`,
      );
    }

    if (userId && task.createdById !== userId) {
      throw new BadRequestException(
        'Only the task creator can update this task',
      );
    }

    Object.assign(task, data);
    return this.taskRepo.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);
    if (task.status !== 'draft') {
      throw new BadRequestException(
        `Cannot delete task in ${task.status} status`,
      );
    }
    await this.taskRepo.delete(id);
  }

  async publish(id: string): Promise<Task> {
    const task = await this.findOne(id);
    if (task.status !== 'draft') {
      throw new BadRequestException(
        `Cannot publish task in ${task.status} status. Only draft tasks can be published.`,
      );
    }
    task.status = 'published';
    return this.taskRepo.save(task);
  }

  async complete(id: string): Promise<Task> {
    const task = await this.findOne(id);
    if (task.status !== 'published') {
      throw new BadRequestException(
        `Cannot complete task in ${task.status} status. Only published tasks can be completed.`,
      );
    }
    task.status = 'completed';
    return this.taskRepo.save(task);
  }

  async submitAnswers(
    taskId: string,
    studentId: string,
    items: { itemId: string; optionId: string }[],
  ): Promise<TaskResult> {
    return this.dataSource.transaction(async (manager) => {
      const task = await manager.findOne(Task, {
        where: { id: taskId },
      });
      if (!task) throw new NotFoundException(`Task ${taskId} not found`);

      if (task.status !== 'published') {
        throw new BadRequestException(
          `Cannot submit answers for task in ${task.status} status`,
        );
      }

      let answer = await manager.findOne(TaskAnswer, {
        where: { taskId, studentId },
      });

      if (answer && answer.status === 'submitted') {
        throw new BadRequestException(
          'Answers already submitted for this task',
        );
      }

      if (!answer) {
        answer = manager.create(TaskAnswer, {
          taskId,
          studentId,
          status: 'in_progress',
        });
        answer = await manager.save(answer);
      }

      await manager.delete(TaskAnswerItem, { answerId: answer.id });
      const answerItems = items.map((item) =>
        manager.create(TaskAnswerItem, {
          answerId: answer.id,
          itemId: item.itemId,
          optionId: item.optionId,
          score: 0,
        }),
      );
      await manager.save(answerItems);

      const scale = await this.scaleService.findOne(task.scaleId);
      const scaleDef = {
        id: scale.id,
        items: scale.items.map((i) => ({
          id: i.id,
          dimension: i.dimension,
          reverseScore: i.reverseScore,
          options: i.options.map((o) => ({
            id: o.id,
            scoreValue: o.scoreValue,
          })),
        })),
        scoringRules:
          (scale.scoringRules as ScoringRule[] | undefined)?.map(
            (r: ScoringRule) => ({
              dimension: r.dimension,
              formulaType: r.formulaType,
              weight: r.weight,
            }),
          ) || [],
        scoreRanges:
          (scale.scoreRanges as ScoreRange[] | undefined)?.map(
            (r: ScoreRange) => ({
              dimension: r.dimension,
              minScore: r.minScore,
              maxScore: r.maxScore,
              level: r.level,
              color: r.color,
              suggestion: r.suggestion,
            }),
          ) || [],
      };

      const scoringResult = this.scoringEngine.calculate(items, scaleDef);

      answer.status = 'submitted';
      answer.submittedAt = new Date();
      await manager.save(answer);

      const result = manager.create(TaskResult, {
        answerId: answer.id,
        totalScore: scoringResult.totalScore,
        dimensionScores: scoringResult.dimensionScores,
        level: scoringResult.level,
        color: scoringResult.color,
        suggestion: scoringResult.suggestion,
      });
      const saved = await manager.save(result);

      await this.hookBus
        .emit('on:assessment.submitted', {
          taskId,
          studentId,
          resultId: saved.id,
        })
        .catch(() => {});

      await this.hookBus.emit('on:result.calculated', {
        result: scoringResult,
        studentId,
        taskId,
      });

      if (
        this.alertService &&
        (saved.color === 'red' || saved.color === 'yellow')
      ) {
        await this.alertService
          .triggerAlert(saved.id, studentId, saved.color)
          .catch(() => {});
      }

      return saved;
    });
  }

  async getSubmissionStatus(
    taskId: string,
    studentId: string,
  ): Promise<{ submitted: boolean; status?: string }> {
    const answer = await this.answerRepo.findOne({
      where: { taskId, studentId },
    });
    if (!answer) return { submitted: false };
    return { submitted: true, status: answer.status };
  }
}

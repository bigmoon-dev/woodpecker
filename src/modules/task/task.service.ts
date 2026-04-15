import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../../entities/task/task.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { TaskAnswerItem } from '../../entities/task/task-answer-item.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { ScoringEngine } from '../scoring/scoring.engine';
import { ScaleService } from '../scale/scale.service';
import { ScoringRule } from '../../entities/scale/scoring-rule.entity';
import { ScoreRange } from '../../entities/scale/score-range.entity';
import { HookBus } from '../plugin/hook-bus';
import { AlertService } from '../alert/alert.service';

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
    private scoringEngine: ScoringEngine,
    private scaleService: ScaleService,
    private hookBus: HookBus,
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
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async findAll(
    page = 1,
    pageSize = 20,
  ): Promise<{ data: Task[]; total: number }> {
    const [data, total] = await this.taskRepo.findAndCount({
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    return { data, total };
  }

  async update(id: string, data: Partial<Task>): Promise<Task> {
    const task = await this.findOne(id);
    Object.assign(task, data);
    return this.taskRepo.save(task);
  }

  async remove(id: string): Promise<void> {
    await this.taskRepo.delete(id);
  }

  async publish(id: string): Promise<Task> {
    const task = await this.findOne(id);
    task.status = 'published';
    return this.taskRepo.save(task);
  }

  async complete(id: string): Promise<Task> {
    const task = await this.findOne(id);
    task.status = 'completed';
    return this.taskRepo.save(task);
  }

  async submitAnswers(
    taskId: string,
    studentId: string,
    items: { itemId: string; optionId: string }[],
  ): Promise<TaskResult> {
    const task = await this.findOne(taskId);

    let answer = await this.answerRepo.findOne({
      where: { taskId, studentId },
    });
    if (!answer) {
      answer = this.answerRepo.create({
        taskId,
        studentId,
        status: 'in_progress',
      });
      answer = await this.answerRepo.save(answer);
    }

    await this.answerItemRepo.delete({ answerId: answer.id });
    const answerItems = items.map((item) =>
      this.answerItemRepo.create({
        answerId: answer.id,
        itemId: item.itemId,
        optionId: item.optionId,
        score: 0,
      }),
    );
    await this.answerItemRepo.save(answerItems);

    const scale = await this.scaleService.findOne(task.scaleId);
    const scaleDef = {
      id: scale.id,
      items: scale.items.map((i) => ({
        id: i.id,
        dimension: i.dimension,
        reverseScore: i.reverseScore,
        options: i.options.map((o) => ({ id: o.id, scoreValue: o.scoreValue })),
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
    await this.answerRepo.save(answer);

    const result = this.resultRepo.create({
      answerId: answer.id,
      totalScore: scoringResult.totalScore,
      dimensionScores: scoringResult.dimensionScores,
      level: scoringResult.level,
      color: scoringResult.color,
      suggestion: scoringResult.suggestion,
    });
    const saved = await this.resultRepo.save(result);

    await this.hookBus
      .emit('on:assessment.submitted', {
        taskId: taskId,
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
  }
}

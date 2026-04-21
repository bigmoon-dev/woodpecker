/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Task } from '../../entities/task/task.entity';
import { AlertService } from '../alert/alert.service';

export interface GroupComparisonResult {
  beforeTaskId: string;
  afterTaskId: string;
  totalStudents: number;
  beforeStats: {
    avgScore: number;
    stdDev: number;
    levelDistribution: Record<string, number>;
  };
  afterStats: {
    avgScore: number;
    stdDev: number;
    levelDistribution: Record<string, number>;
  };
  delta: number;
  improvedRate: number;
  worsenedRate: number;
  stableRate: number;
  levelTransitions: Record<string, number>;
}

export interface StudentProgress {
  studentId: string;
  beforeScore: number | null;
  afterScore: number | null;
  delta: number | null;
  beforeLevel: string | null;
  afterLevel: string | null;
  trend: 'improved' | 'worsened' | 'stable' | 'no_data';
}

@Injectable()
export class InterventionAnalysisService {
  private alertService: AlertService | null = null;

  constructor(
    @InjectRepository(TaskResult)
    private resultRepo: Repository<TaskResult>,
    @InjectRepository(TaskAnswer)
    private answerRepo: Repository<TaskAnswer>,
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    private dataSource: DataSource,
  ) {}

  setAlertService(alertService: AlertService) {
    this.alertService = alertService;
  }

  async groupComparison(
    beforeTaskId: string,
    afterTaskId: string,
  ): Promise<GroupComparisonResult> {
    const beforeTask = await this.taskRepo.findOne({
      where: { id: beforeTaskId },
    });
    const afterTask = await this.taskRepo.findOne({
      where: { id: afterTaskId },
    });
    if (!beforeTask)
      throw new NotFoundException(`Task ${beforeTaskId} not found`);
    if (!afterTask)
      throw new NotFoundException(`Task ${afterTaskId} not found`);

    const beforeResults = await this.getTaskResults(beforeTaskId);
    const afterResults = await this.getTaskResults(afterTaskId);

    const beforeMap = new Map(beforeResults.map((r) => [r.studentId, r]));
    const afterMap = new Map(afterResults.map((r) => [r.studentId, r]));

    const allStudentIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);
    const totalStudents = allStudentIds.size;

    const beforeStats = this.computeStats(Array.from(beforeMap.values()));
    const afterStats = this.computeStats(Array.from(afterMap.values()));

    let improved = 0;
    let worsened = 0;
    let stable = 0;
    const levelTransitions: Record<string, number> = {};

    for (const studentId of allStudentIds) {
      const before = beforeMap.get(studentId);
      const after = afterMap.get(studentId);

      if (before && after) {
        const transition = `${before.level}→${after.level}`;
        levelTransitions[transition] = (levelTransitions[transition] || 0) + 1;

        if (after.totalScore > before.totalScore) improved++;
        else if (after.totalScore < before.totalScore) worsened++;
        else stable++;
      }
    }

    const matchedStudents = improved + worsened + stable;
    const delta = afterStats.avgScore - beforeStats.avgScore;

    return {
      beforeTaskId,
      afterTaskId,
      totalStudents,
      beforeStats,
      afterStats,
      delta: Math.round(delta * 100) / 100,
      improvedRate:
        matchedStudents > 0
          ? Math.round((improved / matchedStudents) * 10000) / 100
          : 0,
      worsenedRate:
        matchedStudents > 0
          ? Math.round((worsened / matchedStudents) * 10000) / 100
          : 0,
      stableRate:
        matchedStudents > 0
          ? Math.round((stable / matchedStudents) * 10000) / 100
          : 0,
      levelTransitions,
    };
  }

  async getStudentProgress(
    beforeTaskId: string,
    afterTaskId: string,
  ): Promise<StudentProgress[]> {
    const beforeResults = await this.getTaskResults(beforeTaskId);
    const afterResults = await this.getTaskResults(afterTaskId);

    const beforeMap = new Map(beforeResults.map((r) => [r.studentId, r]));
    const afterMap = new Map(afterResults.map((r) => [r.studentId, r]));

    const allStudentIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);

    return Array.from(allStudentIds).map((studentId) => {
      const beforeEntry = beforeMap.get(studentId);
      const afterEntry = afterMap.get(studentId);

      if (beforeEntry && afterEntry) {
        const delta = afterEntry.totalScore - beforeEntry.totalScore;
        let trend: StudentProgress['trend'] = 'stable';
        if (delta > 0) trend = 'improved';
        else if (delta < 0) trend = 'worsened';
        return {
          studentId,
          beforeScore: beforeEntry.totalScore,
          afterScore: afterEntry.totalScore,
          delta,
          beforeLevel: beforeEntry.level,
          afterLevel: afterEntry.level,
          trend,
        };
      }

      if (beforeEntry) {
        return {
          studentId,
          beforeScore: beforeEntry.totalScore,
          afterScore: null,
          delta: null,
          beforeLevel: beforeEntry.level,
          afterLevel: null,
          trend: 'no_data',
        };
      }

      const afterVal = afterMap.get(studentId)!;
      return {
        studentId,
        beforeScore: null,
        afterScore: afterVal.totalScore,
        delta: null,
        beforeLevel: null,
        afterLevel: afterVal.level,
        trend: 'no_data',
      };
    });
  }

  async detectTrendAlerts(taskId: string): Promise<number> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    const results = await this.getTaskResults(taskId);
    let alertCount = 0;

    for (const current of results) {
      const previousResults = await this.getPreviousResults(
        current.studentId,
        task.scaleId,
        current.createdAt,
      );

      if (previousResults.length === 0) continue;

      const previous = previousResults[0];
      if (
        previous.color === 'green' &&
        (current.color === 'yellow' || current.color === 'red')
      ) {
        if (this.alertService) {
          await this.alertService.create({
            studentId: current.studentId,
            resultId: '',
            level: current.color === 'red' ? 'red' : 'yellow',
            status: 'pending',
            handleNote: `趋势恶化预警: ${previous.level}→${current.level}`,
          });
        }
        alertCount++;
      }
    }

    return alertCount;
  }

  private async getTaskResults(taskId: string): Promise<
    {
      studentId: string;
      totalScore: number;
      level: string;
      color: string;
      createdAt: Date;
    }[]
  > {
    const rows = await this.dataSource.query(
      `SELECT ta."studentId" AS "studentId", tr."totalScore" AS "totalScore",
              tr.level, tr.color, tr."createdAt" AS "createdAt"
       FROM task_results tr
       JOIN task_answers ta ON tr."answerId" = ta.id
       WHERE ta."taskId" = $1 AND ta.status = 'submitted'
       ORDER BY tr."createdAt" ASC`,
      [taskId],
    );
    return rows;
  }

  private async getPreviousResults(
    studentId: string,
    scaleId: string,
    beforeDate: Date,
  ): Promise<{ level: string; color: string }[]> {
    const rows = await this.dataSource.query(
      `SELECT tr.level, tr.color
       FROM task_results tr
       JOIN task_answers ta ON tr."answerId" = ta.id
       JOIN tasks t ON ta."taskId" = t.id
       WHERE ta."studentId" = $1 AND t."scaleId" = $2 AND ta.status = 'submitted'
         AND tr."createdAt" < $3
       ORDER BY tr."createdAt" DESC
       LIMIT 1`,
      [studentId, scaleId, beforeDate],
    );
    return rows;
  }

  private computeStats(results: { totalScore: number; level: string }[]): {
    avgScore: number;
    stdDev: number;
    levelDistribution: Record<string, number>;
  } {
    if (results.length === 0) {
      return { avgScore: 0, stdDev: 0, levelDistribution: {} };
    }

    const scores = results.map((r) => r.totalScore);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance =
      scores.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / scores.length;

    const levelDistribution: Record<string, number> = {};
    for (const r of results) {
      levelDistribution[r.level] = (levelDistribution[r.level] || 0) + 1;
    }

    return {
      avgScore: Math.round(avg * 100) / 100,
      stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
      levelDistribution,
    };
  }
}

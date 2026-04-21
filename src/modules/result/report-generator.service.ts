/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ReportTemplate } from '../../entities/report/report-template.entity';

export interface GroupStatistics {
  taskId: string;
  totalStudents: number;
  avgScore: number;
  stdDev: number;
  levelDistribution: Record<string, number>;
  colorDistribution: Record<string, number>;
  dimensionAverages: Record<string, number>;
}

@Injectable()
export class ReportTemplateService {
  constructor(
    @InjectRepository(ReportTemplate)
    private templateRepo: Repository<ReportTemplate>,
  ) {}

  async create(dto: {
    name: string;
    description?: string;
    type?: string;
    schema: Record<string, any>;
  }): Promise<ReportTemplate> {
    const template = new ReportTemplate();
    template.name = dto.name;
    template.description = dto.description ?? null;
    template.type = dto.type ?? 'group';
    template.schema = dto.schema;
    template.isBuiltIn = false;
    return this.templateRepo.save(template);
  }

  async findAll(): Promise<ReportTemplate[]> {
    return this.templateRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<ReportTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template)
      throw new NotFoundException(`ReportTemplate ${id} not found`);
    return template;
  }

  async update(
    id: string,
    dto: Partial<{
      name: string;
      description: string;
      schema: Record<string, any>;
    }>,
  ): Promise<ReportTemplate> {
    const template = await this.findOne(id);
    if (template.isBuiltIn) {
      throw new Error('Cannot modify built-in report template');
    }
    if (dto.name !== undefined) template.name = dto.name;
    if (dto.description !== undefined) template.description = dto.description;
    if (dto.schema !== undefined) template.schema = dto.schema;
    return this.templateRepo.save(template);
  }

  async remove(id: string): Promise<void> {
    const template = await this.findOne(id);
    if (template.isBuiltIn) {
      throw new Error('Cannot delete built-in report template');
    }
    await this.templateRepo.delete(id);
  }
}

@Injectable()
export class ReportGeneratorService {
  constructor(
    @InjectRepository(ReportTemplate)
    private templateRepo: Repository<ReportTemplate>,
    private dataSource: DataSource,
  ) {}

  async getGroupStatistics(taskId: string): Promise<GroupStatistics> {
    const rows: any[] = await this.dataSource.query(
      `SELECT tr."totalScore", tr.level, tr.color, tr."dimensionScores"
       FROM task_results tr
       JOIN task_answers ta ON tr."answerId" = ta.id
       WHERE ta."taskId" = $1 AND ta.status = 'submitted'`,
      [taskId],
    );

    if (rows.length === 0) {
      return {
        taskId,
        totalStudents: 0,
        avgScore: 0,
        stdDev: 0,
        levelDistribution: {},
        colorDistribution: {},
        dimensionAverages: {},
      };
    }

    const scores = rows.map((r: any) => Number(r.totalScore));
    const avg =
      scores.reduce((s: number, v: number) => s + v, 0) / scores.length;
    const variance =
      scores.reduce((s: number, v: number) => s + Math.pow(v - avg, 2), 0) /
      scores.length;

    const levelDistribution: Record<string, number> = {};
    const colorDistribution: Record<string, number> = {};
    const dimensionScores: Record<string, number[]> = {};

    for (const row of rows) {
      levelDistribution[row.level] = (levelDistribution[row.level] || 0) + 1;
      colorDistribution[row.color] = (colorDistribution[row.color] || 0) + 1;

      if (row.dimensionScores) {
        const ds =
          typeof row.dimensionScores === 'string'
            ? JSON.parse(row.dimensionScores)
            : row.dimensionScores;
        for (const [key, value] of Object.entries(ds)) {
          if (!dimensionScores[key]) dimensionScores[key] = [];
          dimensionScores[key].push(Number(value));
        }
      }
    }

    const dimensionAverages: Record<string, number> = {};
    for (const [key, values] of Object.entries(dimensionScores)) {
      dimensionAverages[key] =
        Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) /
        100;
    }

    return {
      taskId,
      totalStudents: rows.length,
      avgScore: Math.round(avg * 100) / 100,
      stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
      levelDistribution,
      colorDistribution,
      dimensionAverages,
    };
  }

  async generateGroupReport(
    templateId: string,
    taskId: string,
  ): Promise<GroupStatistics> {
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
    });
    if (!template)
      throw new NotFoundException(`ReportTemplate ${templateId} not found`);

    return this.getGroupStatistics(taskId);
  }
}

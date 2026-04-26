/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewTemplate } from '../../entities/interview/interview-template.entity';
import { Interview } from '../../entities/interview/interview.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(InterviewTemplate)
    private templateRepo: Repository<InterviewTemplate>,
    @InjectRepository(Interview)
    private interviewRepo: Repository<Interview>,
  ) {}

  async create(dto: any): Promise<InterviewTemplate> {
    const template = this.templateRepo.create(dto);
    return this.templateRepo.save(
      template,
    ) as unknown as Promise<InterviewTemplate>;
  }

  async findAll(): Promise<InterviewTemplate[]> {
    return this.templateRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<InterviewTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return template;
  }

  async update(id: string, dto: any): Promise<InterviewTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    Object.assign(template, dto);
    return this.templateRepo.save(
      template,
    ) as unknown as Promise<InterviewTemplate>;
  }

  async delete(id: string): Promise<void> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException(`Template ${id} not found`);

    const refCount = await this.interviewRepo.count({
      where: { templateId: id },
    });
    if (refCount > 0) {
      throw new ConflictException(
        `模板正在被 ${refCount} 条访谈记录引用，无法删除`,
      );
    }

    if (template.filePath) {
      const abs = path.join(process.cwd(), 'public', template.filePath);
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {
        // ignore cleanup errors
      }
    }
    await this.templateRepo.remove(template);
  }

  async updateFilePath(
    id: string,
    filePath: string,
    originalName: string,
  ): Promise<InterviewTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException(`Template ${id} not found`);

    if (template.filePath) {
      const abs = path.join(process.cwd(), 'public', template.filePath);
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {
        // ignore cleanup errors
      }
    }

    template.filePath = filePath
      .replace(/^public[\\/]/, '')
      .replace(/\\/g, '/');
    template.description = template.description || originalName;
    return this.templateRepo.save(
      template,
    ) as unknown as Promise<InterviewTemplate>;
  }
}

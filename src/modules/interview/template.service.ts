/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewTemplate } from '../../entities/interview/interview-template.entity';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(InterviewTemplate)
    private templateRepo: Repository<InterviewTemplate>,
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
    await this.templateRepo.remove(template);
  }
}

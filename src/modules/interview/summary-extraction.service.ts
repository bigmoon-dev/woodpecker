import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview } from '../../entities/interview/interview.entity';
import { InterviewTemplate } from '../../entities/interview/interview-template.entity';
import { TemplateFieldSchema } from './interview.types';

@Injectable()
export class SummaryExtractionService {
  constructor(
    @InjectRepository(Interview)
    private interviewRepo: Repository<Interview>,
    @InjectRepository(InterviewTemplate)
    private templateRepo: Repository<InterviewTemplate>,
  ) {}

  async extract(interviewId: string): Promise<Interview> {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
    });
    if (!interview)
      throw new NotFoundException(`Interview ${interviewId} not found`);

    if (!interview.templateId) {
      throw new BadRequestException(
        `Interview ${interviewId} has no template assigned`,
      );
    }

    const template = await this.templateRepo.findOne({
      where: { id: interview.templateId },
    });
    if (!template)
      throw new NotFoundException(`Template ${interview.templateId} not found`);

    const ocrText = interview.ocrText ?? '';
    if (!ocrText.trim()) {
      throw new BadRequestException(
        `Interview ${interviewId} has no OCR text to extract from`,
      );
    }

    const fields = template.fields as TemplateFieldSchema[];
    if (!fields || fields.length === 0) {
      throw new BadRequestException(
        `Template ${template.id} has no fields defined`,
      );
    }

    const summary: Record<string, string> = {};
    for (const field of fields) {
      summary[field.key] = this.extractField(ocrText, field);
    }

    interview.structuredSummary = summary;
    return this.interviewRepo.save(interview);
  }

  private extractField(ocrText: string, field: TemplateFieldSchema): string {
    if (field.extractionRule?.pattern) {
      const match = ocrText.match(
        new RegExp(field.extractionRule.pattern, 's'),
      );
      if (match && match[1]) return match[1].trim();
    }

    if (field.extractionRule?.section) {
      const sectionText = this.extractSection(
        ocrText,
        field.extractionRule.section,
      );
      if (sectionText) return sectionText;
    }

    const labelPattern = `${field.label}[:：]\\s*(.+?)(?:\\n|$)`;
    const labelMatch = ocrText.match(new RegExp(labelPattern, 'i'));
    if (labelMatch && labelMatch[1]) return labelMatch[1].trim();

    return '';
  }

  private extractSection(ocrText: string, sectionHeader: string): string {
    const lines = ocrText.split('\n');
    let capturing = false;
    const captured: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (!capturing && trimmed.includes(sectionHeader)) {
        capturing = true;
        continue;
      }

      if (capturing) {
        if (
          /^[一二三四五六七八九十\d]+[、.．]/.test(trimmed) ||
          /^[A-Z][、.．]/.test(trimmed)
        ) {
          break;
        }
        captured.push(trimmed);
      }
    }

    return captured.join('\n').trim();
  }
}

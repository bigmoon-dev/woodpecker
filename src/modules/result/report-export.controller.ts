import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { SetMetadata } from '@nestjs/common';
import { ResultService } from './result.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskResult } from '../../entities/task/task-result.entity';

@Controller('api/plugins/report-export')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['result:read'])
export class ReportExportController {
  constructor(
    private resultService: ResultService,
    @InjectRepository(TaskResult)
    private resultRepo: Repository<TaskResult>,
  ) {}

  @Get(':resultId')
  async exportReport(@Param('resultId') resultId: string) {
    const result = await this.resultRepo.findOne({ where: { id: resultId } });
    if (!result) {
      throw new NotFoundException(`Result ${resultId} not found`);
    }

    const lines: string[] = [];
    lines.push(`Assessment Report`);
    lines.push(`================`);
    lines.push(`Result ID: ${result.id}`);
    lines.push(`Total Score: ${result.totalScore}`);
    lines.push(`Level: ${result.level}`);
    lines.push(`Color: ${result.color}`);

    if (result.dimensionScores) {
      lines.push('');
      lines.push(`Dimension Scores:`);
      for (const [dim, score] of Object.entries(result.dimensionScores)) {
        lines.push(`  ${dim}: ${score}`);
      }
    }

    if (result.suggestion) {
      lines.push('');
      lines.push(`Suggestion: ${result.suggestion}`);
    }

    lines.push('');
    lines.push(`Generated at: ${result.createdAt.toISOString()}`);

    return { report: lines.join('\n') };
  }
}

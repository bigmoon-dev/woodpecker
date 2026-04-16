/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ResultService } from './result.service';
import { InterventionAnalysisService } from './intervention-analysis.service';
import {
  ReportTemplateService,
  ReportGeneratorService,
} from './report-generator.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { ConsentGuard } from '../consent/consent.guard';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { SetMetadata } from '@nestjs/common';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    username: string;
    studentId?: string;
    roles: { name: string; permissions: { code: string }[] }[];
  };
  dataScope: {
    scope: 'own' | 'class' | 'grade' | 'all';
    userId: string;
    classId?: string;
    gradeId?: string;
  };
}

@Controller('api/results')
@UseGuards(JwtAuthGuard, RbacGuard, ConsentGuard)
@SetMetadata(REQUIRE_PERMISSION, ['result:read'])
export class ResultController {
  constructor(
    private resultService: ResultService,
    private interventionService: InterventionAnalysisService,
    private reportTemplateService: ReportTemplateService,
    private reportGeneratorService: ReportGeneratorService,
  ) {}

  @Get('me')
  async findMyResults(@Req() req: AuthenticatedRequest) {
    return this.resultService.findByStudent(req.user.studentId || req.user.id);
  }

  @Get('class/:classId')
  async findByClass(
    @Param('classId') classId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.resultService.findByClass(classId, query.page, query.pageSize);
  }

  @Get('grade/:gradeId')
  async findByGrade(
    @Param('gradeId') gradeId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.resultService.findByGrade(gradeId, query.page, query.pageSize);
  }

  @Get('compare')
  async compareResults(
    @Query('studentId') studentId: string,
    @Query('scaleId') scaleId: string,
  ) {
    return this.resultService.compareResults(studentId, scaleId);
  }

  @Get()
  async findByScope(@Req() req: AuthenticatedRequest) {
    return this.resultService.findByScope(req.dataScope);
  }

  @Get('intervention-comparison')
  async interventionComparison(
    @Query('beforeTaskId') beforeTaskId: string,
    @Query('afterTaskId') afterTaskId: string,
  ) {
    return this.interventionService.groupComparison(beforeTaskId, afterTaskId);
  }

  @Get('intervention-progress')
  async interventionProgress(
    @Query('beforeTaskId') beforeTaskId: string,
    @Query('afterTaskId') afterTaskId: string,
  ) {
    return this.interventionService.getStudentProgress(
      beforeTaskId,
      afterTaskId,
    );
  }

  @Post('scan-trend-alerts/:taskId')
  @SetMetadata(REQUIRE_PERMISSION, ['result:write'])
  async scanTrendAlerts(@Param('taskId') taskId: string) {
    const count = await this.interventionService.detectTrendAlerts(taskId);
    return { taskId, alertsCreated: count };
  }

  @Get('report-templates')
  async listReportTemplates() {
    return this.reportTemplateService.findAll();
  }

  @Post('report-templates')
  @SetMetadata(REQUIRE_PERMISSION, ['result:write'])
  async createReportTemplate(@Body() dto: any) {
    return this.reportTemplateService.create(dto);
  }

  @Get('report-templates/:id')
  async getReportTemplate(@Param('id') id: string) {
    return this.reportTemplateService.findOne(id);
  }

  @Put('report-templates/:id')
  @SetMetadata(REQUIRE_PERMISSION, ['result:write'])
  async updateReportTemplate(@Param('id') id: string, @Body() dto: any) {
    return this.reportTemplateService.update(id, dto);
  }

  @Delete('report-templates/:id')
  @SetMetadata(REQUIRE_PERMISSION, ['result:write'])
  async deleteReportTemplate(@Param('id') id: string) {
    await this.reportTemplateService.remove(id);
    return { deleted: true };
  }

  @Get('group-report')
  async generateGroupReport(
    @Query('templateId') templateId: string,
    @Query('taskId') taskId: string,
  ) {
    return this.reportGeneratorService.generateGroupReport(templateId, taskId);
  }
}

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import * as express from 'express';
import { ExportService } from './export.service';
import { ResultService } from '../result/result.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { SetMetadata } from '@nestjs/common';

interface AuthenticatedRequest extends express.Request {
  dataScope: {
    scope: 'own' | 'class' | 'grade' | 'all';
    userId: string;
    classId?: string;
    gradeId?: string;
  };
}

interface ExportFilterDto {
  taskId?: string;
  classId?: string;
  gradeId?: string;
}

@Controller('api/export')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['result:read'])
export class ExportController {
  constructor(
    private exportService: ExportService,
    private resultService: ResultService,
  ) {}

  @Get('excel/task/:taskId')
  async exportByTask(
    @Param('taskId') taskId: string,
    @Query('classId') classId: string | undefined,
    @Query('gradeId') gradeId: string | undefined,
    @Req() req: AuthenticatedRequest,
    @Res() res: express.Response,
  ) {
    const results = await this.resultService.findByFilter({
      taskId,
      classId,
      gradeId,
      dataScope: req.dataScope,
    });

    if (results.length > 10000) {
      res.status(400).json({
        message: '导出数据量超过10000条，请缩小筛选范围',
      });
      return;
    }

    const buffer = await this.exportService.generateExcel(results);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=export-${taskId}.xlsx`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }

  @Post('excel')
  async exportByFilter(
    @Body() filter: ExportFilterDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: express.Response,
  ) {
    const results = await this.resultService.findByFilter({
      ...filter,
      dataScope: req.dataScope,
    });

    if (results.length > 10000) {
      res.status(400).json({
        message: '导出数据量超过10000条，请缩小筛选范围',
      });
      return;
    }

    const buffer = await this.exportService.generateExcel(results);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=export.xlsx');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }

  @Get('pdf/:resultId')
  async exportPdf(
    @Param('resultId') resultId: string,
    @Res() res: express.Response,
  ) {
    const buffer = await this.exportService.generatePdf(resultId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=report-${resultId}.pdf`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }
}

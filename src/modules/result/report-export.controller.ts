import { Controller, Get, Param, UseGuards, Res } from '@nestjs/common';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { SetMetadata } from '@nestjs/common';
import { ExportService } from '../export/export.service';

@Controller('api/plugins/report-export')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['result:read'])
export class ReportExportController {
  constructor(private exportService: ExportService) {}

  @Get(':resultId')
  async exportReport(
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

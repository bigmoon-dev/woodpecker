import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import * as express from 'express';
import { DashboardService } from './dashboard.service';
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

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['result:read'])
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
  ) {
    return this.dashboardService.getOverview(req.dataScope, startDate);
  }

  @Get('completion')
  async getCompletion(
    @Req() req: AuthenticatedRequest,
    @Query('taskId') taskId?: string,
  ) {
    return this.dashboardService.getCompletion(req.dataScope, taskId);
  }

  @Get('alert-distribution')
  async getAlertDistribution(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
  ) {
    return this.dashboardService.getAlertDistribution(req.dataScope, startDate);
  }

  @Get('trend')
  async getTrend(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
  ) {
    const from = startDate || this.defaultStartDate();
    return this.dashboardService.getTrend(req.dataScope, from);
  }

  @Get('scale-usage')
  async getScaleUsage(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getScaleUsage(req.dataScope);
  }

  @Get('alert-trend')
  async getAlertTrend(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('period') period?: 'month' | 'semester',
  ) {
    const from = startDate || this.defaultStartDate();
    return this.dashboardService.getAlertTrendByMonth(
      req.dataScope,
      from,
      endDate,
      period || 'month',
    );
  }

  @Get('risk-heatmap')
  async getRiskHeatmap(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getRiskHeatmap(
      req.dataScope,
      startDate,
      endDate,
    );
  }

  private defaultStartDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }
}

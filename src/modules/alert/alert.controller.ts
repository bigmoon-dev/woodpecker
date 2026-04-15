import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AlertService, FollowupResponse } from './alert.service';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { HandleAlertDto } from './alert.dto';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { Request } from 'express';
import { SetMetadata } from '@nestjs/common';

interface AuthenticatedRequest extends Request {
  user: { id: string };
  dataScope: {
    scope: 'own' | 'class' | 'grade' | 'all';
    userId: string;
    classId?: string;
    gradeId?: string;
  };
}

@Controller('api/alerts')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['alert:read'])
export class AlertController {
  constructor(private alertService: AlertService) {}

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() pagination: PaginationQueryDto,
    @Query('status') status?: string,
  ) {
    return this.alertService.findAll(
      req.dataScope,
      status,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Post(':id/handle')
  @SetMetadata(REQUIRE_PERMISSION, ['alert:write'])
  async handle(
    @Param('id') id: string,
    @Body() dto: HandleAlertDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AlertRecord> {
    return this.alertService.handle(id, req.user.id, dto.handleNote);
  }

  @Post(':id/followup')
  @SetMetadata(REQUIRE_PERMISSION, ['alert:write'])
  followup(
    @Param('id') id: string,
    @Body() dto: HandleAlertDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<FollowupResponse> {
    return this.alertService.followup(id, req.user.id, dto.handleNote);
  }

  @Get('notifications')
  async findNotifications(
    @Req() req: AuthenticatedRequest,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.alertService.findNotifications(
      req.user.id,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Post('notifications/:id/read')
  async markNotificationRead(@Param('id') id: string) {
    return this.alertService.markNotificationRead(id);
  }
}

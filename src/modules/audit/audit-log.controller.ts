import { Controller, Get, Query, UseGuards, SetMetadata } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { AuditLogService } from './audit-log.service';

@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['admin:all'])
@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  @Get()
  async query(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('operatorId') operatorId?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.query({
      entityType,
      entityId,
      operatorId,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}

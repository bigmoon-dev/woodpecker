import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { SetMetadata } from '@nestjs/common';
import { FollowupManageService } from './followup-manage.service';
import {
  FollowupStudentQueryDto,
  UpdateThresholdDto,
} from './followup-manage.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    username: string;
    roles: { name: string; permissions: { code: string }[] }[];
  };
  dataScope: {
    scope: 'own' | 'class' | 'grade' | 'all';
    userId: string;
    classId?: string;
    gradeId?: string;
  };
}

@Controller('api/followup-manage')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['followup:read'])
export class FollowupManageController {
  constructor(private service: FollowupManageService) {}

  @Get('students')
  async listStudents(
    @Req() req: AuthenticatedRequest,
    @Query() query: FollowupStudentQueryDto,
  ) {
    return this.service.getStudents(req.dataScope, query.page, query.pageSize);
  }

  @Get('students/:id')
  getStudentDetail(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.getStudentDetail(id, req.dataScope);
  }

  @Get('config')
  getConfig() {
    return this.service.getThreshold();
  }

  @Put('config')
  @SetMetadata(REQUIRE_PERMISSION, ['followup:config:write'])
  async updateConfig(
    @Body() dto: UpdateThresholdDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const isAdmin = req.user.roles?.some((r) => r.name === 'admin');
    if (!isAdmin) {
      throw new ForbiddenException('Only admin can update config');
    }
    return this.service.updateThreshold(dto.threshold, req.user.id);
  }
}

import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ResultService } from './result.service';
import { TaskResult } from '../../entities/task/task-result.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { ConsentGuard } from '../consent/consent.guard';
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
  constructor(private resultService: ResultService) {}

  @Get('me')
  async findMyResults(@Req() req: AuthenticatedRequest): Promise<TaskResult[]> {
    return this.resultService.findByStudent(req.user.studentId || req.user.id);
  }

  @Get()
  async findByScope(@Req() req: AuthenticatedRequest): Promise<TaskResult[]> {
    return this.resultService.findByScope(req.dataScope);
  }
}

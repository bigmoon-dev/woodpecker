import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ResultService } from './result.service';
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
  constructor(private resultService: ResultService) {}

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

  @Get()
  async findByScope(@Req() req: AuthenticatedRequest) {
    return this.resultService.findByScope(req.dataScope);
  }
}

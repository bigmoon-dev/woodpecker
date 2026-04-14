import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrgService } from './org.service';
import { Grade } from '../../entities/org/grade.entity';
import { Class } from '../../entities/org/class.entity';
import { Student } from '../../entities/org/student.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { CreateGradeDto, CreateClassDto, CreateStudentDto } from './org.dto';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { SetMetadata } from '@nestjs/common';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string };
  dataScope: {
    scope: 'own' | 'class' | 'grade' | 'all';
    userId: string;
    classId?: string;
    gradeId?: string;
  };
}

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['org:read'])
export class OrgController {
  constructor(private orgService: OrgService) {}

  @Post('grades')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async createGrade(@Body() dto: CreateGradeDto): Promise<Grade> {
    return this.orgService.createGrade(dto);
  }

  @Get('grades')
  async findAllGrades(
    @Req() req: AuthenticatedRequest,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.orgService.findAllGrades(
      req.dataScope,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Get('grades/:id')
  async findOneGrade(@Param('id') id: string): Promise<Grade> {
    return this.orgService.findOneGrade(id);
  }

  @Put('grades/:id')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async updateGrade(
    @Param('id') id: string,
    @Body() dto: CreateGradeDto,
  ): Promise<Grade> {
    return this.orgService.updateGrade(id, dto);
  }

  @Delete('grades/:id')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async removeGrade(@Param('id') id: string): Promise<void> {
    return this.orgService.removeGrade(id);
  }

  @Post('classes')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async createClass(@Body() dto: CreateClassDto): Promise<Class> {
    return this.orgService.createClass(dto);
  }

  @Get('classes')
  async findAllClasses(
    @Req() req: AuthenticatedRequest,
    @Query() pagination: PaginationQueryDto,
    @Query('gradeId') gradeId?: string,
  ) {
    return this.orgService.findAllClasses(
      req.dataScope,
      gradeId,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Get('classes/:id')
  async findOneClass(@Param('id') id: string): Promise<Class> {
    return this.orgService.findOneClass(id);
  }

  @Put('classes/:id')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async updateClass(
    @Param('id') id: string,
    @Body() dto: CreateClassDto,
  ): Promise<Class> {
    return this.orgService.updateClass(id, dto);
  }

  @Delete('classes/:id')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async removeClass(@Param('id') id: string): Promise<void> {
    return this.orgService.removeClass(id);
  }

  @Post('students')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async createStudent(@Body() dto: CreateStudentDto): Promise<Student> {
    return this.orgService.createStudent(dto);
  }

  @Get('students')
  async findAllStudents(
    @Req() req: AuthenticatedRequest,
    @Query() pagination: PaginationQueryDto,
    @Query('classId') classId?: string,
  ) {
    return this.orgService.findAllStudents(
      req.dataScope,
      classId,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Get('students/:id')
  async findOneStudent(@Param('id') id: string): Promise<Student> {
    return this.orgService.findOneStudent(id);
  }

  @Put('students/:id')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async updateStudent(
    @Param('id') id: string,
    @Body() dto: CreateStudentDto,
  ): Promise<Student> {
    return this.orgService.updateStudent(id, dto);
  }

  @Delete('students/:id')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async removeStudent(@Param('id') id: string): Promise<void> {
    return this.orgService.removeStudent(id);
  }
}

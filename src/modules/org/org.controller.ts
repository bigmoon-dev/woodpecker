import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import { OrgService } from './org.service';
import { OrgImportService } from './org-import.service';
import { Grade } from '../../entities/org/grade.entity';
import { Class } from '../../entities/org/class.entity';
import { Student } from '../../entities/org/student.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { CreateGradeDto, CreateClassDto, CreateStudentDto } from './org.dto';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { SetMetadata } from '@nestjs/common';

interface AuthenticatedRequest extends express.Request {
  user: { id: string; displayName?: string };
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
  constructor(
    private orgService: OrgService,
    private orgImportService: OrgImportService,
  ) {}

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

  @Patch('grades/:id/status')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async updateGradeStatus(
    @Param('id') id: string,
    @Body('status') status: 'active' | 'archived',
    @Req() req: AuthenticatedRequest,
  ): Promise<Grade> {
    return this.orgService.updateGradeStatus(id, status, {
      id: req.user.id,
      name: req.user.displayName ?? 'unknown',
    });
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

  @Patch('classes/:id/status')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async updateClassStatus(
    @Param('id') id: string,
    @Body('status') status: 'active' | 'archived',
    @Req() req: AuthenticatedRequest,
  ): Promise<Class> {
    return this.orgService.updateClassStatus(id, status, {
      id: req.user.id,
      name: req.user.displayName ?? 'unknown',
    });
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
    @Req() req: AuthenticatedRequest,
  ): Promise<Student> {
    return this.orgService.updateStudent(id, dto, {
      id: req.user.id,
      name: req.user.displayName ?? 'unknown',
    });
  }

  @Patch('students/:id/status')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  async updateStudentStatus(
    @Param('id') id: string,
    @Body('status')
    status: 'active' | 'suspended' | 'graduated' | 'transferred',
    @Req() req: AuthenticatedRequest,
  ): Promise<Student> {
    return this.orgService.updateStudentStatus(id, status, {
      id: req.user.id,
      name: req.user.displayName ?? 'unknown',
    });
  }

  @Post('students/import')
  @SetMetadata(REQUIRE_PERMISSION, ['org:write'])
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async importStudents(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('未上传文件');
    }
    const { validRows, errors: parseErrors } =
      await this.orgImportService.parseExcel(file.buffer);
    const result = await this.orgImportService.importStudents(validRows);
    const parseErrorCount = parseErrors.filter((e) => e.field !== '_').length;
    return {
      total: result.total + parseErrorCount,
      created: result.created,
      skipped: result.skipped + parseErrorCount,
      errors: [...parseErrors, ...result.errors],
    };
  }

  @Get('students/import/template')
  @SetMetadata(REQUIRE_PERMISSION, ['org:read'])
  async downloadTemplate(@Res() res: express.Response) {
    const buffer = await this.orgImportService.generateTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=student-import-template.xlsx',
    );
    res.send(buffer);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { Task } from '../../entities/task/task.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { ConsentGuard } from '../consent/consent.guard';
import { CreateTaskDto, UpdateTaskDto, SubmitAnswersDto } from './task.dto';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { SetMetadata } from '@nestjs/common';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    studentId?: string;
    roles: { name: string; permissions: { code: string }[] }[];
  };
}

@Controller('api/tasks')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['task:read'])
export class TaskController {
  constructor(private taskService: TaskService) {}

  @Post()
  @SetMetadata(REQUIRE_PERMISSION, ['task:write'])
  async create(
    @Body() dto: CreateTaskDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Task> {
    const taskData: Partial<Task> = {
      ...dto,
      createdById: req.user.id,
      targetType: dto.targetType || 'class',
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
    };
    return this.taskService.create(taskData);
  }

  @Get()
  async findAll(
    @Query() pagination: PaginationQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const roleNames = req.user.roles.map((r) => r.name);
    const isStudent = roleNames.includes('student');
    const isTeacher =
      roleNames.includes('teacher') || roleNames.includes('psychologist');

    if (isStudent) {
      const classId = await this.taskService.getStudentClassId(req.user.id);
      if (classId) {
        return this.taskService.findAll(pagination.page, pagination.pageSize, {
          classId,
          status: 'published',
        });
      }
      return { data: [], total: 0 };
    }

    if (isTeacher) {
      return this.taskService.findAll(pagination.page, pagination.pageSize, {
        createdById: req.user.id,
      });
    }

    return this.taskService.findAll(pagination.page, pagination.pageSize);
  }

  @Get(':id')
  @UseGuards(ConsentGuard)
  async findOne(@Param('id') id: string): Promise<Task> {
    return this.taskService.findOne(id);
  }

  @Get(':id/submission-status')
  async getSubmissionStatus(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.taskService.getSubmissionStatus(id, req.user.id);
  }

  @Put(':id')
  @SetMetadata(REQUIRE_PERMISSION, ['task:write'])
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Task> {
    const data: Partial<Task> = {
      ...dto,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
    };
    return this.taskService.update(id, data, req.user.id);
  }

  @Delete(':id')
  @SetMetadata(REQUIRE_PERMISSION, ['task:write'])
  async remove(@Param('id') id: string): Promise<void> {
    return this.taskService.remove(id);
  }

  @Post(':id/answers/submit')
  @UseGuards(ConsentGuard)
  @SetMetadata(REQUIRE_PERMISSION, ['task:submit'])
  async submitAnswers(
    @Param('id') id: string,
    @Body() dto: SubmitAnswersDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<TaskResult> {
    return this.taskService.submitAnswers(id, req.user.id, dto.items);
  }

  @Post(':id/publish')
  @SetMetadata(REQUIRE_PERMISSION, ['task:write'])
  async publish(@Param('id') id: string): Promise<Task> {
    return this.taskService.publish(id);
  }

  @Post(':id/complete')
  @SetMetadata(REQUIRE_PERMISSION, ['task:write'])
  async complete(@Param('id') id: string): Promise<Task> {
    return this.taskService.complete(id);
  }
}

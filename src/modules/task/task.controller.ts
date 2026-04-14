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
} from '@nestjs/common';
import { TaskService } from './task.service';
import { Task } from '../../entities/task/task.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { ConsentGuard } from '../consent/consent.guard';
import { CreateTaskDto, SubmitAnswersDto } from './task.dto';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { SetMetadata } from '@nestjs/common';

@Controller('api/tasks')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['task:read'])
export class TaskController {
  constructor(private taskService: TaskService) {}

  @Post()
  @SetMetadata(REQUIRE_PERMISSION, ['task:write'])
  async create(@Body() dto: CreateTaskDto): Promise<Task> {
    const taskData: Partial<Task> = {
      ...dto,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
    };
    return this.taskService.create(taskData);
  }

  @Get()
  async findAll(@Query() pagination: PaginationQueryDto) {
    return this.taskService.findAll(pagination.page, pagination.pageSize);
  }

  @Get(':id')
  @UseGuards(ConsentGuard)
  async findOne(@Param('id') id: string): Promise<Task> {
    return this.taskService.findOne(id);
  }

  @Put(':id')
  @SetMetadata(REQUIRE_PERMISSION, ['task:write'])
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<Task>,
  ): Promise<Task> {
    return this.taskService.update(id, dto);
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
  ): Promise<TaskResult> {
    return this.taskService.submitAnswers(id, dto.studentId, dto.items);
  }

  @Post(':id/publish')
  @SetMetadata(REQUIRE_PERMISSION, ['task:write'])
  async publish(@Param('id') id: string): Promise<Task> {
    return this.taskService.publish(id);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { DataScopeFilter, DataScope } from '../auth/data-scope-filter';

@Injectable()
export class ResultService {
  constructor(
    @InjectRepository(TaskResult)
    private resultRepo: Repository<TaskResult>,
    @InjectRepository(TaskAnswer)
    private answerRepo: Repository<TaskAnswer>,
    private dataScopeFilter: DataScopeFilter,
  ) {}

  async findByStudent(studentId: string): Promise<TaskResult[]> {
    const answers = await this.answerRepo.find({ where: { studentId } });
    const answerIds = answers.map((a) => a.id);
    if (answerIds.length === 0) return [];
    return this.resultRepo.find({
      where: answerIds.map((id) => ({ answerId: id })),
    });
  }

  async findByScope(dataScope: DataScope): Promise<TaskResult[]> {
    if (dataScope.scope === 'all') {
      return this.resultRepo.find({ order: { createdAt: 'DESC' } });
    }
    const studentIds = await this.dataScopeFilter.getStudentIds(dataScope);
    if (studentIds.length === 0) return [];
    const answers = await this.answerRepo.find({
      where: studentIds.map((id) => ({ studentId: id })),
    });
    const answerIds = answers.map((a) => a.id);
    if (answerIds.length === 0) return [];
    return this.resultRepo.find({
      where: answerIds.map((id) => ({ answerId: id })),
    });
  }
}

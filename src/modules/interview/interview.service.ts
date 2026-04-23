/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Interview } from '../../entities/interview/interview.entity';
import { InterviewFile } from '../../entities/interview/interview-file.entity';
import { InterviewTemplate } from '../../entities/interview/interview-template.entity';
import { FollowUpReminder } from '../../entities/interview/follow-up-reminder.entity';
import { Student } from '../../entities/org/student.entity';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { EncryptionService } from '../core/encryption.service';
import { DataScopeFilter, DataScope } from '../auth/data-scope-filter';
import {
  RISK_LEVELS,
  INTERVIEW_STATUSES,
  VALID_TRANSITIONS,
  InterviewStatus,
  RiskLevel,
} from './interview.types';

@Injectable()
export class InterviewService {
  constructor(
    @InjectRepository(Interview)
    private interviewRepo: Repository<Interview>,
    @InjectRepository(InterviewFile)
    private fileRepo: Repository<InterviewFile>,
    @InjectRepository(InterviewTemplate)
    private templateRepo: Repository<InterviewTemplate>,
    @InjectRepository(FollowUpReminder)
    private reminderRepo: Repository<FollowUpReminder>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    private encryptionService: EncryptionService,
    private dataScopeFilter: DataScopeFilter,
  ) {}

  async create(dto: any): Promise<Interview> {
    const data: Partial<Interview> = { ...dto };
    if (dto.riskLevel && !RISK_LEVELS.includes(dto.riskLevel as RiskLevel)) {
      throw new BadRequestException(
        `Invalid riskLevel: ${dto.riskLevel}. Valid values: ${RISK_LEVELS.join(', ')}`,
      );
    }
    if (
      dto.status &&
      !INTERVIEW_STATUSES.includes(dto.status as InterviewStatus)
    ) {
      throw new BadRequestException(
        `Invalid status: ${dto.status}. Valid values: ${INTERVIEW_STATUSES.join(', ')}`,
      );
    }
    if (dto.content) {
      data.encryptedContent = await this.encryptionService.encrypt(
        dto.content as string,
      );
      delete (data as any).content;
    }
    if (dto.interviewDate) {
      data.interviewDate = new Date(
        dto.interviewDate as string | number | Date,
      );
    }
    const interview = this.interviewRepo.create(data);
    const saved = await this.interviewRepo.save(interview);

    if (dto.alertId) {
      await this.reminderRepo
        .createQueryBuilder()
        .update(FollowUpReminder)
        .set({ interviewId: saved.id })
        .where('studentId = :studentId', { studentId: dto.studentId })
        .andWhere('interviewId IS NULL')
        .andWhere('completed = false')
        .execute()
        .catch(() => {});
    }

    return saved;
  }

  async findAll(
    dataScope: DataScope,
    status?: string,
    studentId?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: any[]; total: number }> {
    const where: Record<string, any> = {};
    if (status) where.status = status;
    if (studentId) where.studentId = studentId;

    if (dataScope.scope !== 'all') {
      const studentIds = await this.dataScopeFilter.getStudentIds(dataScope);
      if (studentIds.length === 0) return { data: [], total: 0 };
      where.studentId = In(studentIds);
    }

    const [records, total] = await this.interviewRepo.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    const dbStudentIds = [...new Set(records.map((r) => r.studentId))];

    const userRows =
      dbStudentIds.length > 0
        ? await this.userRepo.find({
            where: { id: In(dbStudentIds) },
            select: ['id', 'studentId'],
          })
        : [];
    const userToStudent = new Map(
      userRows.filter((r) => r.studentId).map((r) => [r.id, r.studentId]),
    );

    const realStudentIds = [
      ...new Set(dbStudentIds.map((id) => userToStudent.get(id) ?? id)),
    ];
    const piiMap =
      realStudentIds.length > 0
        ? await this.encryptionService.batchDecrypt(realStudentIds)
        : new Map<string, { name: string; studentNumber: string }>();

    const data = records.map((r) => {
      const realId = userToStudent.get(r.studentId) ?? r.studentId;
      const pii = piiMap.get(realId);
      return {
        ...r,
        studentId: realId,
        studentName: pii?.name ?? '',
      };
    });

    return { data, total };
  }

  async findOne(id: string, userId?: string): Promise<Interview> {
    const interview = await this.interviewRepo.findOne({ where: { id } });
    if (!interview) throw new NotFoundException(`Interview ${id} not found`);

    if (interview.encryptedContent) {
      try {
        const decrypted = await this.encryptionService.decrypt(
          interview.encryptedContent,
        );
        (interview as any).content = decrypted;
      } catch {
        (interview as any).content = null;
      }
    }

    if (userId) {
      const user = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['roles'],
      });
      const isClassTeacher = user?.roles?.some((r) => r.name === '班主任');
      if (isClassTeacher) {
        delete (interview as any).encryptedContent;
        delete (interview as any).content;
      }
    }

    return interview;
  }

  async update(id: string, dto: any): Promise<Interview> {
    const interview = await this.interviewRepo.findOne({ where: { id } });
    if (!interview) throw new NotFoundException(`Interview ${id} not found`);

    if (dto.riskLevel && !RISK_LEVELS.includes(dto.riskLevel as RiskLevel)) {
      throw new BadRequestException(
        `Invalid riskLevel: ${dto.riskLevel}. Valid values: ${RISK_LEVELS.join(', ')}`,
      );
    }

    const data: Partial<Interview> = { ...dto };
    if (dto.content) {
      data.encryptedContent = await this.encryptionService.encrypt(
        dto.content as string,
      );
      delete (data as any).content;
    }
    if (dto.interviewDate) {
      data.interviewDate = new Date(
        dto.interviewDate as string | number | Date,
      );
    }

    Object.assign(interview, data);
    return this.interviewRepo.save(interview);
  }

  async updateStatus(id: string, newStatus: string): Promise<Interview> {
    const interview = await this.interviewRepo.findOne({ where: { id } });
    if (!interview) throw new NotFoundException(`Interview ${id} not found`);

    if (!INTERVIEW_STATUSES.includes(newStatus as InterviewStatus)) {
      throw new BadRequestException(
        `Invalid status: ${newStatus}. Valid values: ${INTERVIEW_STATUSES.join(', ')}`,
      );
    }

    const allowed = VALID_TRANSITIONS[interview.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from '${interview.status}' to '${newStatus}'. Allowed: [${allowed.join(', ')}]`,
      );
    }

    interview.status = newStatus;
    return this.interviewRepo.save(interview);
  }

  async delete(id: string): Promise<void> {
    const interview = await this.interviewRepo.findOne({ where: { id } });
    if (!interview) throw new NotFoundException(`Interview ${id} not found`);
    await this.interviewRepo.remove(interview);
  }

  async addFile(
    interviewId: string,
    filePath: string,
    fileType: string,
  ): Promise<InterviewFile> {
    const file = this.fileRepo.create({ interviewId, filePath, fileType });
    return this.fileRepo.save(file);
  }

  async deleteFile(fileId: string, interviewId?: string): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException(`File ${fileId} not found`);
    if (interviewId && file.interviewId !== interviewId) {
      throw new BadRequestException(
        `File ${fileId} does not belong to interview ${interviewId}`,
      );
    }
    await this.fileRepo.remove(file);
  }

  async updateFileOcr(
    fileId: string,
    ocrResult: any,
    ocrStatus: string,
  ): Promise<InterviewFile> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException(`File ${fileId} not found`);
    file.ocrResult = ocrResult;
    file.ocrStatus = ocrStatus;
    return this.fileRepo.save(file);
  }

  async getFiles(interviewId: string): Promise<InterviewFile[]> {
    return this.fileRepo.find({ where: { interviewId } });
  }

  async aggregateOcrText(interviewId: string): Promise<Interview> {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
    });
    if (!interview)
      throw new NotFoundException(`Interview ${interviewId} not found`);
    const files = await this.fileRepo.find({
      where: { interviewId },
      order: { createdAt: 'ASC' },
    });
    const texts = files
      .filter((f) => f.ocrResult?.text)
      .map((f) => (f.ocrResult as Record<string, unknown>).text as string);
    interview.ocrText = texts.join('\n');
    return this.interviewRepo.save(interview);
  }
}

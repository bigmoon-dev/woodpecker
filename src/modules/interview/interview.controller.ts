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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { InterviewService } from './interview.service';
import { TemplateService } from './template.service';
import { TimelineService } from './timeline.service';
import { FollowUpService } from './follow-up.service';
import { OcrService } from './ocr.service';
import { SummaryExtractionService } from './summary-extraction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import {
  CreateInterviewDto,
  UpdateInterviewDto,
  CreateTemplateDto,
  CreateFollowUpDto,
  UpdateStatusDto,
  UpdateTemplateDto,
} from './interview.dto';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { Request } from 'express';
import { SetMetadata } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

interface AuthenticatedRequest extends Request {
  user: { id: string };
  dataScope: {
    scope: 'own' | 'class' | 'grade' | 'all';
    userId: string;
    classId?: string;
    gradeId?: string;
  };
}

@Controller('api/interviews')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['interview:read'])
export class InterviewController {
  constructor(
    private interviewService: InterviewService,
    private templateService: TemplateService,
    private timelineService: TimelineService,
    private followUpService: FollowUpService,
    private ocrService: OcrService,
    private summaryExtractionService: SummaryExtractionService,
  ) {}

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() pagination: PaginationQueryDto,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.interviewService.findAll(
      req.dataScope,
      status,
      studentId,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Get('templates/all')
  async findAllTemplates() {
    return this.templateService.findAll();
  }

  @Get('templates/:id')
  async findOneTemplate(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Get('follow-ups/pending')
  async findPending() {
    return this.followUpService.findPending();
  }

  @Get('timeline/:studentId')
  async getTimeline(@Param('studentId') studentId: string) {
    return this.timelineService.getTimeline(studentId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.interviewService.findOne(id, req.user.id);
  }

  @Get(':id/files')
  async getFiles(@Param('id') id: string) {
    return this.interviewService.getFiles(id);
  }

  @Post()
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async create(@Body() dto: CreateInterviewDto) {
    return this.interviewService.create(dto);
  }

  @Post('templates')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async createTemplate(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Post(':id/follow-up')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async createFollowUp(
    @Param('id') id: string,
    @Body() dto: CreateFollowUpDto,
  ) {
    dto.interviewId = id;
    return this.followUpService.create(dto);
  }

  @Post(':id/files')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const fileType = file.mimetype.startsWith('image/') ? 'image' : 'pdf';
    const interviewFile = await this.interviewService.addFile(
      id,
      file.path,
      fileType,
    );

    Promise.resolve(this.ocrService.recognize(file.path))
      .then(async (result) => {
        await this.interviewService
          .updateFileOcr(interviewFile.id, result, 'done')
          .catch(() => {});
        await this.interviewService.aggregateOcrText(id).catch(() => {});
        await this.summaryExtractionService.extract(id).catch(() => {});
      })
      .catch(async () => {
        await this.interviewService
          .updateFileOcr(interviewFile.id, null, 'failed')
          .catch(() => {});
      });

    return interviewFile;
  }

  @Post(':id/extract-summary')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async extractSummary(@Param('id') id: string) {
    return this.summaryExtractionService.extract(id);
  }

  @Post(':id/files/:fileId/ocr')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async triggerOcr(@Param('id') id: string, @Param('fileId') fileId: string) {
    const files = await this.interviewService.getFiles(id);
    const file = files.find((f) => f.id === fileId);
    if (!file) {
      throw new BadRequestException('File not found');
    }
    const result = await this.ocrService.recognize(file.filePath);
    await this.interviewService.updateFileOcr(fileId, result, 'done');
    await this.interviewService.aggregateOcrText(id);
    await this.summaryExtractionService.extract(id).catch(() => {});
    return result;
  }

  @Put(':id')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async update(@Param('id') id: string, @Body() dto: UpdateInterviewDto) {
    return this.interviewService.update(id, dto);
  }

  @Put(':id/status')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.interviewService.updateStatus(id, dto.status);
  }

  @Put('templates/:id')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templateService.update(id, dto);
  }

  @Put('follow-ups/:id/complete')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async markComplete(@Param('id') id: string) {
    return this.followUpService.markComplete(id);
  }

  @Delete(':id')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async delete(@Param('id') id: string) {
    return this.interviewService.delete(id);
  }

  @Delete('templates/:id')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async deleteTemplate(@Param('id') id: string) {
    return this.templateService.delete(id);
  }

  @Delete(':id/files/:fileId')
  @SetMetadata(REQUIRE_PERMISSION, ['interview:write'])
  async deleteFile(@Param('id') id: string, @Param('fileId') fileId: string) {
    return this.interviewService.deleteFile(fileId, id);
  }
}

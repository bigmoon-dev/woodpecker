import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ScaleService } from './scale.service';
import { ExcelImportService } from './excel-import.service';
import { ScaleVersionService } from './scale-version.service';
import { ScaleValidationService } from './scale-validation.service';
import type {
  CreateValidationDto,
  UpdateValidationDto,
} from './scale-validation.service';
import { CreateScaleDto } from './scale.dto';
import { Scale } from '../../entities/scale/scale.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { RequireReauth } from '../auth/reauth.decorator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { SetMetadata } from '@nestjs/common';

@Controller('api/scales')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['scale:read'])
export class ScaleController {
  constructor(
    private scaleService: ScaleService,
    private excelImportService: ExcelImportService,
    private scaleVersionService: ScaleVersionService,
    private scaleValidationService: ScaleValidationService,
  ) {}

  @Post()
  @SetMetadata(REQUIRE_PERMISSION, ['scale:write'])
  async create(@Body() dto: CreateScaleDto): Promise<Scale> {
    return this.scaleService.create(dto);
  }

  @Get()
  async findAll(@Query() query: PaginationQueryDto) {
    return this.scaleService.findAll(query.page, query.pageSize);
  }

  @Get('library')
  async findLibrary(): Promise<Scale[]> {
    return this.scaleService.findLibrary();
  }

  @Post('library/:id/clone')
  @SetMetadata(REQUIRE_PERMISSION, ['scale:write'])
  async cloneFromLibrary(@Param('id') id: string): Promise<Scale> {
    return this.scaleService.cloneFromLibrary(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Scale> {
    return this.scaleService.findOne(id);
  }

  @Put(':id')
  @SetMetadata(REQUIRE_PERMISSION, ['scale:write'])
  async update(
    @Param('id') id: string,
    @Body() dto: CreateScaleDto,
  ): Promise<Scale> {
    return this.scaleService.update(id, dto);
  }

  @Delete(':id')
  @SetMetadata(REQUIRE_PERMISSION, ['scale:write'])
  @RequireReauth()
  async remove(@Param('id') id: string): Promise<void> {
    return this.scaleService.remove(id);
  }

  @Post('import')
  @SetMetadata(REQUIRE_PERMISSION, ['scale:write'])
  @UseInterceptors(FileInterceptor('file'))
  async importScale(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const parsed = await this.excelImportService.parseScaleFromBuffer(
      file.buffer,
    );
    const dto: CreateScaleDto = {
      name: parsed.name,
      version: parsed.version,
      description: parsed.description,
      items: parsed.items,
      scoringRules: parsed.scoringRules,
      scoreRanges: parsed.scoreRanges,
    };
    const scale = await this.scaleService.create(dto);
    return scale;
  }

  @Get(':id/versions')
  async getVersionHistory(@Param('id') id: string): Promise<Scale[]> {
    return this.scaleVersionService.getVersionHistory(id);
  }

  @Post(':id/publish')
  @SetMetadata(REQUIRE_PERMISSION, ['scale:write'])
  async publishScale(@Param('id') id: string): Promise<Scale> {
    return this.scaleVersionService.publishScale(id);
  }

  @Post(':id/create-version')
  @SetMetadata(REQUIRE_PERMISSION, ['scale:write'])
  async createVersion(@Param('id') id: string): Promise<Scale> {
    return this.scaleVersionService.createVersion(id);
  }

  @Get(':id/versions/:versionId')
  async getVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ): Promise<Scale> {
    return this.scaleVersionService.getVersion(id, versionId);
  }

  @Get(':id/validations')
  async getValidations(@Param('id') id: string) {
    return this.scaleValidationService.getValidations(id);
  }

  @Post(':id/validations')
  @SetMetadata(REQUIRE_PERMISSION, ['scale:write'])
  async addValidation(
    @Param('id') id: string,
    @Body() dto: CreateValidationDto,
  ) {
    return this.scaleValidationService.addValidation(id, dto);
  }

  @Put('validations/:validationId')
  @SetMetadata(REQUIRE_PERMISSION, ['scale:write'])
  async updateValidation(
    @Param('validationId') validationId: string,
    @Body() dto: UpdateValidationDto,
  ) {
    return this.scaleValidationService.updateValidation(validationId, dto);
  }

  @Delete('validations/:validationId')
  @SetMetadata(REQUIRE_PERMISSION, ['scale:write'])
  @RequireReauth()
  async deleteValidation(@Param('validationId') validationId: string) {
    await this.scaleValidationService.deleteValidation(validationId);
    return { deleted: true };
  }

  @Get(':id/validations/summary')
  async getValidationSummary(@Param('id') id: string) {
    return this.scaleValidationService.getValidationSummary(id);
  }
}

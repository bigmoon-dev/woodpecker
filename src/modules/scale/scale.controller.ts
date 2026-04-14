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
import { CreateScaleDto } from './scale.dto';
import { Scale } from '../../entities/scale/scale.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { SetMetadata } from '@nestjs/common';

@Controller('api/scales')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['scale:read'])
export class ScaleController {
  constructor(
    private scaleService: ScaleService,
    private excelImportService: ExcelImportService,
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
}

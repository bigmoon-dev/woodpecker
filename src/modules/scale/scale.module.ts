import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scale } from '../../entities/scale/scale.entity';
import { ScaleItem } from '../../entities/scale/scale-item.entity';
import { ScaleOption } from '../../entities/scale/scale-option.entity';
import { ScoringRule } from '../../entities/scale/scoring-rule.entity';
import { ScoreRange } from '../../entities/scale/score-range.entity';
import { ScaleValidation } from '../../entities/scale/scale-validation.entity';
import { Task } from '../../entities/task/task.entity';
import { ScaleService } from './scale.service';
import { ScaleController } from './scale.controller';
import { ExcelImportService } from './excel-import.service';
import { ScaleVersionService } from './scale-version.service';
import { ScaleValidationService } from './scale-validation.service';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Scale,
      ScaleItem,
      ScaleOption,
      ScoringRule,
      ScoreRange,
      ScaleValidation,
      Task,
    ]),
    ScoringModule,
  ],
  controllers: [ScaleController],
  providers: [
    ScaleService,
    ExcelImportService,
    ScaleVersionService,
    ScaleValidationService,
  ],
  exports: [ScaleService, ScaleVersionService, ScaleValidationService],
})
export class ScaleModule {}

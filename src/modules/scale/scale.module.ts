import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scale } from '../../entities/scale/scale.entity';
import { ScaleItem } from '../../entities/scale/scale-item.entity';
import { ScaleOption } from '../../entities/scale/scale-option.entity';
import { ScoringRule } from '../../entities/scale/scoring-rule.entity';
import { ScoreRange } from '../../entities/scale/score-range.entity';
import { ScaleService } from './scale.service';
import { ScaleController } from './scale.controller';
import { ExcelImportService } from './excel-import.service';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Scale,
      ScaleItem,
      ScaleOption,
      ScoringRule,
      ScoreRange,
    ]),
    ScoringModule,
  ],
  controllers: [ScaleController],
  providers: [ScaleService, ExcelImportService],
  exports: [ScaleService],
})
export class ScaleModule {}

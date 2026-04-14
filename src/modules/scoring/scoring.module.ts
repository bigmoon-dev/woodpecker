import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scale } from '../../entities/scale/scale.entity';
import { ScoringEngine } from './scoring.engine';
import { ScaleCacheService } from './scale-cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([Scale])],
  providers: [ScoringEngine, ScaleCacheService],
  exports: [ScoringEngine, ScaleCacheService],
})
export class ScoringModule {}

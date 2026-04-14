import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scale } from '../../entities/scale/scale.entity';
import { ScaleDefinition } from './scoring.types';

@Injectable()
export class ScaleCacheService implements OnModuleInit {
  private cache: Map<string, ScaleDefinition> = new Map();

  constructor(
    @InjectRepository(Scale)
    private scaleRepo: Repository<Scale>,
  ) {}

  async onModuleInit() {
    await this.loadAll();
  }

  private async loadAll() {
    const scales = await this.scaleRepo.find({
      where: { status: 'active', isLibrary: false },
      relations: ['items', 'items.options', 'scoringRules', 'scoreRanges'],
    });
    for (const scale of scales) {
      const def = this.toDefinition(scale);
      this.cache.set(def.id, def);
    }
  }

  get(scaleId: string): ScaleDefinition | undefined {
    return this.cache.get(scaleId);
  }

  set(scaleId: string, def: ScaleDefinition): void {
    this.cache.set(scaleId, def);
  }

  invalidate(scaleId: string): void {
    this.cache.delete(scaleId);
  }

  async refresh(scaleId: string): Promise<void> {
    const scale = await this.scaleRepo.findOne({
      where: { id: scaleId },
      relations: ['items', 'items.options', 'scoringRules', 'scoreRanges'],
    });
    if (scale) {
      this.cache.set(scale.id, this.toDefinition(scale));
    } else {
      this.cache.delete(scaleId);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private toDefinition(scale: Scale): ScaleDefinition {
    return {
      id: scale.id,
      items: (scale.items || []).map((item) => ({
        id: item.id,
        dimension: item.dimension,
        reverseScore: item.reverseScore || false,
        options: (item.options || []).map((opt) => ({
          id: opt.id,
          scoreValue: opt.scoreValue,
        })),
      })),
      scoringRules: (scale.scoringRules || []).map((r) => ({
        dimension: r.dimension,
        formulaType: r.formulaType,
        weight: r.weight,
      })),
      scoreRanges: (scale.scoreRanges || []).map((r) => ({
        dimension: r.dimension,
        minScore: r.minScore,
        maxScore: r.maxScore,
        level: r.level,
        color: r.color,
        suggestion: r.suggestion,
      })),
    };
  }
}

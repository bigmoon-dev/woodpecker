import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Scale } from '../../entities/scale/scale.entity';
import { ScaleItem } from '../../entities/scale/scale-item.entity';
import { ScaleOption } from '../../entities/scale/scale-option.entity';
import { ScoringRule } from '../../entities/scale/scoring-rule.entity';
import { ScoreRange } from '../../entities/scale/score-range.entity';
import { CreateScaleDto } from './scale.dto';
import { ScaleCacheService } from '../scoring/scale-cache.service';

@Injectable()
export class ScaleService {
  constructor(
    @InjectRepository(Scale)
    private scaleRepo: Repository<Scale>,
    @InjectRepository(ScoringRule)
    private scoringRuleRepo: Repository<ScoringRule>,
    @InjectRepository(ScoreRange)
    private scoreRangeRepo: Repository<ScoreRange>,
    private dataSource: DataSource,
    private scaleCacheService: ScaleCacheService,
  ) {}

  async create(dto: CreateScaleDto): Promise<Scale> {
    return this.dataSource.transaction(async (manager) => {
      const scale = manager.create(Scale, {
        name: dto.name,
        version: dto.version || '1.0',
        description: dto.description,
        source: dto.source,
        validationInfo: dto.validationInfo,
        status: 'active',
        items: dto.items.map((item) => ({
          itemText: item.itemText,
          itemType: item.itemType || 'single_choice',
          sortOrder: item.sortOrder,
          dimension: item.dimension,
          reverseScore: item.reverseScore || false,
          options: item.options.map((opt) => ({
            optionText: opt.optionText,
            scoreValue: opt.scoreValue,
            sortOrder: opt.sortOrder,
          })),
        })),
      });
      const saved = await manager.save(Scale, scale);

      if (dto.scoringRules?.length) {
        const rules = manager.create(
          ScoringRule,
          dto.scoringRules.map((r) => ({
            scaleId: saved.id,
            dimension: r.dimension,
            formulaType: r.formulaType,
            weight: r.weight,
            config: r.config,
          })),
        );
        await manager.save(ScoringRule, rules);
      }

      if (dto.scoreRanges?.length) {
        const ranges = manager.create(
          ScoreRange,
          dto.scoreRanges.map((r) => ({
            scaleId: saved.id,
            dimension: r.dimension,
            minScore: r.minScore,
            maxScore: r.maxScore,
            level: r.level,
            color: r.color,
            suggestion: r.suggestion,
          })),
        );
        await manager.save(ScoreRange, ranges);
      }

      await this.scaleCacheService.refresh(saved.id).catch(() => {});
      return saved;
    });
  }

  async findAll(
    page = 1,
    pageSize = 20,
  ): Promise<{ data: Scale[]; total: number }> {
    const [data, total] = await this.scaleRepo.findAndCount({
      where: { isLibrary: false },
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    return { data, total };
  }

  async findLibrary(): Promise<Scale[]> {
    return this.scaleRepo.find({
      where: { isLibrary: true, status: 'active' },
      relations: ['items'],
      order: { name: 'ASC' },
    });
  }

  async cloneFromLibrary(id: string): Promise<Scale> {
    const source = await this.scaleRepo.findOne({
      where: { id, isLibrary: true },
      relations: ['items', 'items.options', 'scoringRules', 'scoreRanges'],
    });
    if (!source) {
      throw new NotFoundException(`Library scale ${id} not found`);
    }

    return this.dataSource.transaction(async (manager) => {
      const scale = manager.create(Scale, {
        name: source.name + ' (副本)',
        version: source.version,
        description: source.description,
        source: `library:${source.id}`,
        status: 'draft',
        isLibrary: false,
        items: source.items.map((item) => ({
          itemText: item.itemText,
          itemType: item.itemType,
          sortOrder: item.sortOrder,
          dimension: item.dimension,
          reverseScore: item.reverseScore,
          options: item.options.map((opt) => ({
            optionText: opt.optionText,
            scoreValue: opt.scoreValue,
            sortOrder: opt.sortOrder,
          })),
        })),
      });
      const saved = await manager.save(Scale, scale);

      if (source.scoringRules?.length) {
        const rules = manager.create(
          ScoringRule,
          source.scoringRules.map((r) => ({
            scaleId: saved.id,
            dimension: r.dimension,
            formulaType: r.formulaType,
            weight: r.weight,
            config: r.config,
          })),
        );
        await manager.save(ScoringRule, rules);
      }

      if (source.scoreRanges?.length) {
        const ranges = manager.create(
          ScoreRange,
          source.scoreRanges.map((r) => ({
            scaleId: saved.id,
            dimension: r.dimension,
            minScore: r.minScore,
            maxScore: r.maxScore,
            level: r.level,
            color: r.color,
            suggestion: r.suggestion,
          })),
        );
        await manager.save(ScoreRange, ranges);
      }

      return saved;
    });
  }

  async findOne(id: string): Promise<Scale> {
    const scale = await this.scaleRepo.findOne({
      where: { id },
      relations: ['items', 'items.options', 'scoringRules', 'scoreRanges'],
    });
    if (!scale) throw new NotFoundException(`Scale ${id} not found`);
    return scale;
  }

  async update(id: string, dto: Partial<CreateScaleDto>): Promise<Scale> {
    return this.dataSource.transaction(async (manager) => {
      const scale = await manager.findOne(Scale, {
        where: { id },
        relations: ['items', 'items.options', 'scoringRules', 'scoreRanges'],
      });
      if (!scale) throw new NotFoundException(`Scale ${id} not found`);

      if (scale.versionStatus === 'published' || scale.isLibrary) {
        throw new BadRequestException(
          'Cannot modify a published or library scale. Use createVersion() to fork a new version.',
        );
      }

      scale.name = dto.name ?? scale.name;
      scale.version = dto.version ?? scale.version;
      scale.description = dto.description ?? scale.description;
      scale.source = dto.source ?? scale.source;
      scale.validationInfo = dto.validationInfo ?? scale.validationInfo;

      if (dto.items) {
        for (const oldItem of scale.items) {
          await manager.remove(ScaleItem, oldItem);
        }
        const newItems: ScaleItem[] = [];
        for (const [idx, item] of dto.items.entries()) {
          const si = manager.create(ScaleItem, {
            scaleId: scale.id,
            itemText: item.itemText,
            itemType: item.itemType || 'single_choice',
            sortOrder: item.sortOrder ?? idx,
            dimension: item.dimension ?? '',
            reverseScore: item.reverseScore || false,
          });
          const savedItem = await manager.save(ScaleItem, si);
          if (item.options && item.options.length > 0) {
            for (const [oi, opt] of item.options.entries()) {
              const so = manager.create(ScaleOption, {
                itemId: savedItem.id,
                optionText: opt.optionText,
                scoreValue: opt.scoreValue,
                sortOrder: opt.sortOrder ?? oi,
              });
              await manager.save(ScaleOption, so);
            }
          }
          newItems.push(savedItem);
        }
        scale.items = newItems;
      }

      if (dto.scoringRules) {
        scale.scoringRules = dto.scoringRules.map((r) => {
          const rule = new ScoringRule();
          rule.scaleId = scale.id;
          rule.dimension = r.dimension ?? '';
          rule.formulaType = r.formulaType ?? 'sum';
          rule.weight = r.weight ?? 1;
          rule.config = r.config ?? {};
          return rule;
        });
      }

      if (dto.scoreRanges) {
        scale.scoreRanges = dto.scoreRanges.map((r) => {
          const range = new ScoreRange();
          range.scaleId = scale.id;
          range.dimension = r.dimension ?? '';
          range.minScore = r.minScore;
          range.maxScore = r.maxScore;
          range.level = r.level;
          range.color = r.color;
          range.suggestion = r.suggestion;
          return range;
        });
      }

      const saved = await manager.save(Scale, scale);
      await this.scaleCacheService.refresh(saved.id).catch(() => {});
      return saved;
    });
  }

  async remove(id: string): Promise<void> {
    await this.scaleRepo.delete(id);
    this.scaleCacheService.invalidate(id);
  }
}

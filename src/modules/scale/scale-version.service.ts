import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Scale } from '../../entities/scale/scale.entity';
import { ScoringRule } from '../../entities/scale/scoring-rule.entity';
import { ScoreRange } from '../../entities/scale/score-range.entity';
import { ScaleCacheService } from '../scoring/scale-cache.service';

@Injectable()
export class ScaleVersionService {
  constructor(
    @InjectRepository(Scale)
    private scaleRepo: Repository<Scale>,
    private dataSource: DataSource,
    private scaleCacheService: ScaleCacheService,
  ) {}

  async publishScale(scaleId: string): Promise<Scale> {
    const scale = await this.scaleRepo.findOne({ where: { id: scaleId } });
    if (!scale) throw new NotFoundException(`Scale ${scaleId} not found`);
    if (scale.versionStatus === 'published') {
      throw new BadRequestException(`Scale ${scaleId} is already published`);
    }
    if (scale.isLibrary) {
      throw new BadRequestException('Library scales cannot be published');
    }

    scale.versionStatus = 'published';
    scale.publishedAt = new Date();
    scale.status = 'active';
    const saved = await this.scaleRepo.save(scale);
    await this.scaleCacheService.refresh(saved.id).catch(() => {});
    return saved;
  }

  async createVersion(scaleId: string): Promise<Scale> {
    const source = await this.scaleRepo.findOne({
      where: { id: scaleId },
      relations: ['items', 'items.options', 'scoringRules', 'scoreRanges'],
    });
    if (!source) throw new NotFoundException(`Scale ${scaleId} not found`);
    if (source.isLibrary) {
      throw new BadRequestException('Cannot create version from library scale');
    }

    const versionParts = source.version.split('.');
    const major = parseInt(versionParts[0] || '1', 10);
    const minor = parseInt(versionParts[1] || '0', 10);
    const newVersion = `${major}.${minor + 1}`;

    return this.dataSource.transaction(async (manager) => {
      if (source.versionStatus === 'published') {
        source.versionStatus = 'archived';
        await manager.save(Scale, source);
      }

      const newScale = manager.create(Scale, {
        name: source.name,
        version: newVersion,
        description: source.description,
        source: source.source,
        validationInfo: source.validationInfo,
        status: 'draft',
        versionStatus: 'draft',
        parentScaleId: source.id,
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
      const saved = await manager.save(Scale, newScale);

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

  async getVersionHistory(scaleId: string): Promise<Scale[]> {
    const scale = await this.scaleRepo.findOne({ where: { id: scaleId } });
    if (!scale) throw new NotFoundException(`Scale ${scaleId} not found`);

    let rootId = scaleId;
    let current: Scale | null = scale;
    while (current?.parentScaleId) {
      rootId = current.parentScaleId;
      current = await this.scaleRepo.findOne({
        where: { id: current.parentScaleId },
      });
    }

    const versions: Scale[] = [];
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const s = await this.scaleRepo.findOne({
        where: { id },
        select: [
          'id',
          'name',
          'version',
          'versionStatus',
          'publishedAt',
          'parentScaleId',
          'createdAt',
        ],
      });
      if (s) {
        versions.push(s);
        const children = await this.scaleRepo.find({
          where: { parentScaleId: id },
          select: ['id'],
        });
        queue.push(...children.map((c) => c.id));
      }
    }

    versions.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return versions;
  }

  async getVersion(scaleId: string, versionId: string): Promise<Scale> {
    const scale = await this.scaleRepo.findOne({
      where: { id: versionId },
      relations: ['items', 'items.options', 'scoringRules', 'scoreRanges'],
    });
    if (!scale) throw new NotFoundException(`Version ${versionId} not found`);

    const root = await this.getRootId(scaleId);
    const isRelated = await this.isVersionInTree(versionId, root);
    if (!isRelated) {
      throw new BadRequestException(
        `Version ${versionId} does not belong to scale ${scaleId}`,
      );
    }

    return scale;
  }

  async archiveVersion(scaleId: string): Promise<Scale> {
    const scale = await this.scaleRepo.findOne({ where: { id: scaleId } });
    if (!scale) throw new NotFoundException(`Scale ${scaleId} not found`);
    if (scale.versionStatus === 'archived') {
      throw new BadRequestException(`Scale ${scaleId} is already archived`);
    }
    if (scale.versionStatus === 'published') {
      throw new BadRequestException(
        'Cannot archive a published scale, create a new version first',
      );
    }

    scale.versionStatus = 'archived';
    const saved = await this.scaleRepo.save(scale);
    this.scaleCacheService.invalidate(scaleId);
    return saved;
  }

  private async getRootId(scaleId: string): Promise<string> {
    let current = await this.scaleRepo.findOne({ where: { id: scaleId } });
    if (!current) return scaleId;
    while (current.parentScaleId) {
      current = await this.scaleRepo.findOne({
        where: { id: current.parentScaleId },
      });
      if (!current) break;
    }
    return current?.id ?? scaleId;
  }

  private async isVersionInTree(
    versionId: string,
    rootId: string,
  ): Promise<boolean> {
    if (versionId === rootId) return true;
    const children = await this.scaleRepo.find({
      where: { parentScaleId: rootId },
      select: ['id'],
    });
    for (const child of children) {
      if (await this.isVersionInTree(versionId, child.id)) return true;
    }
    return false;
  }
}

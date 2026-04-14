import { DataSource } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { Scale } from '../entities/scale/scale.entity';
import { ScoringRule } from '../entities/scale/scoring-rule.entity';
import { ScoreRange } from '../entities/scale/score-range.entity';
import { ExcelImportService } from '../modules/scale/excel-import.service';

const TEMPLATES_DIR = path.resolve(__dirname, 'templates');

const LIBRARY_SCALES = [
  { file: 'SCL-90.xlsx', name: '症状自评量表 (SCL-90)' },
  { file: 'SDS.xlsx', name: '抑郁自评量表 (SDS)' },
  { file: 'SAS.xlsx', name: '焦虑自评量表 (SAS)' },
];

export async function seedScaleLibrary(dataSource: DataSource): Promise<void> {
  const scaleRepo = dataSource.getRepository(Scale);
  const existing = await scaleRepo.find({ where: { isLibrary: true } });
  if (existing.length > 0) {
    console.log(
      `Scale library already seeded (${existing.length} scales), skipping.`,
    );
    return;
  }

  const importService = new ExcelImportService();

  for (const entry of LIBRARY_SCALES) {
    const filepath = path.join(TEMPLATES_DIR, entry.file);
    if (!fs.existsSync(filepath)) {
      console.warn(`Template not found: ${filepath}, skipping.`);
      continue;
    }

    const buffer = fs.readFileSync(filepath);
    const parsed = await importService.parseScaleFromBuffer(buffer);

    await dataSource.transaction(async (manager) => {
      const scale = manager.create(Scale, {
        name: parsed.name,
        version: parsed.version || '1.0',
        description: parsed.description,
        status: 'active',
        isLibrary: true,
        source: `library:${entry.file}`,
        items: parsed.items.map((item) => ({
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

      if (parsed.scoringRules?.length) {
        const rules = manager.create(
          ScoringRule,
          parsed.scoringRules.map((r) => ({
            scaleId: saved.id,
            dimension: r.dimension,
            formulaType: r.formulaType,
            weight: r.weight,
          })),
        );
        await manager.save(ScoringRule, rules);
      }

      if (parsed.scoreRanges?.length) {
        const ranges = manager.create(
          ScoreRange,
          parsed.scoreRanges.map((r) => ({
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

      console.log(`Seeded library scale: ${saved.name} (${saved.id})`);
    });
  }

  console.log('Scale library seeding complete.');
}

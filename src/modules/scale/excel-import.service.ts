import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { CreateScaleDto } from './scale.dto';

/**
 * Excel Import Template Format (4 sheets):
 *
 * Sheet 1 "量表信息":
 *   Row 1: name | version | description | source | validationInfo
 *
 * Sheet 2 "题目":
 *   Columns: itemText | itemType | sortOrder | dimension | reverseScore | options(optionText:scoreValue:sortOrder separated by |)
 *   Each row is one question. Options format: "选项A:1:0|选项B:2:1|选项C:3:2"
 *
 * Sheet 3 "计分规则":
 *   Columns: dimension | formulaType | weight | config(JSON)
 *   formulaType: sum | weighted | dimension
 *
 * Sheet 4 "分数段":
 *   Columns: dimension | minScore | maxScore | level | color | suggestion
 *   color: green | yellow | red
 */

export interface ParsedScoringRule {
  dimension: string;
  formulaType: string;
  weight: number;
}

export interface ParsedScoreRange {
  dimension: string;
  minScore: number;
  maxScore: number;
  level: string;
  color: string;
  suggestion: string;
}

export interface ParsedScale {
  name: string;
  version: string;
  description: string;
  items: CreateScaleDto['items'];
  scoringRules: ParsedScoringRule[];
  scoreRanges: ParsedScoreRange[];
}

function cellStr(val: ExcelJS.CellValue | undefined): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && 'result' in (val as object)) {
    return String((val as { result: unknown }).result);
  }
  return JSON.stringify(val);
}

@Injectable()
export class ExcelImportService {
  async parseScaleFromBuffer(buffer: Buffer): Promise<ParsedScale> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const infoSheet = workbook.getWorksheet('量表信息');
    if (!infoSheet) {
      throw new BadRequestException('Sheet "量表信息" not found');
    }

    const name = cellStr(infoSheet.getCell('A1').value);
    const version = cellStr(infoSheet.getCell('A2').value) || '1.0';
    const description = cellStr(infoSheet.getCell('A3').value);

    if (!name) {
      throw new BadRequestException(
        'Scale name is required in sheet "量表信息" A1',
      );
    }

    const itemsSheet = workbook.getWorksheet('题目');
    const items = itemsSheet ? this.parseItemsSheet(itemsSheet) : [];

    const rulesSheet = workbook.getWorksheet('计分规则');
    const scoringRules = rulesSheet ? this.parseRulesSheet(rulesSheet) : [];

    const rangesSheet = workbook.getWorksheet('分数段');
    const scoreRanges = rangesSheet ? this.parseRangesSheet(rangesSheet) : [];

    return { name, version, description, items, scoringRules, scoreRanges };
  }

  private parseItemsSheet(sheet: ExcelJS.Worksheet): CreateScaleDto['items'] {
    const items: CreateScaleDto['items'] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const itemText = cellStr(row.getCell(2).value);
      if (!itemText) return;

      const itemType = cellStr(row.getCell(3).value) || 'single_choice';
      const sortOrder = Number(row.getCell(4).value) || items.length;
      const dimension = cellStr(row.getCell(5).value) || undefined;
      const reverseScore =
        row.getCell(6).value === true ||
        row.getCell(6).value === 'true' ||
        row.getCell(6).value === 1;

      const options: {
        optionText: string;
        scoreValue: number;
        sortOrder: number;
      }[] = [];

      const rawOpt = cellStr(row.getCell(7).value);
      if (rawOpt.includes('|')) {
        rawOpt.split('|').forEach((segment, idx) => {
          const parts = segment.split(':');
          if (parts.length >= 2) {
            options.push({
              optionText: parts[0],
              scoreValue: Number(parts[1]) || 0,
              sortOrder: parts.length >= 3 ? Number(parts[2]) : idx,
            });
          }
        });
      } else {
        let optCol = 7;
        let optIdx = 0;
        while (optCol <= row.cellCount) {
          const optText = cellStr(row.getCell(optCol).value);
          const optScore = row.getCell(optCol + 1).value;
          if (!optText && optScore === undefined) break;
          options.push({
            optionText: optText,
            scoreValue: Number(optScore) || 0,
            sortOrder: optIdx,
          });
          optCol += 2;
          optIdx++;
        }
      }

      items.push({
        itemText,
        itemType,
        sortOrder,
        dimension,
        reverseScore,
        options,
      });
    });

    return items;
  }

  private parseRulesSheet(sheet: ExcelJS.Worksheet): ParsedScoringRule[] {
    const rules: ParsedScoringRule[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const dimension = cellStr(row.getCell(1).value);
      const formulaType = cellStr(row.getCell(2).value) || 'sum';
      const weight = Number(row.getCell(3).value) || 1;

      rules.push({ dimension, formulaType, weight });
    });

    return rules;
  }

  private parseRangesSheet(sheet: ExcelJS.Worksheet): ParsedScoreRange[] {
    const ranges: ParsedScoreRange[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const dimension = cellStr(row.getCell(1).value);
      const minScore = Number(row.getCell(2).value) || 0;
      const maxScore = Number(row.getCell(3).value) || 0;
      const level = cellStr(row.getCell(4).value);
      const color = cellStr(row.getCell(5).value) || 'green';
      const suggestion = cellStr(row.getCell(6).value);

      ranges.push({ dimension, minScore, maxScore, level, color, suggestion });
    });

    return ranges;
  }
}

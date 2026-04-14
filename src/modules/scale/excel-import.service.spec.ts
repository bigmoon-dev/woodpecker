import { Test } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import { ExcelImportService } from './excel-import.service';

describe('ExcelImportService', () => {
  let service: ExcelImportService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [ExcelImportService],
    }).compile();
    service = module.get(ExcelImportService);
  });

  async function buildTestBuffer(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const infoSheet = workbook.addWorksheet('量表信息');
    infoSheet.getCell('A1').value = 'Test Scale';
    infoSheet.getCell('A2').value = '2.0';
    infoSheet.getCell('A3').value = 'A test scale description';

    const itemsSheet = workbook.addWorksheet('题目');
    itemsSheet.addRow([
      'itemId',
      'itemText',
      'itemType',
      'sortOrder',
      'dimension',
      'reverseScore',
      'opt1Text',
      'opt1Score',
      'opt2Text',
      'opt2Score',
    ]);
    itemsSheet.addRow([
      'i1',
      'Do you feel anxious?',
      'single_choice',
      1,
      'anxiety',
      false,
      'Never',
      0,
      'Always',
      3,
    ]);
    itemsSheet.addRow([
      'i2',
      'Do you feel sad?',
      'single_choice',
      2,
      'depression',
      true,
      'Never',
      0,
      'Always',
      3,
    ]);

    const rulesSheet = workbook.addWorksheet('计分规则');
    rulesSheet.addRow(['dimension', 'formulaType', 'weight']);
    rulesSheet.addRow(['anxiety', 'sum', 1]);
    rulesSheet.addRow(['depression', 'sum', 1.5]);

    const rangesSheet = workbook.addWorksheet('分数段');
    rangesSheet.addRow([
      'dimension',
      'minScore',
      'maxScore',
      'level',
      'color',
      'suggestion',
    ]);
    rangesSheet.addRow(['anxiety', 0, 3, 'low', 'green', 'No action needed']);
    rangesSheet.addRow(['anxiety', 4, 6, 'high', 'red', 'Seek help']);

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  it('should parse scale info from buffer', async () => {
    const buffer = await buildTestBuffer();
    const parsed = await service.parseScaleFromBuffer(buffer);

    expect(parsed.name).toBe('Test Scale');
    expect(parsed.version).toBe('2.0');
    expect(parsed.description).toBe('A test scale description');
  });

  it('should parse items with options', async () => {
    const buffer = await buildTestBuffer();
    const parsed = await service.parseScaleFromBuffer(buffer);

    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].itemText).toBe('Do you feel anxious?');
    expect(parsed.items[0].dimension).toBe('anxiety');
    expect(parsed.items[0].options).toHaveLength(2);
    expect(parsed.items[0].options[0].optionText).toBe('Never');
    expect(parsed.items[0].options[0].scoreValue).toBe(0);
    expect(parsed.items[0].options[1].optionText).toBe('Always');
    expect(parsed.items[0].options[1].scoreValue).toBe(3);
  });

  it('should parse scoring rules', async () => {
    const buffer = await buildTestBuffer();
    const parsed = await service.parseScaleFromBuffer(buffer);

    expect(parsed.scoringRules).toHaveLength(2);
    expect(parsed.scoringRules[0].dimension).toBe('anxiety');
    expect(parsed.scoringRules[0].formulaType).toBe('sum');
    expect(parsed.scoringRules[1].weight).toBe(1.5);
  });

  it('should parse score ranges', async () => {
    const buffer = await buildTestBuffer();
    const parsed = await service.parseScaleFromBuffer(buffer);

    expect(parsed.scoreRanges).toHaveLength(2);
    expect(parsed.scoreRanges[0].level).toBe('low');
    expect(parsed.scoreRanges[0].color).toBe('green');
    expect(parsed.scoreRanges[1].minScore).toBe(4);
    expect(parsed.scoreRanges[1].suggestion).toBe('Seek help');
  });

  it('should throw if info sheet is missing', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('题目');
    const buf = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(service.parseScaleFromBuffer(buf)).rejects.toThrow(
      'Sheet "量表信息" not found',
    );
  });

  it('should throw if scale name is empty', async () => {
    const workbook = new ExcelJS.Workbook();
    const infoSheet = workbook.addWorksheet('量表信息');
    infoSheet.getCell('A1').value = '';
    const buf = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(service.parseScaleFromBuffer(buf)).rejects.toThrow(
      'Scale name is required',
    );
  });
});

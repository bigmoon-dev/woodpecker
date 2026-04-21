import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateScoringRuleDto,
  CreateScoreRangeDto,
  CreateScaleDto,
} from './scale.dto';

describe('CreateScoringRuleDto', () => {
  it('should validate a valid scoring rule', async () => {
    const dto = new CreateScoringRuleDto();
    dto.dimension = 'total';
    dto.formulaType = 'sum';
    dto.weight = 1.0;
    dto.config = { reverse: [5] };
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should allow optional fields', async () => {
    const dto = new CreateScoringRuleDto();
    dto.formulaType = 'sum';
    dto.weight = 1.0;
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail with missing required fields', async () => {
    const dto = new CreateScoringRuleDto();
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateScoreRangeDto', () => {
  it('should validate a valid score range', async () => {
    const dto = new CreateScoreRangeDto();
    dto.dimension = 'total';
    dto.minScore = 0;
    dto.maxScore = 4;
    dto.level = 'normal';
    dto.color = 'green';
    dto.suggestion = '正常';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail with missing required fields', async () => {
    const dto = new CreateScoreRangeDto();
    dto.minScore = 0;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateScaleDto dimensions field', () => {
  it('should accept valid string array dimensions', async () => {
    const dto = plainToInstance(CreateScaleDto, {
      name: 'Test',
      items: [],
      dimensions: ['躯体化', '强迫'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept empty array dimensions', async () => {
    const dto = plainToInstance(CreateScaleDto, {
      name: 'Test',
      items: [],
      dimensions: [],
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should allow dimensions to be omitted', async () => {
    const dto = plainToInstance(CreateScaleDto, {
      name: 'Test',
      items: [],
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject non-array dimensions', async () => {
    const dto = plainToInstance(CreateScaleDto, {
      name: 'Test',
      items: [],
      dimensions: 'not-array',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject array with non-string elements', async () => {
    const dto = plainToInstance(CreateScaleDto, {
      name: 'Test',
      items: [],
      dimensions: [1, 2],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

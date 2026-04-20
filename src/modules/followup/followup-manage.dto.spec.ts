/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { ValidationPipe } from '@nestjs/common';
import { FollowupStudentQueryDto } from './followup-manage.dto';
import { UpdateThresholdDto } from './followup-manage.dto';

describe('UpdateThresholdDto', () => {
  let pipe: ValidationPipe;

  beforeAll(() => {
    pipe = new ValidationPipe({ whitelist: true, transform: true });
  });

  it('should accept yellow', async () => {
    const obj = { threshold: 'yellow' };
    const result = await pipe.transform(obj, {
      type: 'body',
      metatype: UpdateThresholdDto,
    } as any);
    expect(result.threshold).toBe('yellow');
  });

  it('should accept red', async () => {
    const obj = { threshold: 'red' };
    const result = await pipe.transform(obj, {
      type: 'body',
      metatype: UpdateThresholdDto,
    } as any);
    expect(result.threshold).toBe('red');
  });

  it('should reject green', async () => {
    await expect(
      pipe.transform({ threshold: 'green' }, {
        type: 'body',
        metatype: UpdateThresholdDto,
      } as any),
    ).rejects.toThrow();
  });

  it('should reject empty string', async () => {
    await expect(
      pipe.transform({ threshold: '' }, {
        type: 'body',
        metatype: UpdateThresholdDto,
      } as any),
    ).rejects.toThrow();
  });

  it('should reject missing threshold', async () => {
    await expect(
      pipe.transform({}, {
        type: 'body',
        metatype: UpdateThresholdDto,
      } as any),
    ).rejects.toThrow();
  });
});

describe('FollowupStudentQueryDto', () => {
  let pipe: ValidationPipe;

  beforeAll(() => {
    pipe = new ValidationPipe({ whitelist: true, transform: true });
  });

  it('should use default page=1 pageSize=20', async () => {
    const result = await pipe.transform({}, {
      type: 'query',
      metatype: FollowupStudentQueryDto,
    } as any);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('should accept valid pagination', async () => {
    const result = await pipe.transform({ page: '2', pageSize: '10' }, {
      type: 'query',
      metatype: FollowupStudentQueryDto,
    } as any);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it('should reject page=0', async () => {
    await expect(
      pipe.transform({ page: '0' }, {
        type: 'query',
        metatype: FollowupStudentQueryDto,
      } as any),
    ).rejects.toThrow();
  });

  it('should reject negative pageSize', async () => {
    await expect(
      pipe.transform({ pageSize: '-1' }, {
        type: 'query',
        metatype: FollowupStudentQueryDto,
      } as any),
    ).rejects.toThrow();
  });

  it('should reject non-integer page', async () => {
    await expect(
      pipe.transform({ page: 'abc' }, {
        type: 'query',
        metatype: FollowupStudentQueryDto,
      } as any),
    ).rejects.toThrow();
  });
});

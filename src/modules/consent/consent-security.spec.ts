/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { ConsentGuard } from '../consent/consent.guard';
import { ConsentRecord } from '../../entities/consent/consent-record.entity';

describe('Consent Security', () => {
  let guard: ConsentGuard;
  let consentRepo: { findOne: jest.Mock };
  let reflector: Reflector;

  beforeEach(async () => {
    consentRepo = { findOne: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ConsentGuard,
        { provide: getRepositoryToken(ConsentRecord), useValue: consentRepo },
        Reflector,
      ],
    }).compile();
    guard = module.get(ConsentGuard);
    reflector = module.get(Reflector);
  });

  function ctx(user: any, consentType?: string) {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(consentType || undefined);
    return {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as any;
  }

  it('blocks student with revoked consent', async () => {
    consentRepo.findOne.mockResolvedValue(null);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('assessment');
    await expect(
      guard.canActivate(ctx({ id: 'u1', studentId: 's1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks student when querying wrong consent type', async () => {
    consentRepo.findOne.mockResolvedValue(null);
    const context = ctx({ id: 'u1', studentId: 's1' });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('data_access');
    await expect(guard.canActivate(context)).rejects.toThrow('data_access');
  });

  it('allows non-student users without consent check', async () => {
    const result = await guard.canActivate(ctx({ id: 'u1' }));
    expect(result).toBe(true);
    expect(consentRepo.findOne).not.toHaveBeenCalled();
  });

  it('allows student with valid consent', async () => {
    consentRepo.findOne.mockResolvedValue({
      id: 'c1',
      consentType: 'assessment',
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const result = await guard.canActivate(ctx({ id: 'u1', studentId: 's1' }));
    expect(result).toBe(true);
  });
});

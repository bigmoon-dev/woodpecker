/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConsentGuard, CONSENT_TYPE_KEY } from './consent.guard';
import { ConsentRecord } from '../../entities/consent/consent-record.entity';
import { ExecutionContext } from '@nestjs/common';

describe('ConsentGuard', () => {
  let guard: ConsentGuard;
  let consentRepo: any;
  let reflector: Reflector;

  const makeContext = (user?: any): ExecutionContext => {
    const request: any = { user };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => {},
      getClass: () => () => {},
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const mockRepo = { findOne: jest.fn() };
    reflector = new Reflector();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentGuard,
        { provide: getRepositoryToken(ConsentRecord), useValue: mockRepo },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get<ConsentGuard>(ConsentGuard);
    consentRepo = module.get(getRepositoryToken(ConsentRecord));
  });

  it('should return true when user is undefined', async () => {
    await expect(guard.canActivate(makeContext(undefined))).resolves.toBe(true);
  });

  it('should return true when user has no studentId', async () => {
    await expect(guard.canActivate(makeContext({ id: 'u1' }))).resolves.toBe(
      true,
    );
  });

  it('should return true when consent record exists', async () => {
    consentRepo.findOne.mockResolvedValue({ id: 'c1' });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const result = await guard.canActivate(makeContext({ studentId: 's1' }));
    expect(result).toBe(true);
    expect(consentRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 's1', consentType: 'assessment' },
      }),
    );
  });

  it('should throw ForbiddenException when consent not signed', async () => {
    consentRepo.findOne.mockResolvedValue(null);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(
      guard.canActivate(makeContext({ studentId: 's1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should use default consentType assessment when no metadata', async () => {
    consentRepo.findOne.mockResolvedValue({ id: 'c1' });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await guard.canActivate(makeContext({ studentId: 's1' }));
    expect(consentRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 's1', consentType: 'assessment' },
      }),
    );
  });

  it('should use custom consentType from metadata', async () => {
    consentRepo.findOne.mockResolvedValue({ id: 'c1' });
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue('special_consent');
    await guard.canActivate(makeContext({ studentId: 's1' }));
    expect(consentRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 's1', consentType: 'special_consent' },
      }),
    );
  });
});

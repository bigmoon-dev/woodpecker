/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('ConsentController', () => {
  let controller: ConsentController;
  let consentService: any;

  const mockConsentService = {
    create: jest.fn(),
    findByUserId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsentController],
      providers: [{ provide: ConsentService, useValue: mockConsentService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ConsentController>(ConsentController);
    consentService = module.get(ConsentService);
  });

  it('create creates consent with parsed date', async () => {
    consentService.create.mockResolvedValueOnce({ id: 'cr1' });
    const dto = {
      userId: 'u1',
      consentType: 'assessment',
      contentHash: 'hash123',
      signedAt: '2025-06-15T00:00:00.000Z' as any,
    };
    await controller.create(dto as any);
    expect(consentService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        signedAt: expect.any(Date),
      }),
    );
  });

  it('check returns consents array for user', async () => {
    consentService.findByUserId.mockResolvedValueOnce([
      { consentType: 'assessment', signedAt: new Date('2025-01-01') },
      { consentType: 'counseling', signedAt: new Date('2025-02-01') },
    ]);
    const result = await controller.check('u1');
    expect(consentService.findByUserId).toHaveBeenCalledWith('u1');
    expect(result.userId).toBe('u1');
    expect(result.consents).toHaveLength(2);
    expect(result.consents[0].type).toBe('assessment');
    expect(result.consents[1].type).toBe('counseling');
  });
});

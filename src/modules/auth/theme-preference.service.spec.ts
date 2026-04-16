import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ThemePreferenceService } from './theme-preference.service';
import { User } from '../../entities/auth/user.entity';

describe('ThemePreferenceService', () => {
  let service: ThemePreferenceService;
  let userRepo: { findOne: jest.Mock; save: jest.Mock };

  function makeUser(overrides: Record<string, unknown> = {}): User {
    return {
      id: 'u1',
      username: 'admin',
      password: 'hashed',
      displayName: 'Admin',
      status: 'active',
      failedLoginCount: 0,
      lockedUntil: null,
      themePreference: null,
      studentId: null,
      roles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as unknown as User;
  }

  beforeEach(async () => {
    userRepo = { findOne: jest.fn(), save: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ThemePreferenceService,
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();
    service = module.get(ThemePreferenceService);
  });

  describe('getPreference()', () => {
    it('returns null when user has no theme preference', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      const result = await service.getPreference('u1');
      expect(result).toBeNull();
    });

    it('returns theme name when user has preference', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ themePreference: 'forest' }),
      );
      const result = await service.getPreference('u1');
      expect(result).toBe('forest');
    });

    it('throws NotFoundException for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getPreference('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setPreference()', () => {
    it('sets theme preference and returns it', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      userRepo.save.mockImplementation((u: unknown) => Promise.resolve(u));
      const result = await service.setPreference('u1', 'forest');
      expect(result).toBe('forest');
    });

    it('saves user with new themePreference', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation((u: unknown) => Promise.resolve(u));
      await service.setPreference('u1', 'spectrum');
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ themePreference: 'spectrum' }),
      );
    });

    it('allows setting to null to clear preference', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ themePreference: 'ink' }));
      userRepo.save.mockImplementation((u: unknown) => Promise.resolve(u));
      const result = await service.setPreference('u1', null);
      expect(result).toBeNull();
    });

    it('throws for invalid theme name', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(
        service.setPreference('u1', 'invalid_theme'),
      ).rejects.toThrow('Invalid theme');
    });

    it('throws NotFoundException for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.setPreference('missing', 'forest')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('accepts all valid themes', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      userRepo.save.mockImplementation((u: unknown) => Promise.resolve(u));
      for (const theme of ['forest', 'spectrum', 'ink', 'warm']) {
        const result = await service.setPreference('u1', theme);
        expect(result).toBe(theme);
      }
    });
  });

  describe('isValidTheme()', () => {
    it('returns true for valid themes', () => {
      expect(service.isValidTheme('forest')).toBe(true);
      expect(service.isValidTheme('spectrum')).toBe(true);
      expect(service.isValidTheme('ink')).toBe(true);
      expect(service.isValidTheme('warm')).toBe(true);
    });

    it('returns false for invalid themes', () => {
      expect(service.isValidTheme('dark')).toBe(false);
      expect(service.isValidTheme('')).toBe(false);
      expect(service.isValidTheme('Forest')).toBe(false);
    });
  });
});

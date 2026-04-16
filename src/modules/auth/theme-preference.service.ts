import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/auth/user.entity';

const VALID_THEMES = ['forest', 'spectrum', 'ink', 'warm'] as const;
export type ThemeName = (typeof VALID_THEMES)[number];

@Injectable()
export class ThemePreferenceService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async getPreference(userId: string): Promise<string | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user.themePreference;
  }

  async setPreference(
    userId: string,
    theme: string | null,
  ): Promise<string | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (theme !== null && !VALID_THEMES.includes(theme as ThemeName)) {
      throw new Error(
        `Invalid theme: ${theme}. Valid themes: ${VALID_THEMES.join(', ')}`,
      );
    }

    user.themePreference = theme;
    await this.userRepo.save(user);
    return user.themePreference;
  }

  isValidTheme(theme: string): boolean {
    return (VALID_THEMES as readonly string[]).includes(theme);
  }
}

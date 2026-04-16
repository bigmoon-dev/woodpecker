import { Injectable, UnauthorizedException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/auth/user.entity';
import * as bcrypt from 'bcrypt';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private configService: ConfigService,
  ) {}

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { username, status: 'active' },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) return null;

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remaining = Math.ceil(
        (new Date(user.lockedUntil).getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Account locked. Try again in ${remaining} minute(s).`,
        error: 'Too Many Requests',
      });
    }

    if (user.lockedUntil && new Date(user.lockedUntil) <= new Date()) {
      user.failedLoginCount = 0;
      user.lockedUntil = null;
      await this.userRepo.save(user);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await this.handleFailedLogin(user);
      return null;
    }

    if (user.failedLoginCount > 0) {
      user.failedLoginCount = 0;
      user.lockedUntil = null;
      await this.userRepo.save(user);
    }

    return user;
  }

  async handleFailedLogin(user: User): Promise<void> {
    user.failedLoginCount = (user.failedLoginCount || 0) + 1;
    if (user.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(
        Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000,
      );
    }
    await this.userRepo.save(user);
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  }

  async getPermissions(userId: string): Promise<string[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) return [];
    const perms = new Set<string>();
    for (const role of user.roles) {
      for (const p of role.permissions) {
        perms.add(p.code);
      }
    }
    return Array.from(perms);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}

import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { Public } from './public.decorator';
import { HookBus } from '../plugin/hook-bus';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { RefreshToken } from '../../entities/auth/refresh-token.entity';
import { LogoutDto } from './logout.dto';
import { Throttle } from '@nestjs/throttler';
import { ThemePreferenceService } from './theme-preference.service';
import * as crypto from 'crypto';

interface AuthedRequest extends Request {
  user: {
    id: string;
    username: string;
    studentId?: string;
    roles: { name: string; permissions: { code: string }[] }[];
  };
}

interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
}

class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

class ReauthDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}

class SetPreferenceDto {
  @IsString()
  @IsNotEmpty()
  theme: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private hookBus: HookBus,
    private themePreferenceService: ThemePreferenceService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return req.user;
  }

  @Post('login')
  @Public()
  @Throttle({ short: { limit: 1000, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Req() req: AuthedRequest) {
    const user = await this.authService.validateUser(
      dto.username,
      dto.password,
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const payload = {
      sub: user.id,
      username: user.username,
      roles: user.roles.map((r) => r.name),
    };

    const isStudent = user.roles.some((r) => r.name === 'student');
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: isStudent ? '30m' : '15m',
    });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({ userId: user.id, tokenHash, expiresAt }),
    );

    await this.hookBus
      .emit('on:user.login', {
        userId: user.id,
        roles: user.roles.map((r) => r.name),
        ip: req.ip,
      })
      .catch(() => {});

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    };
  }

  @Post('refresh')
  @Public()
  async refresh(@Body() dto: RefreshDto) {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.refreshToken)
      .digest('hex');

    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedBuf = Buffer.from(stored.tokenHash, 'hex');
    const computedBuf = Buffer.from(tokenHash, 'hex');
    if (
      storedBuf.length !== computedBuf.length ||
      !crypto.timingSafeEqual(storedBuf, computedBuf)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshTokenRepo.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    const newPayload = {
      sub: payload.sub,
      username: payload.username,
      roles: payload.roles,
    };
    const isStudent = payload.roles.includes('student');
    const accessToken = this.jwtService.sign(newPayload, {
      expiresIn: isStudent ? '30m' : '15m',
    });
    const newRefreshToken = this.jwtService.sign(newPayload, {
      expiresIn: '7d',
    });

    const newHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');
    const newExpires = new Date();
    newExpires.setDate(newExpires.getDate() + 7);
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: payload.sub,
        tokenHash: newHash,
        expiresAt: newExpires,
      }),
    );

    return { accessToken, refreshToken: newRefreshToken };
  }

  @Post('logout')
  @Public()
  async logout(@Body() dto: LogoutDto) {
    try {
      this.jwtService.verify<JwtPayload>(dto.refreshToken);
    } catch {
      return { success: true };
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.refreshToken)
      .digest('hex');
    await this.refreshTokenRepo.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { success: true };
  }

  @Post('reauth')
  async reauth(@Body() dto: ReauthDto, @Req() req: AuthedRequest) {
    const valid = await this.authService.verifyPassword(
      req.user.id,
      dto.password,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid password');
    }

    const reauthToken = this.jwtService.sign(
      { sub: req.user.id, reauth: true },
      { expiresIn: '5m' },
    );

    return { reauthToken };
  }

  @Get('preferences')
  async getPreferences(@Req() req: AuthedRequest) {
    const theme = await this.themePreferenceService.getPreference(req.user.id);
    return { theme };
  }

  @Put('preferences')
  async setPreferences(
    @Body() dto: SetPreferenceDto,
    @Req() req: AuthedRequest,
  ) {
    const theme = await this.themePreferenceService.setPreference(
      req.user.id,
      dto.theme,
    );
    return { theme };
  }
}

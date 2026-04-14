import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { IsString, IsNotEmpty } from 'class-validator';
import { Public } from './public.decorator';
import { HookBus } from '../plugin/hook-bus';

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
  password: string;
}

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private hookBus: HookBus,
  ) {}

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return req.user;
  }

  @Post('login')
  @Public()
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
  refresh(@Body() dto: RefreshDto) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(dto.refreshToken);
      const newPayload = {
        sub: payload.sub,
        username: payload.username,
        roles: payload.roles,
      };
      const accessToken = this.jwtService.sign(newPayload, {
        expiresIn: '15m',
      });
      return { accessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/auth/user.entity';

interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            'JWT_SECRET environment variable is required. Set it before starting the application.',
          );
        }
        return secret;
      })(),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      studentId: user.studentId,
      roles: (user.roles || []).map((r) => ({
        name: r.name,
        permissions: (r.permissions || []).map((p) => ({ code: p.code })),
      })),
    };
  }
}

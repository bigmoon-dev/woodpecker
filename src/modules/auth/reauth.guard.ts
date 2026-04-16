import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { REQUIRE_REAUTH_KEY } from './reauth.decorator';

interface ReauthJwtPayload {
  sub: string;
  reauth: boolean;
}

@Injectable()
export class ReauthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requireReauth = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_REAUTH_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requireReauth) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { id: string };
    }>();
    const reauthToken = request.headers['x-reauth-token'];

    if (!reauthToken) {
      throw new UnauthorizedException(
        'Re-authentication required. Provide X-Reauth-Token header.',
      );
    }

    try {
      const payload = this.jwtService.verify<ReauthJwtPayload>(reauthToken);

      if (!payload.reauth) {
        throw new UnauthorizedException('Invalid re-authentication token.');
      }

      if (request.user && payload.sub !== request.user.id) {
        throw new UnauthorizedException(
          'Re-authentication token does not match current user.',
        );
      }

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'Invalid or expired re-authentication token.',
      );
    }
  }
}

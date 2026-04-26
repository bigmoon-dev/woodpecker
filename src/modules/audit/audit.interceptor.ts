import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AuditLog } from '../../entities/audit/audit-log.entity';
import { AuditIntegrityService } from './audit-integrity.service';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string; displayName?: string };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly hmacSecret: string;

  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
    private configService: ConfigService,
    private integrityService: AuditIntegrityService,
  ) {
    const secret = this.configService.get<string>('AUDIT_HMAC_SECRET');
    if (!secret) {
      throw new Error(
        'AUDIT_HMAC_SECRET environment variable is required. Set it before starting the application.',
      );
    }
    this.hmacSecret = secret;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      tap(() => {
        const log = this.auditRepo.create({
          operatorId: user?.id || null,
          operatorName: user?.displayName || 'anonymous',
          action: `${method} ${url}`,
          entityType: this.extractResource(url),
          entityId: this.extractId(url),
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        });
        log.integrityHash = this.integrityService.computeHash(
          log,
          this.hmacSecret,
        );
        this.auditRepo.save(log).catch(() => {});
      }),
    );
  }

  private extractResource(url: string): string {
    const parts = url.split('/').filter(Boolean);
    return parts[1] || 'unknown';
  }

  private extractId(url: string): string | null {
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    const match = url.match(uuid);
    return match ? match[0] : null;
  }
}

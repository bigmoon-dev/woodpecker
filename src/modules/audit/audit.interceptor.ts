import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit/audit-log.entity';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      tap(() => {
        const log = this.auditRepo.create({
          userId: user?.id || null,
          action: `${method} ${url}`,
          resourceType: this.extractResource(url),
          resourceId: this.extractId(url),
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        });
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

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Request } from 'express';

interface AuthenticatedUser {
  id: string;
  studentId?: string;
  classId?: string;
  gradeId?: string;
  roles: { name: string; permissions: { code: string }[] }[];
}

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  dataScope: {
    scope: 'own' | 'class' | 'grade' | 'all';
    userId: string;
    classId?: string;
    gradeId?: string;
  };
}

export const REQUIRE_PERMISSION = 'require_permission';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    const userPerms: string[] = (user.roles || []).flatMap(
      (r) => r.permissions?.map((p) => p.code) || [],
    );

    const hasAdminAll = userPerms.includes('admin:all');
    const hasAll = hasAdminAll || required.every((p) => userPerms.includes(p));
    if (!hasAll) throw new ForbiddenException('Insufficient permissions');

    let scope: 'own' | 'class' | 'grade' | 'all' = 'own';
    const roleNames = (user.roles || []).map((r) => r.name);
    const hasScopeSuffix = userPerms.some(
      (p) => p.endsWith(':all') || p.endsWith(':grade') || p.endsWith(':class'),
    );
    if (userPerms.some((p) => p.endsWith(':all'))) {
      scope = 'all';
    } else if (userPerms.some((p) => p.endsWith(':grade'))) {
      scope = 'grade';
    } else if (userPerms.some((p) => p.endsWith(':class'))) {
      scope = 'class';
    } else if (roleNames.includes('psychologist') && !hasScopeSuffix) {
      scope = 'all';
    }

    request.dataScope = {
      scope,
      userId: user.id,
      classId: user.classId,
      gradeId: user.gradeId,
    };

    return true;
  }
}

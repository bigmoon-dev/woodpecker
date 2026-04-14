import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ConsentRecord } from '../../entities/consent/consent-record.entity';

export const CONSENT_TYPE_KEY = 'consentType';

interface ConsentRequest extends Request {
  user?: { studentId?: string };
}

@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(
    @InjectRepository(ConsentRecord)
    private consentRepo: Repository<ConsentRecord>,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ConsentRequest>();
    const user = request.user;
    if (!user) return true;
    const studentId = user.studentId;
    if (!studentId) return true;

    const consentType =
      this.reflector.getAllAndOverride<string>(CONSENT_TYPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'assessment';

    const consent = await this.consentRepo.findOne({
      where: { studentId, consentType },
    });
    if (!consent)
      throw new ForbiddenException(
        `知情同意(${consentType})未签署，请先完成知情同意`,
      );
    return true;
  }
}

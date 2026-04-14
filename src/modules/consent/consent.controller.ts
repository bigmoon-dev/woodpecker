import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ConsentService } from './consent.service';
import { ConsentRecord } from '../../entities/consent/consent-record.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { CreateConsentDto } from './consent.dto';
import { SetMetadata } from '@nestjs/common';

@Controller('api/consent')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['consent:read'])
export class ConsentController {
  constructor(private consentService: ConsentService) {}

  @Post()
  @SetMetadata(REQUIRE_PERMISSION, ['consent:write'])
  async create(@Body() dto: CreateConsentDto): Promise<ConsentRecord> {
    return this.consentService.create({
      ...dto,
      signedAt: new Date(dto.signedAt),
    });
  }

  @Get('check/:userId')
  async check(@Param('userId') userId: string) {
    const records = await this.consentService.findByUserId(userId);
    return {
      userId,
      consents: records.map((r) => ({
        type: r.consentType,
        signedAt: r.signedAt,
      })),
    };
  }
}

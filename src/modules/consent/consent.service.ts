import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsentRecord } from '../../entities/consent/consent-record.entity';

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(ConsentRecord)
    private consentRepo: Repository<ConsentRecord>,
  ) {}

  async create(data: Partial<ConsentRecord>): Promise<ConsentRecord> {
    const record = this.consentRepo.create(data);
    return this.consentRepo.save(record);
  }

  async findByUserId(userId: string): Promise<ConsentRecord[]> {
    return this.consentRepo.find({
      where: { userId },
      order: { signedAt: 'DESC' },
    });
  }

  async checkConsent(userId: string, consentType: string): Promise<boolean> {
    const record = await this.consentRepo.findOne({
      where: { userId, consentType },
      order: { signedAt: 'DESC' },
    });
    return !!record;
  }

  async findOne(id: string): Promise<ConsentRecord | null> {
    return this.consentRepo.findOne({ where: { id } });
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Student } from '../../entities/org/student.entity';
import { EncryptionService } from '../core/encryption.service';
import { Interval } from '@nestjs/schedule';

function maskName(value: string): string {
  if (!value) return value;
  return value.charAt(0) + '**';
}

function maskStudentNumber(value: string): string {
  if (!value || value.length <= 8) return '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

function maskContact(value: string): string {
  if (!value || value.length <= 7) return '****';
  return value.slice(0, 3) + '****' + value.slice(-4);
}

function isAlreadyMaskedName(value: string): boolean {
  return value.length === 3 && value.endsWith('**');
}

function isAlreadyMaskedStudentNumber(value: string): boolean {
  return value.length >= 8 && value.includes('****');
}

function isAlreadyMaskedContact(value: string): boolean {
  return value.length >= 7 && value.slice(3, 7) === '****';
}

@Injectable()
export class DataRetentionService {
  constructor(
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {}

  @Interval(24 * 60 * 60 * 1000)
  async desensitizeExpired(): Promise<number> {
    const retentionDays = this.configService.get<number>(
      'DATA_RETENTION_DAYS',
      365,
    );
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const expired = await this.studentRepo.find({
      where: { createdAt: LessThan(cutoff) },
    });

    if (expired.length === 0) return 0;

    for (const student of expired) {
      if (student.encryptedName) {
        const plain = await this.encryptionService.decrypt(
          student.encryptedName,
        );
        if (!isAlreadyMaskedName(plain)) {
          const masked = maskName(plain);
          student.encryptedName = await this.encryptionService.encrypt(masked);
        }
      }
      if (student.encryptedStudentNumber) {
        const plain = await this.encryptionService.decrypt(
          student.encryptedStudentNumber,
        );
        if (!isAlreadyMaskedStudentNumber(plain)) {
          const masked = maskStudentNumber(plain);
          student.encryptedStudentNumber =
            await this.encryptionService.encrypt(masked);
        }
      }
      if (student.encryptedContact) {
        const plain = await this.encryptionService.decrypt(
          student.encryptedContact,
        );
        if (!isAlreadyMaskedContact(plain)) {
          const masked = maskContact(plain);
          student.encryptedContact =
            await this.encryptionService.encrypt(masked);
        }
      }
    }

    await this.studentRepo.save(expired);
    return expired.length;
  }
}

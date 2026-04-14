import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Student } from '../../entities/org/student.entity';
import { createHash } from 'crypto';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class DataRetentionService {
  constructor(
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    private configService: ConfigService,
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
        student.encryptedName = Buffer.from(
          createHash('sha256')
            .update(student.encryptedName.toString())
            .digest('hex'),
        );
      }
      if (student.encryptedStudentNumber) {
        student.encryptedStudentNumber = Buffer.from(
          createHash('sha256')
            .update(student.encryptedStudentNumber.toString())
            .digest('hex'),
        );
      }
      if (student.encryptedContact) {
        student.encryptedContact = Buffer.from(
          createHash('sha256')
            .update(student.encryptedContact.toString())
            .digest('hex'),
        );
      }
    }

    await this.studentRepo.save(expired);
    return expired.length;
  }
}

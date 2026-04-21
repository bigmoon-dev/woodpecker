import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class EncryptionService {
  private key: string;

  constructor(
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {
    this.key = (() => {
      const key = this.configService.get<string>('ENCRYPTION_KEY');
      if (!key) {
        throw new Error(
          'ENCRYPTION_KEY environment variable is required. Set it before starting the application.',
        );
      }
      return key;
    })();
  }

  async encrypt(plaintext: string): Promise<Buffer> {
    const result: { encrypted: Buffer }[] = await this.dataSource.query(
      'SELECT pgp_sym_encrypt($1, $2) AS encrypted',
      [plaintext, this.key],
    );
    return result[0].encrypted;
  }

  async decrypt(ciphertext: Buffer): Promise<string> {
    const result: { decrypted: string }[] = await this.dataSource.query(
      'SELECT pgp_sym_decrypt($1, $2) AS decrypted',
      [ciphertext, this.key],
    );
    return result[0].decrypted;
  }

  async batchDecrypt(
    studentIds: string[],
  ): Promise<Map<string, { name: string; studentNumber: string }>> {
    if (studentIds.length === 0) return new Map();
    const rows: {
      id: string;
      name: string;
      student_number: string;
    }[] = await this.dataSource.query(
      `SELECT s.id,
              CASE WHEN s."encryptedName" IS NOT NULL THEN pgp_sym_decrypt(s."encryptedName", $1) ELSE '' END AS name,
              CASE WHEN s."encryptedStudentNumber" IS NOT NULL THEN pgp_sym_decrypt(s."encryptedStudentNumber", $1) ELSE '' END AS student_number
       FROM students s
       WHERE s.id = ANY($2::uuid[])`,
      [this.key, studentIds],
    );
    const map = new Map<string, { name: string; studentNumber: string }>();
    for (const row of rows) {
      map.set(row.id, { name: row.name, studentNumber: row.student_number });
    }
    return map;
  }
}

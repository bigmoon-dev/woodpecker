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
    this.key = this.configService.get<string>(
      'ENCRYPTION_KEY',
      'default-dev-key-change-in-prod',
    );
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
      "SELECT convert_from(pgp_sym_decrypt($1, $2), 'UTF8') AS decrypted",
      [ciphertext, this.key],
    );
    return result[0].decrypted;
  }
}

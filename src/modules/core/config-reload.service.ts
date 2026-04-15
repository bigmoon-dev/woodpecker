import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { SystemConfig } from '../../entities/config/system-config.entity';

type ConfigValue = string | number | boolean | object;

const SENSITIVE_KEYS = ['AUDIT_HMAC_SECRET', 'ENCRYPTION_KEY', 'JWT_SECRET'];

@Injectable()
export class ConfigReloadService implements OnModuleInit {
  private cache = new Map<string, string>();

  constructor(
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
  ) {}

  async onModuleInit() {
    await this.reload();
  }

  get<T extends ConfigValue>(key: string, defaultValue?: T): T {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return this.coerce<T>(cached, defaultValue);
    }
    const envVal = process.env[key];
    if (envVal !== undefined) {
      return this.coerce<T>(envVal, defaultValue);
    }
    return defaultValue as T;
  }

  async reload(): Promise<void> {
    const rows = await this.configRepo.find();
    const next = new Map<string, string>();
    for (const row of rows) {
      next.set(row.key, row.value);
    }
    this.cache = next;
  }

  async set(
    key: string,
    value: string,
    updatedBy: string,
  ): Promise<SystemConfig> {
    const entity = this.configRepo.create({
      key,
      value,
      updatedBy,
    });
    const saved = await this.configRepo.save(entity);
    this.cache.set(key, value);
    return saved;
  }

  async findAll(): Promise<SystemConfig[]> {
    return this.configRepo.find({ order: { category: 'ASC', key: 'ASC' } });
  }

  async remove(key: string): Promise<void> {
    await this.configRepo.delete(key);
    this.cache.delete(key);
  }

  maskValue(key: string, value: string): string {
    if (SENSITIVE_KEYS.includes(key)) {
      return value.slice(0, 4) + '****';
    }
    return value;
  }

  @Cron('*/5 * * * *')
  async periodicSync() {
    await this.reload();
  }

  private coerce<T extends ConfigValue>(raw: string, defaultValue?: T): T {
    if (defaultValue === undefined) return raw as unknown as T;
    if (typeof defaultValue === 'number') return Number(raw) as unknown as T;
    if (typeof defaultValue === 'boolean')
      return (raw === 'true' || raw === '1') as unknown as T;
    return raw as unknown as T;
  }
}

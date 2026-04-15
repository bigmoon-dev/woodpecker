import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { ConfigReloadService } from './config-reload.service';
import { SystemConfig } from '../../entities/config/system-config.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemConfig]), ConfigModule],
  providers: [EncryptionService, ConfigService, ConfigReloadService],
  exports: [EncryptionService, ConfigService, ConfigReloadService],
})
export class CoreModule {}

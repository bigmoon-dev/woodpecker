import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([]), ConfigModule],
  providers: [EncryptionService, ConfigService],
  exports: [EncryptionService, ConfigService],
})
export class CoreModule {}

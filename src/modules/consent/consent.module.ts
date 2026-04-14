import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentRecord } from '../../entities/consent/consent-record.entity';
import { ConsentService } from './consent.service';
import { ConsentController } from './consent.controller';
import { ConsentGuard } from './consent.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ConsentRecord])],
  controllers: [ConsentController],
  providers: [ConsentService, ConsentGuard],
  exports: [ConsentService, ConsentGuard],
})
export class ConsentModule {}

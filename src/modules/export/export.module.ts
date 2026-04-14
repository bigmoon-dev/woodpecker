import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { ResultModule } from '../result/result.module';

@Module({
  imports: [TypeOrmModule.forFeature([AlertRecord]), ResultModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}

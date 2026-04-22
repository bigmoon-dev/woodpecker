import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';

@Controller('api/admin/backup')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['admin:all'])
export class BackupController {
  private readonly logger = new Logger(BackupController.name);
  constructor(private backupService: BackupService) {}

  @Post()
  async createBackup(@Body() body: { name?: string } | undefined) {
    try {
      return await this.backupService.createBackup(body?.name);
    } catch (err) {
      this.logger.error(
        `createBackup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  @Get()
  listBackups() {
    return this.backupService.listBackups();
  }

  @Post('restore')
  async restoreBackup(@Body() body: { fileName: string }) {
    await this.backupService.restoreBackup(body.fileName);
    return { success: true };
  }

  @Delete(':fileName')
  deleteBackup(@Param('fileName') fileName: string) {
    this.backupService.deleteBackup(fileName);
    return { success: true };
  }
}

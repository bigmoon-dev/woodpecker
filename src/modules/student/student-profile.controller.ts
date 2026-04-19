import { Controller, Get, Param, UseGuards, SetMetadata } from '@nestjs/common';
import { StudentProfileService } from './student-profile.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';

@Controller('api/students')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['alert:read'])
export class StudentProfileController {
  constructor(private profileService: StudentProfileService) {}

  @Get(':id/profile')
  async getProfile(@Param('id') id: string) {
    return this.profileService.getProfile(id);
  }
}

@Controller('api/followups')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['alert:read'])
export class FollowupController {
  constructor(private profileService: StudentProfileService) {}

  @Get('pending')
  async getPending() {
    return this.profileService.getPendingFollowups();
  }
}

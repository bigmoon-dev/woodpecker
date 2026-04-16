import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { Permission } from '../../entities/auth/permission.entity';
import { RefreshToken } from '../../entities/auth/refresh-token.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { RbacGuard } from './rbac.guard';
import { DataScopeFilter } from './data-scope-filter';
import { ReauthGuard } from './reauth.guard';
import { ThemePreferenceService } from './theme-preference.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Permission,
      Student,
      Class,
      RefreshToken,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            'JWT_SECRET environment variable is required. Set it before starting the application.',
          );
        }
        return { secret, signOptions: { expiresIn: '15m' } };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    JwtStrategy,
    RbacGuard,
    DataScopeFilter,
    ReauthGuard,
    ThemePreferenceService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, JwtModule, RbacGuard, DataScopeFilter, ReauthGuard],
})
export class AuthModule {}

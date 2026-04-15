import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

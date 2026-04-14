import { IsString, IsNotEmpty } from 'class-validator';

export class HandleAlertDto {
  @IsString()
  @IsNotEmpty()
  handleNote: string;
}

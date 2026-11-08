import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import { normalizeEmailIfString } from '../../common/dto/email.transform';

export class RequestPasswordResetDto {
  @Transform(normalizeEmailIfString)
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

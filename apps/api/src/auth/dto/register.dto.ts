import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeEmailIfString } from '../../common/dto/email.transform';
import { trimIfString } from '../../common/dto/trim.transform';

export class RegisterDto {
  @Transform(normalizeEmailIfString)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // Sans `@` : la connexion accepte e-mail OU pseudo, un pseudo en forme d'adresse pourrait usurper
  // l'e-mail d'un autre compte à l'écran de connexion.
  @Transform(trimIfString)
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[^@]+$/, { message: 'Le pseudo ne peut pas contenir « @ ».' })
  pseudo!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** Token d'un lien d'invitation : l'inscription est ouverte **uniquement** sur invitation (spec §2). */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  token!: string;
}

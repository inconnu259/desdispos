import { IsString, MaxLength, MinLength } from 'class-validator';

/** Corps de `DELETE /me` (Story 43.2) : le mot de passe du compte, jamais un identifiant. */
export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

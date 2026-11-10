import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export class CreateInviteLinkDto {
  /** null/absent = usage illimité · 1 = usage unique · N = X joueurs. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses?: number;

  /** ISO 8601 ; défaut +7 jours si absent, 90 jours au plus. */
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

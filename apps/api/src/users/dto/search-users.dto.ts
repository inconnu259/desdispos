import { IsString, MaxLength, MinLength } from 'class-validator';

export class SearchUsersDto {
  @IsString()
  @MinLength(2)
  @MaxLength(254)
  q!: string;
}

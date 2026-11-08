import { IsString, MaxLength } from 'class-validator';

export class SetResumeFinDto {
  @IsString()
  @MaxLength(20000)
  resumeFin!: string;
}

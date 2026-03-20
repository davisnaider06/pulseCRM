import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  leadId!: string;

  @IsString()
  sellerId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  legalDocument?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

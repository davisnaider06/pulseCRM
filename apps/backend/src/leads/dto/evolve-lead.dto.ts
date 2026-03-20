import { IsEnum } from 'class-validator';

export enum LeadEvolutionAction {
  ADVANCE_STAGE = 'ADVANCE_STAGE',
  FINALIZE_SALE = 'FINALIZE_SALE',
  FINALIZE_WITHOUT_SALE = 'FINALIZE_WITHOUT_SALE',
}

export class EvolveLeadDto {
  @IsEnum(LeadEvolutionAction)
  action!: LeadEvolutionAction;
}

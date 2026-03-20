import { LeadOrigin } from '@prisma/client';
import { CreateLeadDto } from '../../dto/create-lead.dto';

export interface LeadOriginHandler {
  readonly origin: LeadOrigin;
  toCreateData(dto: CreateLeadDto): {
    origin: LeadOrigin;
    entryChannel: string;
  };
}

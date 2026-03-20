import { Injectable } from '@nestjs/common';
import { LeadStatus, type Prisma } from '@prisma/client';
import { LEAD_STAGES } from '../../constants/lead-negotiation.constants';
import { CreateLeadDto } from '../../dto/create-lead.dto';
import {
  InstagramLeadOriginHandler,
  PhoneLeadOriginHandler,
  PresentialLeadOriginHandler,
  WhatsAppLeadOriginHandler,
} from './lead-origin-handlers';
import { LeadOriginHandler } from './lead-origin-handler.interface';

@Injectable()
export class LeadFactoryService {
  private readonly handlers = new Map(
    [
      new PresentialLeadOriginHandler(),
      new PhoneLeadOriginHandler(),
      new WhatsAppLeadOriginHandler(),
      new InstagramLeadOriginHandler(),
    ].map((handler) => [handler.origin, handler] satisfies [string, LeadOriginHandler]),
  );

  create(dto: CreateLeadDto, sellerId: string | null, stageId: string | null): Prisma.LeadCreateInput {
    const handler = this.handlers.get(dto.origin);

    if (!handler) {
      throw new Error(`Origem de lead nao suportada: ${dto.origin}`);
    }

    const originData = handler.toCreateData(dto);

    return {
      name: dto.name,
      phone: dto.phone,
      email: dto.email?.toLowerCase(),
      company: dto.company,
      vehicleInterest: dto.vehicleInterest,
      origin: originData.origin,
      entryChannel: originData.entryChannel,
      notes: dto.notes,
      owner: sellerId ? { connect: { id: sellerId } } : undefined,
      currentStage: stageId ? { connect: { id: stageId } } : undefined,
      status: LeadStatus.ABERTO,
      temperature: 'WARM',
      segment: LEAD_STAGES.CONTACT_INITIAL,
    };
  }
}

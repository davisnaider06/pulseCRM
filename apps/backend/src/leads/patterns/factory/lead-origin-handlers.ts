import { LeadOrigin } from '@prisma/client';
import { LEAD_ORIGIN_LABELS } from '../../constants/lead-negotiation.constants';
import { CreateLeadDto } from '../../dto/create-lead.dto';
import { LeadOriginHandler } from './lead-origin-handler.interface';

abstract class BaseLeadOriginHandler implements LeadOriginHandler {
  abstract readonly origin: LeadOrigin;

  toCreateData(_dto: CreateLeadDto) {
    return {
      origin: this.origin,
      entryChannel: LEAD_ORIGIN_LABELS[this.origin],
    };
  }
}

export class PresentialLeadOriginHandler extends BaseLeadOriginHandler {
  readonly origin = LeadOrigin.VISITA_PRESENCIAL;
}

export class PhoneLeadOriginHandler extends BaseLeadOriginHandler {
  readonly origin = LeadOrigin.TELEFONE;
}

export class WhatsAppLeadOriginHandler extends BaseLeadOriginHandler {
  readonly origin = LeadOrigin.WHATSAPP;
}

export class InstagramLeadOriginHandler extends BaseLeadOriginHandler {
  readonly origin = LeadOrigin.INSTAGRAM;
}

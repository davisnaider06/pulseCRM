import { Injectable } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { LEAD_STAGES } from '../../constants/lead-negotiation.constants';
import {
  ContactInitialState,
  FinalizedWithSaleState,
  FinalizedWithoutSaleState,
  ProposalSentState,
  WaitingCustomerState,
  WaitingPaymentState,
} from './lead-negotiation-states';

@Injectable()
export class LeadStateFactory {
  create(stageName: string | null | undefined, status: LeadStatus) {
    if (status === LeadStatus.FINALIZADO_COM_VENDA) {
      return new FinalizedWithSaleState();
    }

    if (status === LeadStatus.FINALIZADO_SEM_VENDA) {
      return new FinalizedWithoutSaleState();
    }

    switch (stageName) {
      case LEAD_STAGES.PROPOSAL_SENT:
        return new ProposalSentState();
      case LEAD_STAGES.WAITING_CUSTOMER:
        return new WaitingCustomerState();
      case LEAD_STAGES.WAITING_PAYMENT:
        return new WaitingPaymentState();
      case LEAD_STAGES.CONTACT_INITIAL:
      default:
        return new ContactInitialState();
    }
  }
}

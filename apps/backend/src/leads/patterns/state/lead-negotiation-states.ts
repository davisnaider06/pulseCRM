import { BadRequestException } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { LEAD_STAGES } from '../../constants/lead-negotiation.constants';
import { LeadNegotiationState, LeadTransitionResult } from './lead-negotiation-state.interface';

abstract class BaseLeadNegotiationState implements LeadNegotiationState {
  protected saleResult(): LeadTransitionResult {
    return {
      stageName: LEAD_STAGES.WAITING_PAYMENT,
      status: LeadStatus.FINALIZADO_COM_VENDA,
    };
  }

  protected lossResult(stageName: string): LeadTransitionResult {
    return {
      stageName,
      status: LeadStatus.FINALIZADO_SEM_VENDA,
    };
  }

  advanceStage(): LeadTransitionResult {
    throw new BadRequestException('Nao e possivel avancar este lead.');
  }

  finalizeWithSale(): LeadTransitionResult {
    throw new BadRequestException('Nao e possivel finalizar com venda neste momento.');
  }

  finalizeWithoutSale(): LeadTransitionResult {
    throw new BadRequestException('Nao e possivel finalizar sem venda neste momento.');
  }
}

export class ContactInitialState extends BaseLeadNegotiationState {
  override advanceStage(): LeadTransitionResult {
    return { stageName: LEAD_STAGES.PROPOSAL_SENT, status: LeadStatus.EM_NEGOCIACAO };
  }

  override finalizeWithoutSale(): LeadTransitionResult {
    return this.lossResult(LEAD_STAGES.CONTACT_INITIAL);
  }
}

export class ProposalSentState extends BaseLeadNegotiationState {
  override advanceStage(): LeadTransitionResult {
    return { stageName: LEAD_STAGES.WAITING_CUSTOMER, status: LeadStatus.EM_NEGOCIACAO };
  }

  override finalizeWithoutSale(): LeadTransitionResult {
    return this.lossResult(LEAD_STAGES.PROPOSAL_SENT);
  }
}

export class WaitingCustomerState extends BaseLeadNegotiationState {
  override advanceStage(): LeadTransitionResult {
    return { stageName: LEAD_STAGES.WAITING_PAYMENT, status: LeadStatus.EM_NEGOCIACAO };
  }

  override finalizeWithoutSale(): LeadTransitionResult {
    return this.lossResult(LEAD_STAGES.WAITING_CUSTOMER);
  }
}

export class WaitingPaymentState extends BaseLeadNegotiationState {
  override finalizeWithSale(): LeadTransitionResult {
    return this.saleResult();
  }

  override finalizeWithoutSale(): LeadTransitionResult {
    return this.lossResult(LEAD_STAGES.WAITING_PAYMENT);
  }
}

export class FinalizedWithSaleState extends BaseLeadNegotiationState {
  override advanceStage(): LeadTransitionResult {
    throw new BadRequestException('Lead finalizada nao pode continuar evoluindo.');
  }
}

export class FinalizedWithoutSaleState extends BaseLeadNegotiationState {
  override advanceStage(): LeadTransitionResult {
    throw new BadRequestException('Lead finalizada nao pode continuar evoluindo.');
  }
}

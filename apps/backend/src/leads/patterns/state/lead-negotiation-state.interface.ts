import { LeadStatus } from '@prisma/client';

export type LeadTransitionResult = {
  stageName: string;
  status: LeadStatus;
};

export interface LeadNegotiationState {
  advanceStage(): LeadTransitionResult;
  finalizeWithSale(): LeadTransitionResult;
  finalizeWithoutSale(): LeadTransitionResult;
}

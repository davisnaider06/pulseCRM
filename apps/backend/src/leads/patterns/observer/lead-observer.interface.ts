import { Prisma } from '@prisma/client';

export type LeadObserverPayload = {
  leadId: string;
  userId?: string | null;
  action: string;
  previousData?: Prisma.InputJsonValue;
  currentData?: Prisma.InputJsonValue;
};

export interface LeadObserver {
  notify(payload: LeadObserverPayload): Promise<void>;
}

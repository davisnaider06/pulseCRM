import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LeadObserver, LeadObserverPayload } from './lead-observer.interface';

@Injectable()
export class AuditLogLeadObserver implements LeadObserver {
  constructor(private readonly prisma: PrismaService) {}

  async notify(payload: LeadObserverPayload) {
    await this.prisma.auditLog.create({
      data: {
        entityName: 'lead',
        entityId: payload.leadId,
        action: payload.action,
        userId: payload.userId ?? undefined,
        leadId: payload.leadId,
        previousData: payload.previousData,
        currentData: payload.currentData,
      },
    });
  }
}

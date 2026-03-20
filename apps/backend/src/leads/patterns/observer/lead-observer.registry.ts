import { Injectable } from '@nestjs/common';
import { AuditLogLeadObserver } from './audit-log-lead.observer';
import { LeadObserverPayload } from './lead-observer.interface';

@Injectable()
export class LeadObserverRegistry {
  constructor(private readonly auditLogObserver: AuditLogLeadObserver) {}

  async notifyAll(payload: LeadObserverPayload) {
    await Promise.all([this.auditLogObserver.notify(payload)]);
  }
}

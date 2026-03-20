import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadNegotiationFacade } from './patterns/facade/lead-negotiation.facade';
import { LeadFactoryService } from './patterns/factory/lead-factory.service';
import { AuditLogLeadObserver } from './patterns/observer/audit-log-lead.observer';
import { LeadObserverRegistry } from './patterns/observer/lead-observer.registry';
import { LeadStateFactory } from './patterns/state/lead-state.factory';

@Module({
  imports: [DatabaseModule],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    LeadNegotiationFacade,
    LeadFactoryService,
    LeadStateFactory,
    AuditLogLeadObserver,
    LeadObserverRegistry,
  ],
  exports: [LeadsService],
})
export class LeadsModule {}

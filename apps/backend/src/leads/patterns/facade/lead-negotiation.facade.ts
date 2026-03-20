import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { PrismaService } from '../../../database/prisma.service';
import { LEAD_STAGES, SELLER_ROLE_NAME } from '../../constants/lead-negotiation.constants';
import { CreateLeadDto } from '../../dto/create-lead.dto';
import { EvolveLeadDto, LeadEvolutionAction } from '../../dto/evolve-lead.dto';
import { LeadFactoryService } from '../factory/lead-factory.service';
import { LeadObserverRegistry } from '../observer/lead-observer.registry';
import { LeadStateFactory } from '../state/lead-state.factory';

@Injectable()
export class LeadNegotiationFacade {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadFactory: LeadFactoryService,
    private readonly leadStateFactory: LeadStateFactory,
    private readonly observers: LeadObserverRegistry,
  ) {}

  async createLead(dto: CreateLeadDto, user: AuthenticatedUser) {
    const sellerId = await this.resolveSellerId(dto.sellerId ?? user.sub);
    const stage = await this.ensureStageExists(LEAD_STAGES.CONTACT_INITIAL);

    const lead = await this.prisma.lead.create({
      data: {
        ...this.leadFactory.create(dto, sellerId, stage.id),
        pipeline: stage.pipelineId ? { connect: { id: stage.pipelineId } } : undefined,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        currentStage: { select: { id: true, name: true, order: true } },
        client: { select: { id: true, name: true } },
      },
    });

    await this.prisma.leadStageHistory.create({
      data: {
        leadId: lead.id,
        stageId: stage.id,
        movedByUserId: user.sub,
        notes: 'Lead criada',
      },
    });

    await this.observers.notifyAll({
      leadId: lead.id,
      userId: user.sub,
      action: 'lead_created',
      currentData: {
        stage: stage.name,
        status: lead.status,
        origin: lead.origin,
      },
    });

    return lead;
  }

  async evolveLead(leadId: string, dto: EvolveLeadDto, user: AuthenticatedUser) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { currentStage: true },
    });

    if (!lead) {
      throw new NotFoundException('Lead nao encontrada.');
    }

    const state = this.leadStateFactory.create(lead.currentStage?.name, lead.status);
    const previous = {
      stage: lead.currentStage?.name ?? null,
      status: lead.status,
    };

    const transition =
      dto.action === LeadEvolutionAction.ADVANCE_STAGE
        ? state.advanceStage()
        : dto.action === LeadEvolutionAction.FINALIZE_SALE
          ? state.finalizeWithSale()
          : state.finalizeWithoutSale();

    const nextStage = await this.ensureStageExists(transition.stageName);

    const updatedLead = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: transition.status,
        currentStageId: nextStage.id,
        pipelineId: nextStage.pipelineId,
        segment: transition.stageName,
        convertedAt:
          transition.status === LeadStatus.FINALIZADO_COM_VENDA ? new Date() : null,
        lostAt:
          transition.status === LeadStatus.FINALIZADO_SEM_VENDA ? new Date() : null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        currentStage: { select: { id: true, name: true, order: true } },
        client: { select: { id: true, name: true } },
      },
    });

    await this.closeCurrentHistory(lead.id);
    await this.prisma.leadStageHistory.create({
      data: {
        leadId: lead.id,
        stageId: nextStage.id,
        movedByUserId: user.sub,
        notes: dto.action,
      },
    });

    await this.observers.notifyAll({
      leadId: lead.id,
      userId: user.sub,
      action: 'lead_evolved',
      previousData: previous,
      currentData: {
        stage: transition.stageName,
        status: transition.status,
        action: dto.action,
      },
    });

    return updatedLead;
  }

  private async ensureStageExists(stageName: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { name: stageName },
      select: { id: true, name: true, pipelineId: true },
    });

    if (!stage) {
      throw new BadRequestException(`Estagio nao encontrado: ${stageName}`);
    }

    return stage;
  }

  private async resolveSellerId(sellerId?: string | null) {
    if (!sellerId) {
      return null;
    }

    const seller = await this.prisma.user.findFirst({
      where: {
        id: sellerId,
        roles: {
          some: {
            role: { name: SELLER_ROLE_NAME },
          },
        },
      },
      select: { id: true },
    });

    if (!seller) {
      throw new BadRequestException('Vendedor invalido.');
    }

    return seller.id;
  }

  private async closeCurrentHistory(leadId: string) {
    const current = await this.prisma.leadStageHistory.findFirst({
      where: { leadId, exitedAt: null },
      orderBy: { enteredAt: 'desc' },
      select: { id: true },
    });

    if (!current) {
      return;
    }

    await this.prisma.leadStageHistory.update({
      where: { id: current.id },
      data: { exitedAt: new Date() },
    });
  }
}

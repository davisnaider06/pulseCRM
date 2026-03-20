import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../database/prisma.service';
import { LEAD_ORIGIN_LABELS, LEAD_STAGE_SEQUENCE, SELLER_ROLE_NAME } from './constants/lead-negotiation.constants';
import { CreateLeadDto } from './dto/create-lead.dto';
import { EvolveLeadDto } from './dto/evolve-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadNegotiationFacade } from './patterns/facade/lead-negotiation.facade';

const leadInclude = {
  owner: { select: { id: true, name: true, email: true } },
  currentStage: { select: { id: true, name: true, order: true } },
  client: { select: { id: true, name: true, sellerId: true } },
  _count: { select: { interactions: true } },
} satisfies Prisma.LeadInclude;

type LeadRecord = Prisma.LeadGetPayload<{ include: typeof leadInclude }>;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly facade: LeadNegotiationFacade,
  ) {}

  async list(query: ListLeadsDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Prisma.LeadWhereInput = {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { vehicleInterest: { contains: query.search, mode: 'insensitive' } },
              { company: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.origin ? { origin: query.origin } : {}),
      ...(query.sellerId ? { ownerId: query.sellerId } : {}),
    };

    const [items, total, aberto, emNegociacao, finalizadoComVenda, finalizadoSemVenda] =
      await Promise.all([
        this.prisma.lead.findMany({
          where,
          include: leadInclude,
          orderBy: [{ updatedAt: 'desc' }],
          skip,
          take: perPage,
        }),
        this.prisma.lead.count({ where }),
        this.prisma.lead.count({ where: { ...where, status: LeadStatus.ABERTO } }),
        this.prisma.lead.count({ where: { ...where, status: LeadStatus.EM_NEGOCIACAO } }),
        this.prisma.lead.count({ where: { ...where, status: LeadStatus.FINALIZADO_COM_VENDA } }),
        this.prisma.lead.count({ where: { ...where, status: LeadStatus.FINALIZADO_SEM_VENDA } }),
      ]);

    return {
      items: items.map((item) => this.serialize(item)),
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
      summary: {
        aberto,
        emNegociacao,
        finalizadoComVenda,
        finalizadoSemVenda,
      },
    };
  }

  async meta() {
    const [sellers, stages, leadsWithoutClient] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          roles: {
            some: {
              role: { name: SELLER_ROLE_NAME },
            },
          },
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true },
      }),
      this.prisma.pipelineStage.findMany({
        where: { name: { in: [...LEAD_STAGE_SEQUENCE] } },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, order: true },
      }),
      this.prisma.lead.findMany({
        where: { client: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, vehicleInterest: true, status: true },
      }),
    ]);

    return {
      sellers,
      stages,
      origins: Object.entries(LEAD_ORIGIN_LABELS).map(([value, label]) => ({ value, label })),
      statuses: [
        LeadStatus.ABERTO,
        LeadStatus.EM_NEGOCIACAO,
        LeadStatus.FINALIZADO_COM_VENDA,
        LeadStatus.FINALIZADO_SEM_VENDA,
      ],
      availableLeadsForClient: leadsWithoutClient,
    };
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        ...leadInclude,
        stageHistory: {
          orderBy: { enteredAt: 'asc' },
          include: { stage: { select: { id: true, name: true } } },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead nao encontrada.');
    }

    return {
      ...this.serialize(lead),
      history: lead.stageHistory.map((item) => ({
        id: item.id,
        stage: item.stage.name,
        enteredAt: item.enteredAt,
        exitedAt: item.exitedAt,
        notes: item.notes,
      })),
    };
  }

  create(dto: CreateLeadDto, user: AuthenticatedUser) {
    return this.facade.createLead(dto, user);
  }

  evolve(id: string, dto: EvolveLeadDto, user: AuthenticatedUser) {
    return this.facade.evolveLead(id, dto, user);
  }

  async update(id: string, dto: UpdateLeadDto) {
    const existing = await this.prisma.lead.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Lead nao encontrada.');
    }

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.toLowerCase() ?? null } : {}),
        ...(dto.company !== undefined ? { company: dto.company } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.vehicleInterest !== undefined ? { vehicleInterest: dto.vehicleInterest } : {}),
        ...(dto.sellerId !== undefined ? { ownerId: dto.sellerId } : {}),
      },
      include: leadInclude,
    });

    return this.serialize(lead);
  }

  async dashboardOverview() {
    const [leadSummary, clientsCount, sellersCount, recentLeads] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['status'], _count: { status: true } }),
      this.prisma.client.count(),
      this.prisma.user.count({
        where: {
          roles: {
            some: {
              role: { name: SELLER_ROLE_NAME },
            },
          },
        },
      }),
      this.prisma.lead.findMany({
        include: leadInclude,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const countByStatus = new Map(leadSummary.map((item) => [item.status, item._count.status]));

    return {
      cards: [
        { label: 'Leads abertas', value: countByStatus.get(LeadStatus.ABERTO) ?? 0 },
        { label: 'Em negociacao', value: countByStatus.get(LeadStatus.EM_NEGOCIACAO) ?? 0 },
        { label: 'Clientes', value: clientsCount },
        { label: 'Vendedores', value: sellersCount },
      ],
      recentLeads: recentLeads.map((lead) => this.serialize(lead)),
    };
  }

  private serialize(lead: LeadRecord) {
    return {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      company: lead.company,
      vehicleInterest: lead.vehicleInterest,
      origin: lead.origin,
      originLabel: lead.origin ? LEAD_ORIGIN_LABELS[lead.origin as keyof typeof LEAD_ORIGIN_LABELS] : null,
      stage: lead.currentStage?.name ?? null,
      status: lead.status,
      seller: lead.owner,
      client: lead.client,
      interactionCount: lead._count.interactions,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }
}

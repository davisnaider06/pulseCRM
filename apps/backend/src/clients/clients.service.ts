import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SELLER_ROLE_NAME } from '../leads/constants/lead-negotiation.constants';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.client.findMany({
      include: {
        lead: { select: { id: true, name: true, vehicleInterest: true, status: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true, vehicleInterest: true, status: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente nao encontrado.');
    }

    return client;
  }

  async create(dto: CreateClientDto) {
    await this.ensureSeller(dto.sellerId);

    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
      include: { client: true },
    });

    if (!lead) {
      throw new NotFoundException('Lead nao encontrada para vincular ao cliente.');
    }

    if (lead.client) {
      throw new BadRequestException('Esta lead ja esta vinculada a um cliente.');
    }

    const client = await this.prisma.client.create({
      data: {
        leadId: dto.leadId,
        sellerId: dto.sellerId,
        name: dto.name,
        legalDocument: dto.legalDocument,
        city: dto.city,
        state: dto.state,
        notes: dto.notes,
      },
      include: {
        lead: { select: { id: true, name: true, vehicleInterest: true, status: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    });

    await this.prisma.lead.update({
      where: { id: dto.leadId },
      data: { status: LeadStatus.FINALIZADO_COM_VENDA },
    });

    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);

    if (dto.sellerId) {
      await this.ensureSeller(dto.sellerId);
    }

    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.legalDocument !== undefined ? { legalDocument: dto.legalDocument } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.sellerId !== undefined ? { sellerId: dto.sellerId } : {}),
      },
      include: {
        lead: { select: { id: true, name: true, vehicleInterest: true, status: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.delete({ where: { id } });
    return { message: 'Cliente removido com sucesso.' };
  }

  private async ensureSeller(sellerId: string) {
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
  }
}

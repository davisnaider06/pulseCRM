import { Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { SELLER_ROLE_NAME } from '../leads/constants/lead-negotiation.constants';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: { name: SELLER_ROLE_NAME },
          },
        },
      },
      include: {
        _count: {
          select: {
            ownedLeads: true,
            managedClients: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const seller = await this.prisma.user.findFirst({
      where: {
        id,
        roles: {
          some: {
            role: { name: SELLER_ROLE_NAME },
          },
        },
      },
      include: {
        _count: {
          select: {
            ownedLeads: true,
            managedClients: true,
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Vendedor nao encontrado.');
    }

    return seller;
  }

  async create(dto: CreateSellerDto) {
    const role = await this.ensureSellerRole();
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        passwordHash,
        roles: {
          create: {
            roleId: role.id,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateSellerDto) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.password !== undefined
          ? { passwordHash: await bcrypt.hash(dto.password, 10) }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Vendedor removido com sucesso.' };
  }

  private async ensureSellerRole() {
    return this.prisma.role.upsert({
      where: { name: SELLER_ROLE_NAME },
      update: {},
      create: {
        name: SELLER_ROLE_NAME,
        description: 'Perfil de vendedor',
        isSystem: true,
      },
    });
  }
}

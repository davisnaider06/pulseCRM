const { LeadOrigin, LeadStatus, PermissionAction, PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function ensureRole(name, description) {
  return prisma.role.upsert({
    where: { name },
    update: { description, isSystem: true },
    create: { name, description, isSystem: true },
  });
}

async function ensureUserRole(userId, roleId) {
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId, roleId },
    },
    update: {},
    create: { userId, roleId },
  });
}

async function main() {
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? 'teste123';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  for (const [resource, action] of [
    ['dashboard', PermissionAction.VIEW],
    ['leads', PermissionAction.MANAGE],
    ['clients', PermissionAction.MANAGE],
    ['sellers', PermissionAction.MANAGE],
  ]) {
    await prisma.permission.upsert({
      where: { resource_action: { resource, action } },
      update: {},
      create: { resource, action },
    });
  }

  const adminRole = await ensureRole('admin', 'Administrador do CRM');
  const sellerRole = await ensureRole('vendedor', 'Vendedor da equipe comercial');

  const team = await prisma.team.upsert({
    where: { name: 'Equipe Comercial' },
    update: {},
    create: { name: 'Equipe Comercial', description: 'Equipe principal de vendas' },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@crm.local' },
    update: {
      name: 'Administrador CRM',
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
      isSuperAdmin: true,
      teamId: team.id,
    },
    create: {
      name: 'Administrador CRM',
      email: process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@crm.local',
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
      isSuperAdmin: true,
      teamId: team.id,
    },
  });

  await ensureUserRole(adminUser.id, adminRole.id);

  const sellersInput = [
    { email: 'ana@crm.local', name: 'Ana Costa', phone: '(11) 99881-1100' },
    { email: 'bruno@crm.local', name: 'Bruno Lima', phone: '(21) 99882-2200' },
  ];

  const sellers = [];
  for (const sellerInput of sellersInput) {
    const seller = await prisma.user.upsert({
      where: { email: sellerInput.email },
      update: {
        name: sellerInput.name,
        phone: sellerInput.phone,
        passwordHash: adminPasswordHash,
        teamId: team.id,
        status: 'ACTIVE',
      },
      create: {
        ...sellerInput,
        passwordHash: adminPasswordHash,
        teamId: team.id,
        status: 'ACTIVE',
      },
    });

    await ensureUserRole(seller.id, sellerRole.id);
    sellers.push(seller);
  }

  const pipeline = await prisma.pipeline.upsert({
    where: { id: 'pipeline-crm-basico' },
    update: { name: 'Negociacao de Leads', isDefault: true, isActive: true },
    create: {
      id: 'pipeline-crm-basico',
      name: 'Negociacao de Leads',
      description: 'Fluxo basico da atividade de padroes de projeto',
      isDefault: true,
      isActive: true,
    },
  });

  const stages = [
    'Contato inicial',
    'Enviou proposta',
    'Aguardando resposta do cliente',
    'Aguardando pagamento',
  ];

  for (const [index, stageName] of stages.entries()) {
    await prisma.pipelineStage.upsert({
      where: {
        pipelineId_order: {
          pipelineId: pipeline.id,
          order: index + 1,
        },
      },
      update: { name: stageName },
      create: {
        pipelineId: pipeline.id,
        order: index + 1,
        name: stageName,
      },
    });
  }

  const pipelineStages = await prisma.pipelineStage.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { order: 'asc' },
  });

  const sourceMap = {
    [LeadOrigin.VISITA_PRESENCIAL]: 'Visita presencial',
    [LeadOrigin.TELEFONE]: 'Telefone',
    [LeadOrigin.WHATSAPP]: 'WhatsApp',
    [LeadOrigin.INSTAGRAM]: 'Instagram',
  };

  const leadsInput = [
    {
      id: 'lead-crm-1',
      name: 'Marcio Fernandes',
      phone: '(11) 99991-0001',
      email: 'marcio@email.com',
      origin: LeadOrigin.WHATSAPP,
      vehicleInterest: 'Toyota Corolla 2023',
      company: 'Cliente particular',
      sellerId: sellers[0].id,
      stageName: 'Enviou proposta',
      status: LeadStatus.EM_NEGOCIACAO,
    },
    {
      id: 'lead-crm-2',
      name: 'Luciana Rocha',
      phone: '(21) 98882-0033',
      email: 'luciana@email.com',
      origin: LeadOrigin.INSTAGRAM,
      vehicleInterest: 'Honda HR-V 2022',
      company: 'Cliente particular',
      sellerId: sellers[1].id,
      stageName: 'Contato inicial',
      status: LeadStatus.ABERTO,
    },
    {
      id: 'lead-crm-3',
      name: 'Paulo Mendes',
      phone: '(31) 97771-3000',
      email: 'paulo@email.com',
      origin: LeadOrigin.TELEFONE,
      vehicleInterest: 'Jeep Compass 2021',
      company: 'Cliente particular',
      sellerId: sellers[0].id,
      stageName: 'Aguardando pagamento',
      status: LeadStatus.FINALIZADO_COM_VENDA,
    },
  ];

  for (const leadInput of leadsInput) {
    const stage = pipelineStages.find((item) => item.name === leadInput.stageName);

    const lead = await prisma.lead.upsert({
      where: { id: leadInput.id },
      update: {
        name: leadInput.name,
        phone: leadInput.phone,
        email: leadInput.email,
        origin: leadInput.origin,
        entryChannel: sourceMap[leadInput.origin],
        vehicleInterest: leadInput.vehicleInterest,
        company: leadInput.company,
        ownerId: leadInput.sellerId,
        pipelineId: pipeline.id,
        currentStageId: stage?.id,
        segment: leadInput.stageName,
        status: leadInput.status,
        convertedAt:
          leadInput.status === LeadStatus.FINALIZADO_COM_VENDA ? new Date('2026-03-20T12:00:00.000Z') : null,
      },
      create: {
        id: leadInput.id,
        name: leadInput.name,
        phone: leadInput.phone,
        email: leadInput.email,
        origin: leadInput.origin,
        entryChannel: sourceMap[leadInput.origin],
        vehicleInterest: leadInput.vehicleInterest,
        company: leadInput.company,
        ownerId: leadInput.sellerId,
        pipelineId: pipeline.id,
        currentStageId: stage?.id,
        segment: leadInput.stageName,
        status: leadInput.status,
        convertedAt:
          leadInput.status === LeadStatus.FINALIZADO_COM_VENDA ? new Date('2026-03-20T12:00:00.000Z') : null,
      },
    });

    if (stage) {
      await prisma.leadStageHistory.create({
        data: {
          leadId: lead.id,
          stageId: stage.id,
          movedByUserId: leadInput.sellerId,
          notes: 'Seed inicial',
        },
      }).catch(() => undefined);
    }
  }

  const soldLead = await prisma.lead.findUnique({ where: { id: 'lead-crm-3' } });

  if (soldLead) {
    await prisma.client.upsert({
      where: { leadId: soldLead.id },
      update: {
        name: soldLead.name,
        sellerId: soldLead.ownerId,
        city: 'Belo Horizonte',
        state: 'MG',
      },
      create: {
        leadId: soldLead.id,
        sellerId: soldLead.ownerId,
        name: soldLead.name,
        city: 'Belo Horizonte',
        state: 'MG',
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

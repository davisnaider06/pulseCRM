export const LEAD_STAGES = {
  CONTACT_INITIAL: 'Contato inicial',
  PROPOSAL_SENT: 'Enviou proposta',
  WAITING_CUSTOMER: 'Aguardando resposta do cliente',
  WAITING_PAYMENT: 'Aguardando pagamento',
} as const;

export const LEAD_STAGE_SEQUENCE = [
  LEAD_STAGES.CONTACT_INITIAL,
  LEAD_STAGES.PROPOSAL_SENT,
  LEAD_STAGES.WAITING_CUSTOMER,
  LEAD_STAGES.WAITING_PAYMENT,
] as const;

export const LEAD_ORIGIN_LABELS = {
  VISITA_PRESENCIAL: 'Visita presencial',
  TELEFONE: 'Telefone',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
} as const;

export const SELLER_ROLE_NAME = 'vendedor';

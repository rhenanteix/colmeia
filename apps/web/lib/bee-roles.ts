export const BEE_ROLES = [
  'rainha',
  'atendimento',
  'exploradora',
  'financeiro',
  'operacoes',
  'rh',
  'seguranca',
  'vendas',
] as const;
export type BeeRole = (typeof BEE_ROLES)[number];
export const beeAsset = (role: BeeRole) => `/bees/${role}.png`;

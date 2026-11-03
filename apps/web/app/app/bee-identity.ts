export const beeRoles = [
  {
    key: 'rainha',
    name: 'Rainha',
    role: 'Coordenação',
    keywords: ['rainha', 'coordena', 'gestão', 'gestao'],
  },
  {
    key: 'atendimento',
    name: 'Atendimento',
    role: 'Suporte',
    keywords: ['atendimento', 'suporte', 'sac'],
  },
  {
    key: 'exploradora',
    name: 'Exploradora',
    role: 'Pesquisa',
    keywords: ['exploradora', 'pesquisa', 'inteligência', 'inteligencia'],
  },
  {
    key: 'financeiro',
    name: 'Financeiro',
    role: 'Finanças',
    keywords: ['financeiro', 'finanças', 'financas'],
  },
  {
    key: 'operacoes',
    name: 'Operações',
    role: 'Processos',
    keywords: ['opera', 'logística', 'logistica'],
  },
  { key: 'rh', name: 'RH', role: 'Pessoas', keywords: ['rh', 'recursos humanos', 'pessoas'] },
  {
    key: 'seguranca',
    name: 'Segurança',
    role: 'Proteção',
    keywords: ['segurança', 'seguranca', 'proteção', 'protecao'],
  },
  {
    key: 'vendas',
    name: 'Vendas',
    role: 'Comercial',
    keywords: ['vendas', 'comercial', 'pré-vendas', 'pre-vendas'],
  },
] as const;
export type BeeKey = (typeof beeRoles)[number]['key'];
export function beeFor(name: string): BeeKey {
  const n = name.toLocaleLowerCase('pt-BR');
  return (
    beeRoles.find((b) => b.key === n || b.keywords.some((k) => n.includes(k)))?.key ?? 'exploradora'
  );
}
export function beeImage(key: BeeKey) {
  return '/bees/' + key + '.png';
}

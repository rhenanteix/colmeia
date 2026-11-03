import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const bees = [
  ['rainha', 'Rainha', 'Coordenação'],
  ['atendimento', 'Atendimento', 'Suporte'],
  ['exploradora', 'Exploradora', 'Pesquisa'],
  ['financeiro', 'Financeiro', 'Finanças'],
  ['operacoes', 'Operações', 'Processos'],
  ['rh', 'RH', 'Recursos humanos'],
  ['seguranca', 'Segurança', 'Segurança'],
  ['vendas', 'Vendas', 'Comercial'],
];
try {
  for (const [mascot, name, category] of bees) {
    const data = {
      name: `Abelha ${name}`,
      category,
      description: `Especialista em ${category.toLowerCase()}.`,
      config: {
        mascot,
        objective: category,
        instructions: `Atue como especialista em ${category.toLowerCase()}. Responda com clareza, peça contexto quando necessário e sinalize incertezas.`,
        provider: 'openai',
        model: '',
        tone: 'Profissional e acolhedor',
      },
    };
    await db.agentTemplate.upsert({
      where: { id: `official-${mascot}` },
      create: { id: `official-${mascot}`, ...data },
      update: data,
    });
  }
  console.log('8 templates oficiais atualizados.');
} finally {
  await db.$disconnect();
}

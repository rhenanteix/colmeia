import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

test('Tasks persist status, expose accessible controls and fit the viewport', async ({
  page,
  context,
  baseURL,
}) => {
  const signup = await context.request.post('/api/backend/auth/register', {
    headers: { Origin: baseURL! },
    data: {
      email: `tasks-${crypto.randomUUID()}@example.test`,
      password: 'Tasks-password-2026',
      name: 'Tasks QA',
      organizationName: 'Tasks QA',
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto('/app/tasks');
  await expect(page.getByText('Nenhuma tarefa cadastrada')).toBeVisible();
  await page.getByLabel('Nova tarefa').fill('Validar tarefa');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByRole('status')).toHaveText('Tarefa criada.');
  await page.getByLabel('Status de Validar tarefa').selectOption('done');
  await expect(page.getByRole('status')).toHaveText('Tarefa atualizada.');
  await page.reload();
  await expect(page.getByLabel('Status de Validar tarefa')).toHaveValue('done');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: `test-results/tasks-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('Kanban board persists movement, details, comments and archive', async ({
  page,
  context,
  baseURL,
}) => {
  const signup = await context.request.post('/api/backend/auth/register', {
    headers: { Origin: baseURL! },
    data: {
      email: `kanban-${crypto.randomUUID()}@example.test`,
      password: 'Tasks-password-2026',
      name: 'Kanban QA',
      organizationName: 'Kanban QA',
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto('/app/tasks');
  await page.getByText('Gerenciar quadros e colunas').click();
  await page.getByLabel('Nome do novo quadro').fill('Comercial');
  await page.getByRole('button', { name: 'Criar quadro', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Operação concluída.');
  await page
    .getByRole('combobox', { name: 'Quadro', exact: true })
    .selectOption({ label: 'Comercial' });
  await page.getByLabel('Nova tarefa', { exact: true }).fill('Contrato');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Tarefa criada.');
  const source = page.getByRole('article').filter({ hasText: 'Contrato' });
  const destination = page.getByRole('region', { name: 'Coluna Em andamento', exact: true });
  if (test.info().project.name === 'desktop') {
    await source.dragTo(destination);
  } else {
    await page.getByLabel('Status de Contrato').selectOption({ label: 'Em andamento' });
  }
  await expect(destination.getByRole('article')).toContainText('Contrato');
  await page.getByRole('button', { name: 'Detalhes de Contrato' }).click();
  await page
    .getByRole('textbox', { name: 'Descrição', exact: true })
    .fill('Documento para revisão');
  await page.getByLabel('Prioridade da tarefa').selectOption('urgent');
  await page
    .getByRole('combobox', { name: 'Responsável da tarefa', exact: true })
    .selectOption({ label: 'Kanban QA' });
  await page.getByLabel('Etiquetas separadas por vírgula').fill('cliente, revisão');
  await page.getByRole('button', { name: 'Salvar detalhes' }).click();
  await expect(page.getByRole('status')).toHaveText('Tarefa atualizada.');
  await page.getByLabel('Novo comentário').fill('Aguardando assinatura');
  await page.getByRole('button', { name: 'Comentar', exact: true }).click();
  await expect(page.getByText('Aguardando assinatura', { exact: true })).toBeVisible();
  await expect(page.getByText(/Tarefa movimentada/)).toBeVisible();
  await page.reload();
  await page
    .getByRole('combobox', { name: 'Quadro', exact: true })
    .selectOption({ label: 'Comercial' });
  await expect(destination.getByRole('article')).toContainText('Urgente');
  await expect(destination.getByRole('article')).toContainText('Kanban QA');
  await page.getByRole('button', { name: 'Detalhes de Contrato' }).click();
  await expect(page.getByRole('textbox', { name: 'Descrição', exact: true })).toHaveValue(
    'Documento para revisão',
  );
  await expect(page.getByText('Aguardando assinatura', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Arquivar tarefa' }).click();
  await expect(page.getByText('Nenhuma tarefa cadastrada')).toBeVisible();
  await page.getByLabel('Mostrar arquivadas').check();
  await page.getByRole('button', { name: 'Detalhes de Contrato' }).click();
  await page.getByRole('button', { name: 'Restaurar tarefa' }).click();
  await page.getByLabel('Mostrar arquivadas').uncheck();
  await expect(destination.getByRole('article')).toContainText('Contrato');
});

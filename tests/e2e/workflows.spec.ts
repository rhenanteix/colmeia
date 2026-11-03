import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
test('Visual workflow editor publishes and resumes a human approval without AI', async ({
  page,
  context,
  baseURL,
}) => {
  const signup = await context.request.post('/api/backend/auth/register', {
    headers: { Origin: baseURL! },
    data: {
      email: `workflow-${crypto.randomUUID()}@example.test`,
      password: 'Workflow-password-2026',
      name: 'Workflow QA',
      organizationName: 'Workflow QA',
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto('/app/workflows');
  await page.getByLabel('Nome do novo workflow').fill('Entrega visual');
  await page.getByRole('button', { name: 'Criar workflow', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Editor de Entrega visual' })).toBeVisible();
  await page.getByLabel('Título de task', { exact: true }).fill('Entrega via editor');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(page.getByRole('status')).toHaveText('Operação concluída.');
  await page.getByRole('button', { name: 'Validar e publicar' }).click();
  await expect(page.getByRole('button', { name: 'Ativar', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Ativar', exact: true }).click();
  await page.getByRole('button', { name: 'Executar manualmente' }).click();
  await expect(
    page.getByRole('heading', { name: 'Aguardando aprovação', exact: true }),
  ).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('link', { name: 'Abrir central de aprovações' }).click();
  await page.getByLabel('Justificativa para Autorizar entrega').fill('Entrega validada');
  await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
  await page.goto('/app/workflows');
  await page.getByRole('button', { name: /Entrega visual · v1/ }).click();
  await expect(page.getByRole('heading', { name: 'Concluída', exact: true })).toBeVisible({
    timeout: 10000,
  });
  await page.goto('/app/tasks');
  await expect(page.getByLabel('Status de Entrega via editor')).toHaveValue('done');
  await page.goto('/app/usage');
  await expect(
    page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'Execuções de workflows', exact: true }) }),
  ).toContainText('1');
  await expect(page.getByText('Concluídas: 1', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Ainda não há medições de IA. Nenhum token ou custo foi estimado.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quotas do plano free' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: `test-results/usage-${test.info().project.name}.png`,
    fullPage: true,
  });
});

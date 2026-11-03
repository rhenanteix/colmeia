import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
test('Approval center creates, decides and persists a task transition', async ({
  page,
  context,
  baseURL,
}) => {
  const signup = await context.request.post('/api/backend/auth/register', {
    headers: { Origin: baseURL! },
    data: {
      email: `approvals-${crypto.randomUUID()}@example.test`,
      password: 'Approvals-password-2026',
      name: 'Approval QA',
      organizationName: 'Approval QA',
    },
  });
  expect(signup.ok()).toBe(true);
  const task = await context.request.post('/api/backend/tasks', {
    headers: { Origin: baseURL! },
    data: { title: 'Liberar entrega' },
  });
  expect(task.ok()).toBe(true);
  await page.goto('/app/approvals');
  await page.getByText('Nova solicitação', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Solicitação', exact: true }).fill('Aprovar entrega');
  await page
    .getByRole('combobox', { name: 'Aprovador', exact: true })
    .selectOption({ label: 'Approval QA' });
  await page
    .getByLabel('Prazo para decisão')
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  await page
    .getByRole('combobox', { name: 'Tarefa associada' })
    .selectOption({ label: 'Liberar entrega' });
  await page.getByRole('combobox', { name: 'Ao aprovar, mover para' }).selectOption('done');
  await page.getByRole('button', { name: 'Solicitar aprovação' }).click();
  await expect(page.getByRole('heading', { name: 'Aprovar entrega' })).toBeVisible();
  await page.getByLabel('Justificativa para Aprovar entrega').fill('Entrega conferida');
  await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Aprovar entrega' })).not.toBeVisible();
  await page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('approved');
  await expect(page.getByText('Justificativa: Entrega conferida')).toBeVisible();
  await page.getByRole('button', { name: 'Histórico de Aprovar entrega' }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/app/tasks');
  await expect(page.getByLabel('Status de Liberar entrega')).toHaveValue('done');
});

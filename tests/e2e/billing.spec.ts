import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('Internal subscription upgrade, cancel, reactivate and persisted quotas', async ({
  page,
  context,
  baseURL,
}) => {
  const signup = await context.request.post('/api/backend/auth/register', {
    headers: { Origin: baseURL! },
    data: {
      email: `billing-${crypto.randomUUID()}@example.test`,
      password: 'Billing-password-2026',
      name: 'Billing QA',
      organizationName: 'Billing QA',
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto('/app/billing');
  await expect(page.getByText('Estado: Ativa', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Selecionar Equipe', exact: true }).click();
  await expect(page.getByText('Plano: Equipe', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quotas do plano team' })).toBeVisible();
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Cancelar assinatura', exact: true }).click();
  await expect(page.getByText('Estado: Cancelada', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quotas do plano free' })).toBeVisible();
  await page.getByRole('button', { name: 'Reativar assinatura', exact: true }).click();
  await page.reload();
  await expect(page.getByText('Estado: Ativa', { exact: true })).toBeVisible();
  await expect(page.getByText('Plano: Equipe', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

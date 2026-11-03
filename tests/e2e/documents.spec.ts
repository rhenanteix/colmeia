import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('Wiki attachment, binary download, safe rendering and version restore', async ({
  page,
  context,
  baseURL,
}) => {
  const signup = await context.request.post('/api/backend/auth/register', {
    headers: { Origin: baseURL! },
    data: {
      email: `docs-${crypto.randomUUID()}@example.test`,
      password: 'Documents-password-2026',
      name: 'Documents QA',
      organizationName: 'Documents QA',
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto('/app/documents');
  await page.getByLabel('Título da página').fill('Manual QA');
  await page
    .getByRole('textbox', { name: 'Conteúdo', exact: true })
    .fill('<script>window.wikiUnsafe=true</script> Texto inicial');
  await page.getByRole('button', { name: 'Criar página', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Manual QA · v1' })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Anexar à página Wiki' })
    .selectOption({ label: 'Manual QA' });
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 255, 0, 128, 7]);
  await page
    .getByLabel('Arquivo (até 10 MiB)')
    .setInputFiles({ name: 'anexo.png', mimeType: 'image/png', buffer: bytes });
  await page.getByRole('button', { name: 'Enviar arquivo' }).click();
  await expect(page.getByRole('status')).toHaveText('Arquivo enviado.');
  const link = page.getByRole('link', { name: 'anexo.png', exact: true }).first();
  const downloaded = await context.request.get((await link.getAttribute('href'))!);
  expect(downloaded.ok()).toBe(true);
  expect(await downloaded.body()).toEqual(bytes);
  expect(downloaded.headers()['content-disposition']).toContain('attachment');
  await page.getByRole('textbox', { name: 'Conteúdo', exact: true }).fill('Texto revisado');
  await page.getByRole('button', { name: 'Salvar página', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Manual QA · v2' })).toBeVisible();
  await page.getByText('Versão 1 · Manual QA', { exact: true }).click();
  await page.getByRole('button', { name: 'Restaurar versão 1' }).click();
  await expect(page.getByRole('button', { name: 'Manual QA · v3' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Manual QA · v3' }).click();
  await expect(page.getByRole('textbox', { name: 'Conteúdo', exact: true })).toHaveValue(
    '<script>window.wikiUnsafe=true</script> Texto inicial',
  );
  expect(await page.evaluate(() => 'wikiUnsafe' in window)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

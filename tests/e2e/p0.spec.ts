import AxeBuilder from '@axe-core/playwright';
import { readdir, readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
test('signup, cookie session, real dashboard, builder persistence and logout', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const email = `browser-${crypto.randomUUID()}@example.test`;
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/cadastro');
  await page.getByLabel('Seu nome').fill('QA Browser');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Senha (12+ caracteres)').fill('Browser-password-2026');
  await page.getByLabel('Confirme sua senha').fill('Browser-password-2026');
  await page.getByLabel('Nome da empresa').fill('Colmeia E2E');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/onboarding/);
  const cookie = (await context.cookies()).find((c) => c.name === 'colmeia_session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  expect(await page.evaluate(() => sessionStorage.getItem('colmeia_token'))).toBeNull();
  await page.goto('/app');
  await expect(page.getByText('Sua primeira especialista começa aqui')).toBeVisible();
  await expect(page.locator('.dashboard')).toHaveCSS('opacity', '1');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: `test-results/dashboard-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Buscar página/ }).click();
  await page.getByRole('combobox', { name: 'Buscar página' }).fill('Equipe');
  await page.getByRole('option', { name: 'Equipe' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.goto('/app/agents');
  await page.getByLabel('Nome do agente').fill('Minha especialista');
  await page.getByRole('button', { name: 'Criar agente', exact: true }).click();
  await page.getByRole('link', { name: /Minha especialista/ }).click();
  await expect(page.getByText('Revisão 0', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '2. Papel e personalidade' }).click();
  await page.getByLabel('Instruções de atuação').fill('Responda com clareza e ajude a equipe.');
  await expect(page.getByRole('status')).toHaveText('Rascunho salvo com segurança.');
  await page.reload();
  await page.getByRole('button', { name: '2. Papel e personalidade' }).click();
  await expect(page.getByLabel('Instruções de atuação')).toHaveValue(
    'Responda com clareza e ajude a equipe.',
  );
  await page.getByRole('button', { name: '3. Inteligência' }).click();
  await page.getByLabel('Identificador do modelo').fill('modelo-configuracao');
  await page.getByLabel('Limite de tokens por resposta').fill('4096');
  await page.getByRole('button', { name: '5. Ferramentas' }).click();
  await page
    .getByRole('switch', { name: 'Exigir aprovação humana antes de operações externas' })
    .uncheck();
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Rascunho salvo com segurança.');
  await page.reload();
  await page.getByRole('button', { name: '2. Papel e personalidade' }).click();
  await expect(page.getByLabel('Instruções de atuação')).toHaveValue(
    'Responda com clareza e ajude a equipe.',
  );
  await page.getByRole('button', { name: '3. Inteligência' }).click();
  await expect(page.getByLabel('Limite de tokens por resposta')).toHaveValue('4096');
  await page.getByRole('button', { name: '5. Ferramentas' }).click();
  await expect(
    page.getByRole('switch', { name: 'Exigir aprovação humana antes de operações externas' }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: '6. Revisão' }).click();
  await page.getByRole('button', { name: 'Salvar e criar versão' }).click();
  await expect(page.getByText('Versão 1', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: `test-results/builder-${test.info().project.name}.png`,
    fullPage: true,
  });
  const originalOrg = await page.getByLabel('Organização ativa').inputValue();
  await page.goto('/app/settings');
  await page.getByLabel('Nome', { exact: true }).fill('Segundo workspace');
  await page.getByLabel('Endereço do workspace').fill(`e2e-${crypto.randomUUID()}`);
  await page.getByRole('button', { name: 'Criar outra organização com estes dados' }).click();
  await expect(page.getByRole('status')).toContainText('Organização criada');
  await page.getByLabel('Organização ativa').selectOption({ label: 'Segundo workspace' });
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('Sua primeira especialista começa aqui')).toBeVisible();
  await page.getByLabel('Organização ativa').selectOption(originalOrg);
  await expect(page.getByRole('heading', { name: 'Minha especialista' })).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto('/recuperar');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByRole('status')).toContainText('Se a conta existir');
  const directory = process.env.MAIL_DEV_DIRECTORY!;
  const mails = await Promise.all(
    (await readdir(directory)).map(
      async (file) =>
        JSON.parse(await readFile(`${directory}/${file}`, 'utf8')) as { to: string; text: string },
    ),
  );
  const mail = mails.find((m) => m.to === email)!;
  expect(mail).toBeTruthy();
  await page.goto(mail.text);
  await page.getByLabel('Nova senha', { exact: true }).fill('Changed-password-2026');
  await page.getByLabel('Confirme a nova senha').fill('Changed-password-2026');
  await page.getByRole('button', { name: 'Alterar senha' }).click();
  await expect(page.getByRole('status')).toContainText('Senha alterada');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('Changed-password-2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(errors).toEqual([]);
});
test('BFF rejects cross-origin writes', async ({ request }) => {
  const response = await request.post('/api/backend/auth/login', {
    headers: { Origin: 'https://attacker.example' },
    data: { email: 'x@example.test', password: 'no' },
  });
  expect(response.status()).toBe(403);
});

test('credentials never fall back to query strings when JavaScript is unavailable', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/login`);
    await page.getByLabel('Email', { exact: true }).fill('no-js@example.test');
    await page.getByLabel('Senha', { exact: true }).fill('No-js-password-2026');
    const submission = page.waitForRequest(
      (request) => request.isNavigationRequest() && request.url().includes('/login'),
    );
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    const request = await submission;
    expect(request.method()).toBe('POST');
    expect(new URL(request.url()).search).toBe('');
  } finally {
    await context.close();
  }
});

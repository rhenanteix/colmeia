import { test, expect, type BrowserContext } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';

test('Teams persists human messages, threads and private mentions across two browsers', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const suffix = crypto.randomUUID();
  const origin = baseURL!;
  async function post(ctx: BrowserContext, path: string, data: unknown) {
    const response = await ctx.request.post(`${origin}/api/backend${path}`, {
      headers: { Origin: origin },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  }
  const alice = await post(context, '/auth/register', {
    email: `alice-browser-${suffix}@example.test`,
    password: 'Teams-password-2026',
    name: 'Alice QA',
    organizationName: 'Teams QA',
  });
  const bobContext = await browser.newContext({ baseURL: origin });
  try {
    const bobEmail = `bob-browser-${suffix}@example.test`;
    const bob = await post(bobContext, '/auth/register', {
      email: bobEmail,
      password: 'Teams-password-2026',
      name: 'Bob QA',
      organizationName: 'Bob QA',
    });
    await post(context, '/team/invitations', { email: bobEmail, role: 'MEMBER' });
    const directory = process.env.MAIL_DEV_DIRECTORY!;
    const mails = await Promise.all(
      (await readdir(directory)).map(async (file) =>
        JSON.parse(await readFile(`${directory}/${file}`, 'utf8')),
      ),
    );
    const mail = mails.find((item) => item.to === bobEmail);
    await post(bobContext, '/team/invitations/accept', {
      token: new URL(mail.text).searchParams.get('token'),
    });
    await post(bobContext, '/auth/switch', { organizationId: alice.organization.id });
    await page.goto('/app/channels');
    await page.getByLabel('Nome do canal').fill('Equipe QA');
    await page.getByRole('button', { name: '+', exact: true }).click();
    await page.getByLabel('Mensagem', { exact: true }).fill('Mensagem humana persistida');
    await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await expect(page.locator('.hive-message')).toContainText('Mensagem humana persistida');
    await page.getByRole('button', { name: 'Responder em thread' }).click();
    await page.getByLabel('Mensagem', { exact: true }).fill('Resposta na thread');
    await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await expect(page.locator('.hive-message').last()).toContainText(
      '↳ Resposta: Mensagem humana persistida',
    );
    await page.reload();
    await expect(page.locator('.hive-message')).toHaveCount(2);
    await page.getByLabel('Mensagem direta', { exact: true }).selectOption(bob.user.id);
    await page.getByRole('button', { name: 'Abrir DM' }).click();
    await expect(page.locator('.hive-room-head')).toContainText('DM · Bob QA');
    const bobPage = await bobContext.newPage();
    await bobPage.goto('/app/channels');
    await bobPage.getByRole('button', { name: /DM · Alice QA/ }).click();
    await expect(bobPage.locator('.bee-live')).toContainText('Eventos ao vivo');
    await page.getByLabel('Mencionar membros').selectOption([bob.user.id]);
    await page.getByLabel('Mensagem', { exact: true }).fill('Olá Bob, mensagem privada');
    await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await expect(bobPage.locator('.hive-message')).toContainText('Olá Bob, mensagem privada');
    await expect(bobPage.getByLabel('Notificações, 1 não lidas')).toBeVisible();
    await bobPage.getByLabel('Notificações, 1 não lidas').click();
    await expect(bobPage.locator('.notification-panel')).toContainText('Você foi mencionado');
    await bobPage.getByRole('button', { name: 'Marcar como lida' }).click();
    await expect(bobPage.getByLabel('Notificações, 0 não lidas')).toBeVisible();
    await page.screenshot({
      path: `test-results/teams-${test.info().project.name}.png`,
      fullPage: true,
    });
  } finally {
    await bobContext.close();
  }
});

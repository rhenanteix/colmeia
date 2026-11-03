import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
test.skip(!process.env.RUNTIME_E2E, 'Requires explicit local provider fixture runner');
test('publish, streamed chat, reload persisted messages, rename and archive', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/cadastro');
  await page.getByLabel('Seu nome').fill('Chat QA');
  await page.getByLabel('Email', { exact: true }).fill(`chat-${crypto.randomUUID()}@example.test`);
  await page.getByLabel('Senha (12+ caracteres)').fill('Browser-password-2026');
  await page.getByLabel('Confirme sua senha').fill('Browser-password-2026');
  await page.getByLabel('Nome da empresa').fill('Chat QA');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/onboarding/, { timeout: 15000 });
  await page.goto('/app/agents');
  await page.getByLabel('Nome do agente').fill('Abelha Atendimento QA');
  await page.getByRole('button', { name: 'Criar agente', exact: true }).click();
  await page.getByRole('link', { name: /Abelha Atendimento QA/ }).click();
  await page.getByRole('button', { name: '2. Papel e personalidade' }).click();
  await page.getByLabel('Instruções de atuação').fill('Ajude os clientes com clareza e educação.');
  await expect(page.getByRole('status')).toContainText('Rascunho salvo', { timeout: 10000 });
  await page.getByRole('button', { name: '3. Inteligência' }).click();
  await page.getByLabel('Identificador do modelo').fill('fixture-success');
  await page.getByRole('button', { name: '6. Revisão' }).click();
  await page.getByRole('button', { name: 'Salvar e criar versão' }).click();
  await page.getByText('Versão 1', { exact: true }).click();
  await page.getByRole('button', { name: 'Publicar versão 1' }).click();
  await expect(page.getByRole('status')).toHaveText('Versão 1 publicada.');
  await page.goto('/app/conversations');
  await page
    .getByRole('combobox', { name: 'Abelhinha', exact: true })
    .selectOption({ label: 'Abelha Atendimento QA' });
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  await page.getByLabel('Mensagem', { exact: true }).fill('Olá, preciso de ajuda');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.locator('.chat-message.assistant')).toContainText(
    'Resposta do provedor de teste.',
  );
  await page.reload();
  await page.getByRole('button', { name: /Olá, preciso de ajuda/ }).click();
  await expect(page.locator('.chat-message.assistant')).toContainText(
    'Resposta do provedor de teste.',
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `artifacts/verification/chat-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel('Nome da conversa').fill('Meu atendimento');
  await page.getByRole('button', { name: 'Renomear', exact: true }).click();
  await expect(page.getByRole('button', { name: /Meu atendimento/ })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Uma boa conversa começa aqui' })).toBeVisible();
  await page.goto('/app/executions');
  await expect(page.getByText(/COMPLETED/)).toBeVisible();
});

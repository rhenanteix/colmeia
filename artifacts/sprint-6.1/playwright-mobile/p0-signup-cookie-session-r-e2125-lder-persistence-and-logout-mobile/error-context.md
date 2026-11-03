# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p0.spec.ts >> signup, cookie session, real dashboard, builder persistence and logout
- Location: tests/e2e/p0.spec.ts:4:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '2. Papel e personalidade' })
    - locator resolved to <button data-slot="button" data-size="default" data-variant="secondary" class="inline-flex shrink-0 items-center gap-2 rounded-md text-sm font-medium transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 bg-secondary tex…>…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
      - waiting 100ms
    - waiting for element to be visible, enabled and stable
    - element is not stable
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed

```

# Page snapshot

```yaml
- generic [active] [ref=f6e1]:
  - generic [ref=f6e2]:
    - link "Pular para o conteúdo" [ref=f6e3] [cursor=pointer]:
      - /url: "#workspace-content"
    - complementary [ref=f6e4]:
      - link "colmeia.ia" [ref=f6e5] [cursor=pointer]:
        - /url: /app
      - generic [ref=f6e7]:
        - generic [ref=f6e8]: Organização ativa
        - combobox "Organização ativa" [ref=f6e9]:
          - option "Colmeia E2E" [selected]
        - button "Sair" [ref=f6e10] [cursor=pointer]
      - button "Navegação" [ref=f6e11] [cursor=pointer]
    - main [ref=f6e13]:
      - generic [ref=f6e14]:
        - navigation "Caminho da página" [ref=f6e15]:
          - link "Colmeia" [ref=f6e16] [cursor=pointer]:
            - /url: /app
          - text: /
          - link "Minhas abelhinhas" [ref=f6e17] [cursor=pointer]:
            - /url: /app/agents
          - text: / Configurar agente
        - button "Buscar página ⌘K" [ref=f6e18] [cursor=pointer]:
          - text: Buscar página
          - generic [ref=f6e19]: ⌘K
        - generic [ref=f6e20]:
          - heading "Para onde vamos?" [level=2] [ref=f6e21]
          - paragraph [ref=f6e22]: Busque uma página da sua colmeia.
        - generic [ref=f6e23]:
          - group [ref=f6e24]:
            - generic "Notificações, 0 não lidas" [ref=f6e25] [cursor=pointer]
          - link "Configurações de QA Browser" [ref=f6e29] [cursor=pointer]:
            - /url: /app/settings
            - text: QA
      - generic [ref=f6e30]:
        - generic [ref=f6e31]:
          - generic [ref=f6e32]:
            - text: AGENT BUILDER
            - heading "Minha especialista" [level=1] [ref=f6e33]
          - generic [ref=f6e34]: Rascunho
        - generic [ref=f6e35]:
          - navigation "Etapas de configuração" [ref=f6e36]:
            - button "1. Identidade" [ref=f6e37] [cursor=pointer]
            - button "2. Papel e personalidade" [ref=f6e38] [cursor=pointer]
            - button "3. Inteligência" [ref=f6e39] [cursor=pointer]
            - button "4. Conhecimento" [ref=f6e40] [cursor=pointer]
            - button "5. Ferramentas" [ref=f6e41] [cursor=pointer]
            - button "6. Revisão" [ref=f6e42] [cursor=pointer]
          - generic [ref=f6e43]:
            - heading "Identidade" [level=2] [ref=f6e44]
            - group [ref=f6e45]:
              - generic [ref=f6e46]:
                - text: Nome da abelhinha
                - textbox "Nome da abelhinha" [ref=f6e47]: Minha especialista
              - generic [ref=f6e48]:
                - text: Descrição
                - textbox "Descrição" [ref=f6e49]
              - paragraph [ref=f6e50]: Escolha a identidade visual da sua especialista.
              - generic [ref=f6e51]:
                - button "Rainha" [ref=f6e52] [cursor=pointer]
                - button "Atendimento" [pressed] [ref=f6e54] [cursor=pointer]
                - button "Exploradora" [ref=f6e56] [cursor=pointer]
                - button "Financeiro" [ref=f6e58] [cursor=pointer]
                - button "Operações" [ref=f6e60] [cursor=pointer]
                - button "RH" [ref=f6e62] [cursor=pointer]
                - button "Segurança" [ref=f6e64] [cursor=pointer]
                - button "Vendas" [ref=f6e66] [cursor=pointer]
              - generic [ref=f6e68]:
                - text: Especialidade e objetivo
                - textbox "Especialidade e objetivo" [ref=f6e69]
            - generic [ref=f6e70]:
              - button "Voltar" [disabled] [ref=f6e71]
              - button "Salvar rascunho" [ref=f6e72] [cursor=pointer]
              - button "Continuar" [ref=f6e73] [cursor=pointer]
          - complementary [ref=f6e74]:
            - img "Prévia da abelhinha" [ref=f6e75]
            - heading "Minha especialista" [level=2] [ref=f6e76]
            - paragraph [ref=f6e77]: Sua próxima especialista
            - generic [ref=f6e78]: Revisão 2
            - heading "Histórico" [level=3] [ref=f6e79]
            - paragraph [ref=f6e80]: Nenhuma versão criada.
  - region "Notifications alt+T"
  - alert [ref=f6e81]
```

# Test source

```ts
  1   | import AxeBuilder from '@axe-core/playwright';
  2   | import { readdir, readFile } from 'node:fs/promises';
  3   | import { test, expect } from '@playwright/test';
  4   | test('signup, cookie session, real dashboard, builder persistence and logout', async ({
  5   |   page,
  6   |   context,
  7   | }) => {
  8   |   const errors: string[] = [];
  9   |   const email = `browser-${crypto.randomUUID()}@example.test`;
  10  |   page.on('console', (message) => {
  11  |     if (message.type() === 'error') errors.push(message.text());
  12  |   });
  13  |   page.on('pageerror', (e) => errors.push(e.message));
  14  |   await page.goto('/cadastro');
  15  |   await page.getByLabel('Seu nome').fill('QA Browser');
  16  |   await page.getByLabel('Email', { exact: true }).fill(email);
  17  |   await page.getByLabel('Senha (12+ caracteres)').fill('Browser-password-2026');
  18  |   await page.getByLabel('Confirme sua senha').fill('Browser-password-2026');
  19  |   await page.getByLabel('Nome da empresa').fill('Colmeia E2E');
  20  |   await page.getByRole('button', { name: 'Criar conta' }).click();
  21  |   await expect(page).toHaveURL(/onboarding/);
  22  |   const cookie = (await context.cookies()).find((c) => c.name === 'colmeia_session');
  23  |   expect(cookie?.httpOnly).toBe(true);
  24  |   expect(cookie?.sameSite).toBe('Lax');
  25  |   expect(await page.evaluate(() => sessionStorage.getItem('colmeia_token'))).toBeNull();
  26  |   await page.goto('/app');
  27  |   await expect(page.getByText('Sua primeira especialista começa aqui')).toBeVisible();
  28  |   await expect(page.locator('.dashboard')).toHaveCSS('opacity', '1');
  29  |   expect(
  30  |     (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
  31  |       .violations,
  32  |   ).toEqual([]);
  33  |   await page.screenshot({
  34  |     path: `test-results/dashboard-${test.info().project.name}.png`,
  35  |     fullPage: true,
  36  |   });
  37  |   await page.getByRole('button', { name: /Buscar página/ }).click();
  38  |   await page.getByRole('combobox', { name: 'Buscar página' }).fill('Equipe');
  39  |   await page.getByRole('option', { name: 'Equipe' }).click();
  40  |   await expect(page.getByRole('table')).toBeVisible();
  41  |   await page.goto('/app/agents');
  42  |   await page.getByLabel('Nome do agente').fill('Minha especialista');
  43  |   await page.getByRole('button', { name: 'Criar agente', exact: true }).click();
  44  |   await page.getByRole('link', { name: /Minha especialista/ }).click();
  45  |   await expect(page.getByText('Revisão 0', { exact: true })).toBeVisible();
  46  |   await page.getByRole('button', { name: '2. Papel e personalidade' }).click();
  47  |   await page.getByLabel('Instruções de atuação').fill('Responda com clareza e ajude a equipe.');
  48  |   await expect(page.getByRole('status')).toHaveText('Rascunho salvo com segurança.');
  49  |   await page.reload();
  50  |   await page.getByRole('button', { name: '2. Papel e personalidade' }).click();
  51  |   await expect(page.getByLabel('Instruções de atuação')).toHaveValue(
  52  |     'Responda com clareza e ajude a equipe.',
  53  |   );
  54  |   await page.getByRole('button', { name: '3. Inteligência' }).click();
  55  |   await page.getByLabel('Identificador do modelo').fill('modelo-configuracao');
  56  |   await page.getByLabel('Limite de tokens por resposta').fill('4096');
  57  |   await page.getByRole('button', { name: '5. Ferramentas' }).click();
  58  |   await page
  59  |     .getByRole('switch', { name: 'Exigir aprovação humana antes de operações externas' })
  60  |     .uncheck();
  61  |   await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  62  |   await expect(page.getByRole('status')).toHaveText('Rascunho salvo com segurança.');
  63  |   await page.reload();
> 64  |   await page.getByRole('button', { name: '2. Papel e personalidade' }).click();
      |                                                                        ^ Error: locator.click: Test timeout of 30000ms exceeded.
  65  |   await expect(page.getByLabel('Instruções de atuação')).toHaveValue(
  66  |     'Responda com clareza e ajude a equipe.',
  67  |   );
  68  |   await page.getByRole('button', { name: '3. Inteligência' }).click();
  69  |   await expect(page.getByLabel('Limite de tokens por resposta')).toHaveValue('4096');
  70  |   await page.getByRole('button', { name: '5. Ferramentas' }).click();
  71  |   await expect(
  72  |     page.getByRole('switch', { name: 'Exigir aprovação humana antes de operações externas' }),
  73  |   ).not.toBeChecked();
  74  |   await page.getByRole('button', { name: '6. Revisão' }).click();
  75  |   await page.getByRole('button', { name: 'Salvar e criar versão' }).click();
  76  |   await expect(page.getByText('Versão 1', { exact: true })).toBeVisible();
  77  |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
  78  |     true,
  79  |   );
  80  |   expect(
  81  |     (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
  82  |       .violations,
  83  |   ).toEqual([]);
  84  |   await page.screenshot({
  85  |     path: `test-results/builder-${test.info().project.name}.png`,
  86  |     fullPage: true,
  87  |   });
  88  |   const originalOrg = await page.getByLabel('Organização ativa').inputValue();
  89  |   await page.goto('/app/settings');
  90  |   await page.getByLabel('Nome', { exact: true }).fill('Segundo workspace');
  91  |   await page.getByLabel('Endereço do workspace').fill(`e2e-${crypto.randomUUID()}`);
  92  |   await page.getByRole('button', { name: 'Criar outra organização com estes dados' }).click();
  93  |   await expect(page.getByRole('status')).toContainText('Organização criada');
  94  |   await page.getByLabel('Organização ativa').selectOption({ label: 'Segundo workspace' });
  95  |   await expect(page).toHaveURL(/\/app$/);
  96  |   await expect(page.getByText('Sua primeira especialista começa aqui')).toBeVisible();
  97  |   await page.getByLabel('Organização ativa').selectOption(originalOrg);
  98  |   await expect(page.getByRole('heading', { name: 'Minha especialista' })).toBeVisible();
  99  |   await page.getByRole('button', { name: 'Sair', exact: true }).click();
  100 |   await expect(page).toHaveURL(/login/);
  101 |   await page.goto('/recuperar');
  102 |   await page.getByLabel('Email', { exact: true }).fill(email);
  103 |   await page.getByRole('button', { name: 'Enviar link' }).click();
  104 |   await expect(page.getByRole('status')).toContainText('Se a conta existir');
  105 |   const directory = process.env.MAIL_DEV_DIRECTORY!;
  106 |   const mails = await Promise.all(
  107 |     (await readdir(directory)).map(
  108 |       async (file) =>
  109 |         JSON.parse(await readFile(`${directory}/${file}`, 'utf8')) as { to: string; text: string },
  110 |     ),
  111 |   );
  112 |   const mail = mails.find((m) => m.to === email)!;
  113 |   expect(mail).toBeTruthy();
  114 |   await page.goto(mail.text);
  115 |   await page.getByLabel('Nova senha', { exact: true }).fill('Changed-password-2026');
  116 |   await page.getByLabel('Confirme a nova senha').fill('Changed-password-2026');
  117 |   await page.getByRole('button', { name: 'Alterar senha' }).click();
  118 |   await expect(page.getByRole('status')).toContainText('Senha alterada');
  119 |   await page.goto('/login');
  120 |   await page.getByLabel('Email', { exact: true }).fill(email);
  121 |   await page.getByLabel('Senha', { exact: true }).fill('Changed-password-2026');
  122 |   await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  123 |   await expect(page).toHaveURL(/\/app$/);
  124 |   expect(errors).toEqual([]);
  125 | });
  126 | test('BFF rejects cross-origin writes', async ({ request }) => {
  127 |   const response = await request.post('/api/backend/auth/login', {
  128 |     headers: { Origin: 'https://attacker.example' },
  129 |     data: { email: 'x@example.test', password: 'no' },
  130 |   });
  131 |   expect(response.status()).toBe(403);
  132 | });
  133 | 
  134 | test('credentials never fall back to query strings when JavaScript is unavailable', async ({
  135 |   browser,
  136 |   baseURL,
  137 | }) => {
  138 |   const context = await browser.newContext({ javaScriptEnabled: false });
  139 |   try {
  140 |     const page = await context.newPage();
  141 |     await page.goto(`${baseURL}/login`);
  142 |     await page.getByLabel('Email', { exact: true }).fill('no-js@example.test');
  143 |     await page.getByLabel('Senha', { exact: true }).fill('No-js-password-2026');
  144 |     const submission = page.waitForRequest(
  145 |       (request) => request.isNavigationRequest() && request.url().includes('/login'),
  146 |     );
  147 |     await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  148 |     const request = await submission;
  149 |     expect(request.method()).toBe('POST');
  150 |     expect(new URL(request.url()).search).toBe('');
  151 |   } finally {
  152 |     await context.close();
  153 |   }
  154 | });
  155 | 
```
// Explicit test double for protocol/failure tests. Never imported by production code.
import { createServer } from 'node:http';
export async function startProviderFixture() {
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || '{}');
    if (body.model === 'fixture-error') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: { message: 'Test credential failure', type: 'authentication_error' },
        }),
      );
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const tokens =
      body.model === 'fixture-slow'
        ? Array(100).fill('parcial ')
        : ['Resposta ', 'do provedor ', 'de teste.'];
    let i = 0;
    const timer = setInterval(() => {
      if (i < tokens.length)
        res.write(
          `data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta: { content: tokens[i++] }, finish_reason: null }] })}\n\n`,
        );
      else {
        clearInterval(timer);
        res.write(
          `data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } })}\n\ndata: [DONE]\n\n`,
        );
        res.end();
      }
    }, 100);
    res.on('close', () => clearInterval(timer));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/v1`,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}

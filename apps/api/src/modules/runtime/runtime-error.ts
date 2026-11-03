const messages = {
  quota:
    'O provedor está sem saldo ou quota disponível. Solicite a regularização ao administrador.',
  rate: 'O provedor limitou temporariamente as requisições. Aguarde e tente novamente.',
  auth: 'A credencial do provedor foi rejeitada. Solicite a revisão ao administrador.',
  tool: 'A ferramenta não conseguiu concluir a operação.',
  provider: 'Falha no provedor. Verifique a configuração e tente novamente.',
} as const;
export class RuntimeFailure extends Error {
  constructor(readonly code: keyof typeof messages) {
    super(messages[code]);
  }
}
function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
export function providerFailure(value: unknown): RuntimeFailure {
  const error = object(value);
  const data = object(object(error.data).error);
  let raw = {} as Record<string, unknown>;
  if (typeof error.responseBody === 'string') {
    try {
      raw = object(object(JSON.parse(error.responseBody)).error);
    } catch {}
  }
  if (
    [data.code, data.type, raw.code, raw.type].some(
      (c) => c === 'insufficient_quota' || c === 'credit_balance_exhausted',
    )
  )
    return new RuntimeFailure('quota');
  if (error.statusCode === 429) return new RuntimeFailure('rate');
  if (error.statusCode === 401 || error.statusCode === 403) return new RuntimeFailure('auth');
  return new RuntimeFailure('provider');
}

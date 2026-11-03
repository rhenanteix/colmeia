export const API = '/api/backend';
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}
export type ApiOptions = {
  token?: string;
  body?: unknown;
  signal?: AbortSignal;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
};
export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(API + path, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
    signal: options.signal,
  });
  if (!response.ok) {
    const text = (await response.text()).slice(0, 2000);
    let detail = 'Não foi possível concluir a operação. Tente novamente.';
    try {
      const body = JSON.parse(text) as { message?: string | string[] };
      if (body.message)
        detail = Array.isArray(body.message) ? body.message.join('. ') : body.message;
    } catch {
      /* Do not expose proxy HTML or internal server responses. */
    }
    if (response.status === 401) detail = 'Sua sessão expirou. Entre novamente.';
    if (response.status === 403) detail = 'Seu papel não permite esta operação.';
    throw new ApiError(response.status, path, detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const getJson = <T>(path: string, token: string) => apiRequest<T>(path, { token });
export const postJson = <T>(path: string, token: string, body: unknown) =>
  apiRequest<T>(path, { token, method: 'POST', body });

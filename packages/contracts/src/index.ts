export type ApiError = { code: string; message: string; requestId?: string };
export type TenantContext = { organizationId: string; subject: string; permissions: string[] };

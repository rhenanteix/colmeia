/** Integration intentionally unavailable until a pinned OpenClaw version and its API contract are validated. */
export class OpenClawNotConfiguredError extends Error {
  constructor() {
    super('OpenClaw integration is not configured or validated');
    this.name = 'OpenClawNotConfiguredError';
  }
}
export function assertOpenClawConfigured(image: string | undefined, url: string | undefined): void {
  if (!image || !url) throw new OpenClawNotConfiguredError();
}

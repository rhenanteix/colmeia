# Colmeia — Architecture v0.7

## Scope and honest status
This is an incremental architecture refactor, **not a completed production SaaS**. Existing business logic is preserved. Backend feature modules are separated at the Nest DI layer; large legacy implementation files (`identity.ts`, `resources.ts`, `product.ts`, `bee-collaboration.ts`) still need extraction into controllers, application services, domain and persistence repositories. Frontend feature folders and a typed HTTP boundary are in place; most pages still need extraction into features.

## Backend (NestJS / Node 22)
- Modular monolith, independently extractable bounded contexts: identity, agents, collaboration, billing, onboarding, workspace, bee-teams.
- Platform infrastructure: global Prisma lifecycle module, security module, strict DTO validation, JWT membership verification and tenant-scoped queries.
- REST `/api/v1`, OpenAPI `/api/docs`, liveness `/api/v1/health`, readiness `/api/v1/health/ready`.
- Future clean architecture inside each feature: `domain/` (entities, rules), `application/` (commands, queries, ports), `infrastructure/` (Prisma/queue/adapters), `presentation/` (controllers/DTOs). Avoid premature microservices.
- Durable execution: PostgreSQL outbox -> BullMQ worker -> OpenClaw adapter -> persisted execution events -> SSE/websocket. Current event processor is NOT durable and OpenClaw is NOT integrated.
- Tenant security: derive organization from verified JWT membership; never trust tenant IDs from request bodies. Database-level RLS and compound tenant foreign keys still required.

## Frontend (React 19 / Next.js 15 App Router)
- Route ownership: `app/` for routes/layouts; `features/` for bounded-context UI and hooks; `lib/` for cross-feature transport; `public/bees/` for original eight mascots.
- Typed `apiRequest` with abort signal, explicit auth header and structured API errors.
- Target: Server Components for read-only content, Client Components only for interactions, server-side session management with HttpOnly cookies, React Query for dynamic cache, Zod for form schemas, optimistic updates for Teams, accessibility/reduced-motion animation states.
- **Current limitation**: authentication is stored in sessionStorage and much of the UI uses client-side fetch; this needs a BFF/session migration before production.

## Environments and quality gates
- Local: Node >=22, npm, Docker PostgreSQL/Redis, `.env` copied from `.env.example`.
- CI: `npm ci` (requires generated committed lockfile), Prisma generate, TS typecheck, build, tests. Add integration/E2E, DB migration checks and security scans.
- Secrets: never commit `.env`; use secret manager in production; rotate credentials.
- Operational: health checks, OpenTelemetry traces, metrics, structured logs with request/tenant correlation, Sentry-equivalent error tracking, SLOs and runbooks (future).

## Critical gaps
1. Install dependencies and commit `package-lock.json` (registry was unreachable in this environment).
2. Run Prisma migrations, typecheck and both builds; fix actual compiler issues.
3. Finish session cookies, CSRF strategy, token rotation, rate limiting and email delivery.
4. Isolate data at DB level, test cross-tenant and race conditions.
5. Implement durable outbox/queue/retry/dead-letter and real OpenClaw gateway.
6. Complete all frontend flows, realtime synchronization, automated browser tests.
7. Payments, invoices, audit retention, LGPD controls, backup/restore, deployment.

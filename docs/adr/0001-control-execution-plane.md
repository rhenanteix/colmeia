# ADR-0001: Separate control plane and execution plane

Status: Accepted for implementation; production validation pending.

The Colmeia control plane owns identities, tenants, policies, agent definitions, billing, usage and audit. The execution plane runs OpenClaw gateways isolated by organization. All runtime operations pass through an internal adapter and policy checks; browser clients never call runtime gateways directly. Avoid embedding OpenClaw internals in the core domain. Provisioning must be idempotent and recoverable. Local/hybrid runtimes are future adapters.

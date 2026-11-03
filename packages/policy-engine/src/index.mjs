/** Deny by default. This helper is NOT a substitute for DB-backed authorization. */
export function authorizeTenant({
  authenticatedTenantId,
  resourceTenantId,
  permissions = [],
  requiredPermission,
}) {
  if (typeof authenticatedTenantId !== 'string' || !authenticatedTenantId.trim())
    return { allowed: false, reason: 'missing_tenant' };
  if (authenticatedTenantId !== resourceTenantId)
    return { allowed: false, reason: 'tenant_mismatch' };
  if (!requiredPermission || !permissions.includes(requiredPermission))
    return { allowed: false, reason: 'missing_permission' };
  return { allowed: true, reason: 'authorized' };
}

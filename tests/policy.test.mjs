import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeTenant } from '../packages/policy-engine/src/index.mjs';

test('deny missing tenant', () =>
  assert.equal(
    authorizeTenant({
      authenticatedTenantId: '',
      resourceTenantId: 't1',
      permissions: ['agent:read'],
      requiredPermission: 'agent:read',
    }).allowed,
    false,
  ));
test('deny cross tenant', () =>
  assert.equal(
    authorizeTenant({
      authenticatedTenantId: 't1',
      resourceTenantId: 't2',
      permissions: ['agent:read'],
      requiredPermission: 'agent:read',
    }).allowed,
    false,
  ));
test('deny missing permission', () =>
  assert.equal(
    authorizeTenant({
      authenticatedTenantId: 't1',
      resourceTenantId: 't1',
      permissions: [],
      requiredPermission: 'agent:read',
    }).allowed,
    false,
  ));
test('allow exact tenant with permission', () =>
  assert.equal(
    authorizeTenant({
      authenticatedTenantId: 't1',
      resourceTenantId: 't1',
      permissions: ['agent:read'],
      requiredPermission: 'agent:read',
    }).allowed,
    true,
  ));

/**
 * Role-based access control (mock implementation).
 *
 * This is a *UI* authorisation layer only — it decides what to render and
 * which actions to enable. A real deployment must enforce the same matrix
 * server-side; nothing here is a security boundary, since any client can edit
 * its own LocalStorage.
 */

import type { Permission, Role } from '@/types';

/** Higher rank = more privilege. Used for "can this staff edit that staff" checks. */
export const ROLE_RANK: Record<Role, number> = {
  auditor: 1,
  teller: 2,
  manager: 3,
  admin: 4,
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  manager: 'Branch Manager',
  teller: 'Teller',
  auditor: 'Auditor',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full access to every module, including staff administration and system settings.',
  manager: 'Manages customers, accounts, transactions and requests; can view reports.',
  teller: 'Day-to-day counter operations — customers, deposits, withdrawals and transfers.',
  auditor: 'Read-only access across the platform for review and reporting.',
};

const ALL_READ: Permission[] = [
  'customer:read',
  'account:read',
  'transaction:read',
  'request:read',
  'staff:read',
  'report:read',
];

/** The authoritative role → permission matrix. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    ...ALL_READ,
    'customer:write',
    'customer:delete',
    'account:write',
    'account:delete',
    'transaction:write',
    'request:write',
    'staff:write',
    'staff:delete',
    'settings:write',
  ],
  manager: [
    ...ALL_READ,
    'customer:write',
    'customer:delete',
    'account:write',
    'transaction:write',
    'request:write',
    'settings:write',
  ],
  teller: [
    'customer:read',
    'customer:write',
    'account:read',
    'account:write',
    'transaction:read',
    'transaction:write',
    'request:read',
    'request:write',
    'settings:write',
  ],
  // Auditors get reads only — deliberately no `:write` of any kind.
  auditor: [...ALL_READ],
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: Role | undefined | null, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

export function canAll(role: Role | undefined | null, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

/**
 * Whether `actor` may modify a staff record held by `target`.
 * Staff can never edit someone at or above their own rank — this is what stops
 * a manager from demoting an admin.
 */
export function canManageStaffOfRole(actor: Role | null | undefined, target: Role): boolean {
  if (!actor || !can(actor, 'staff:write')) return false;
  return ROLE_RANK[actor] > ROLE_RANK[target];
}

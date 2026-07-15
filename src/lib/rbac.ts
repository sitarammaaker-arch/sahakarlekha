/**
 * RBAC model foundation (Sprint-1, story SL-05).
 *
 * This is the DATA MODEL + pure evaluator only — it does NOT (yet) gate any route,
 * UI or export. That wiring is SL-06 (Sprint 2). Shipping the model first, behind a
 * legacy-role shim, lets the rest of the transformation adopt `can()` without any
 * behaviour change this sprint.
 *
 * Source of truth: Blueprint 3.3 (RBAC / Access-Control Architecture), Table 2
 * (roles × permission categories). A permission is GRANTED to a role if the blueprint
 * marks it ✓ (full) or ◐ (scoped). Scope refinement (own-branch / with-approval /
 * dual-control) is a later story; at this layer a granted permission returns `true`.
 *
 * Pure module: no React, no I/O — unit-tested by scripts/test-rbac.mjs which mirrors
 * the (trivially small) evaluator, exactly as scripts/test-nav.mjs mirrors navVisibility.
 */

/** The 17 roles the platform models (Blueprint 3.3 §Table 1). */
export type Role =
  | 'superAdmin'
  | 'societyAdmin'
  | 'manager'
  | 'accountant'
  | 'cashier'
  | 'storeKeeper'
  | 'procurementOfficer'
  | 'salesOperator'
  | 'auditor'
  | 'internalAuditor'
  | 'boardMember'
  | 'chairman'
  | 'secretary'
  | 'employee'
  | 'dataEntry'
  | 'readOnly'
  | 'externalCA';

/** The 14 permission categories (Blueprint 3.3 §Table 2 columns). */
export type Permission =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'export'
  | 'print'
  | 'lockPeriod'
  | 'unlockPeriod'
  | 'closeFY'
  | 'userMgmt'
  | 'backup'
  | 'config'
  // ECR-06: audit objections/notes — the auditor family's SCOPED write. Distinct from `create`
  // (financial entry) so an auditor can file objections but can NOT create vouchers/sales.
  | 'auditNote';

export const ROLES: readonly Role[] = [
  'superAdmin', 'societyAdmin', 'manager', 'accountant', 'cashier', 'storeKeeper',
  'procurementOfficer', 'salesOperator', 'auditor', 'internalAuditor', 'boardMember',
  'chairman', 'secretary', 'employee', 'dataEntry', 'readOnly', 'externalCA',
] as const;

export const PERMISSIONS: readonly Permission[] = [
  'create', 'read', 'update', 'delete', 'approve', 'reject', 'export', 'print',
  'lockPeriod', 'unlockPeriod', 'closeFY', 'userMgmt', 'backup', 'config', 'auditNote',
] as const;

/**
 * Permission matrix — a role maps to the set of permissions it is GRANTED (✓ or ◐).
 * Transcribed verbatim from Blueprint 3.3 Table 2. Absent = ✗ (denied).
 */
export const PERMISSION_MATRIX: Record<Role, ReadonlySet<Permission>> = {
  // ✓C ✓R ◐U ◐D  Ex Pr           UM BK Cfg  (no Ap/Rj/Lk/Un/CFY — platform, not society finance)
  superAdmin:        new Set(['create', 'read', 'update', 'delete', 'export', 'print', 'userMgmt', 'backup', 'config']),
  societyAdmin:      new Set(['create', 'read', 'update', 'delete', 'approve', 'reject', 'export', 'print', 'lockPeriod', 'unlockPeriod', 'userMgmt', 'backup', 'config', 'auditNote']),
  manager:           new Set(['create', 'read', 'update', 'approve', 'reject', 'export', 'print', 'lockPeriod', 'config']),
  accountant:        new Set(['create', 'read', 'update', 'export', 'print', 'lockPeriod']),
  cashier:           new Set(['create', 'read', 'update', 'print']),
  storeKeeper:       new Set(['create', 'read', 'update', 'export', 'print']),
  procurementOfficer:new Set(['create', 'read', 'update', 'approve', 'export', 'print']),
  salesOperator:     new Set(['create', 'read', 'update', 'print']),
  auditor:           new Set(['read', 'export', 'print', 'auditNote']), // auditNote = file objections; NO financial create
  internalAuditor:   new Set(['read', 'export', 'print', 'auditNote']),
  boardMember:       new Set(['read', 'approve', 'reject', 'export', 'print']),
  chairman:          new Set(['read', 'approve', 'reject', 'export', 'print', 'lockPeriod', 'unlockPeriod', 'closeFY']),
  secretary:         new Set(['create', 'read', 'update', 'delete', 'approve', 'reject', 'export', 'print', 'lockPeriod', 'closeFY', 'userMgmt', 'config', 'auditNote']),
  employee:          new Set(['create', 'read', 'update', 'print']),
  dataEntry:         new Set(['create', 'read', 'update', 'print']),
  readOnly:          new Set(['read', 'print']),
  externalCA:        new Set(['read', 'export', 'print', 'auditNote']),
};

/**
 * Legacy shim — the app today ships four roles ('admin' | 'accountant' | 'viewer' | 'auditor').
 * Map each onto a new role so existing screens behave identically until SL-06 adopts `can()`.
 *   admin → societyAdmin (full society control)   viewer → readOnly
 *   accountant → accountant                        auditor → auditor (read-only)
 */
export type LegacyRole = 'admin' | 'accountant' | 'viewer' | 'auditor';

export const LEGACY_ROLE_MAP: Record<LegacyRole, Role> = {
  admin: 'societyAdmin',
  accountant: 'accountant',
  viewer: 'readOnly',
  auditor: 'auditor',
};

/** Resolve a legacy role string to a modelled Role (identity if already a new Role). */
export function mapLegacyRole(role: LegacyRole | Role): Role {
  return (LEGACY_ROLE_MAP as Record<string, Role>)[role] ?? (role as Role);
}

/**
 * THE permission check. Returns whether `role` is granted `permission`.
 * Accepts either a new Role or a legacy role string (auto-mapped) so callers can
 * migrate incrementally. Scope-aware refinement (branch/dual-control) is future work;
 * a granted permission returns true here.
 */
export function can(role: LegacyRole | Role, permission: Permission): boolean {
  const resolved = mapLegacyRole(role);
  return PERMISSION_MATRIX[resolved]?.has(permission) ?? false;
}

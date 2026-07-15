# ECR-06 — 17-Role Assignment Rollout Runbook

**Purpose.** The RBAC *model* ships 17 roles (Blueprint TASK3.3, `src/lib/rbac.ts`), but the app can
*assign* only the 4 legacy roles (`admin | accountant | viewer | auditor`). This runbook is everything
a fresh session needs to make all 17 assignable — safely, in order, without breaking a single live
user. Written 2026-07-15 after fact-checking every layer.

---

## 1. Where each layer stands today (verified)

| Layer | State |
|---|---|
| Permission model | ✅ DONE — `PERMISSION_MATRIX` 17×14 + `can()` (`src/lib/rbac.ts`), `mapLegacyRole` shim, 154 tests |
| Data-layer guards | ✅ DONE — `guardPermission` on voucher create/update/cancel/approve/reject + ~20 delete sites; SoD self-approval |
| Route scoping | ⚠️ LEGACY-ONLY — `moduleCatalog.requiredRoles` uses the 4 legacy names; a new role matches none → sees only un-gated modules (fail-closed but wrong: a cashier would lose receive/make-payment) |
| Assignment UI | ⚠️ LEGACY-ONLY — `UserRole` type (AuthContext) + UserManagement dropdown offer 4 roles |
| JWT claim | ✅ pass-through — `custom_access_token_hook` (mig 028/038) emits `society_users.role` raw; new role strings flow into `user_role` automatically |
| Server RLS | ⛔ **THE LOAD-BEARING RISK** — `jwt_can_write()` = `role is null OR role in ('admin','accountant')`; `jwt_can_delete()` = admin only (mig 029, used by 029–032 policies on branches/finance/core tables). A JWT carrying `'cashier'` is **not null and not in the list → every financial write REFUSED server-side**, regardless of what the client allows. |
| Export gating | ✅ `ROLE_RANK` in `export/registry.types.ts` (viewer/auditor 0, accountant 1, admin 2) — new roles are unranked → export denied (fail-closed; extend when needed) |
| Create-user RPC | ❓ verify — `app_add_society_user(p_role …)`: confirm it accepts arbitrary role strings (or has a whitelist to extend) before S3 |

**The ordering rule that follows:** SERVER FIRST. If the dropdown ships before the RLS helpers know
the new names, the first cashier created is a user who can log in and *nothing saves*.

---

## 2. Role → module access (transcribed from Blueprint TASK3.3 Table 1)

Module catalog domains (132 modules): `core(13) operations(9) reports(27) registers(19)
administration(11) consumer(12) dairy(7) housing(15) labour(13) marketing(6)`.

**Prime directive: the 4 legacy roles keep TODAY'S access byte-identical** (empty-diff proven by
test). The map below applies to the 13 NEW roles only. Domain-level grant, then explicit module-id
adds/removes; capability gating (`requiredCapabilities`) still applies on top.

| New role | Domains | Explicit adds / notes |
|---|---|---|
| superAdmin | (platform only) | NOT society-assignable — exclude from the dropdown; platform admin path already exists |
| manager | core, operations, reports, registers + all society-type domains | minus `administration` (Table 1: "No user/backup/config") |
| secretary | everything a societyAdmin sees | minus backup-center modules (BK = ◐); user-mgmt stays (UM ✓) |
| cashier | — | ids only: cashBook, bankBook, receivePayment, makePayment, vouchers (receipt/payment entry), dayBook, dashboard |
| storeKeeper | operations (inventory/godown ids), registers (stock registers) | Trading types only — capability gate already handles this |
| procurementOfficer | marketing (procurement ids), consumer (purchaseOrders, purchaseReturn) | + GRN/supplier pages; NO payment release (makePayment excluded) |
| salesOperator | consumer (retailCounter, salesReturn, priceLists, memberCredit) | + saleManagement, dashboard; no export (matrix has no Ex) |
| auditor (exists) | UNCHANGED (legacy) | — |
| internalAuditor | same as auditor | reports + registers + auditRegister/ledgerHygiene (read + objections) |
| externalCA | same as auditor | time-boxing is a FUTURE feature — note in UI copy, don't build now |
| boardMember | reports, dashboard | + voucherApproval (approve/reject per matrix) |
| chairman | reports, dashboard | + voucherApproval + (future) FY-close co-authorization |
| employee, dataEntry | dashboard only in S2 | Table 1 says "assigned module(s)" — real per-user module assignment is a separate feature; do NOT fake it with a broad grant |
| readOnly | UNCHANGED (= legacy viewer) | — |

Implementation shape: a `ROLE_MODULE_ACCESS: Partial<Record<Role, { domains?: Domain[]; add?: ModuleId[]; remove?: ModuleId[] }>>`
consulted by `isModuleVisible` ONLY when the user's role is not one of the 4 legacy names — legacy
paths untouched. Generate the concrete id lists FROM `moduleCatalog` in the same PR and lock them
with a `test-nav`-style suite (one assertion per new role: exact visible-module set).

---

## 3. Slice order (each its own PR; strictly in this order)

### S1 · Server RLS helpers learn the matrix (migration 045) — ✅ SHIPPED 2026-07-15
Migration `045_jwt_role_helpers_17roles.sql` (+`_down` restoring the 029 bodies verbatim), with the
derivation LOCKED by `scripts/test-jwt-role-helpers.mjs` (parses the SQL, compares to
`PERMISSION_MATRIX`; in CI):
- `jwt_can_write()` → null OR role in **(matrix roles with UPDATE or APPROVE, − superAdmin, + legacy)**:
  `admin, accountant, societyAdmin, manager, cashier, storeKeeper, procurementOfficer, salesOperator,
  secretary, employee, dataEntry, boardMember, chairman`.
  - **APPROVE counts as write** — approve/reject is an UPDATE on the vouchers row; excluding
    boardMember/chairman would server-refuse their approvals.
  - **auditor / internalAuditor / externalCA deliberately EXCLUDED** (fact-checked): their scoped
    CREATE targets audit tables, which are NOT under the 030/031 role-gated policies
    (030 = godowns/deposits/kachi-aarat/p7/recoverables/compliance; 031 = vouchers/members/accounts/
    sales/purchases/stock) — adding them would only widen their raw-API surface on financial tables.
- `jwt_can_delete()` → null OR role in `admin, societyAdmin, secretary`.
- Legacy names stay in the lists forever (existing users' claims carry them).
- **Deploy:** run 045 in the SQL Editor any time — pure superset, no new role exists yet, zero
  observable change; existing sessions unaffected.

### S2 · Client navigation map (pure client)
`ROLE_MODULE_ACCESS` + `isModuleVisible` extension per §2. Tests: (a) empty-diff for the 4 legacy
roles across all 11 type templates; (b) exact-set assertions per new role. No live behaviour changes
(no user holds a new role yet).

### S3 · Assignment surface
- `UserRole` type → the 17 names (minus superAdmin), Hindi labels in the UserManagement dropdown
  (RULE 7), grouped (प्रशासन / लेखा / संचालन / शासन / audit).
- Verify `app_add_society_user` accepts the new strings (extend its whitelist migration if it has one).
- Export `ROLE_RANK`: add sensible ranks for new roles (cashier/salesOperator/etc. → 0; manager → 1;
  secretary → 2) or leave unranked = export-denied (document the choice).

### S4 · Pilot (per R6 — rehearse small)
In a demo society: create ONE `cashier` → fresh login → sees exactly the §2 module set; posts a
receipt (works); tries a delete (blocked, Hindi toast); raw-API write to another table type per RLS
expectations. Then one `boardMember` → approval flow works, no entry forms. Soak days, then announce.

### Explicitly OUT of scope
Per-user module assignment (employee/dataEntry "assigned modules"), time-boxed auditor access,
approval amount-limits (financial authorization matrix), FY-close dual-control wiring — separate
features, do not smuggle them in.

### S5 · Residual hardcoded role-gate audit (2026-07-15)
Beyond the 7 canEdit pages (fixed PR #177), a sweep found more page-level `role === 'admin'` /
`hasPermission([...])` affordance gates. Split by whether the SERVER already permits the new role:

**Fixed (pure client, server already permits, new role reaches page via nav):**
- `Godowns.tsx` — `isAdmin` → `canEdit = can('update')` (+ delete on `can('delete')`). storeKeeper
  owns godown master (matrix inventory/godown) and `jwt_can_write()` (mig 045) already allows it.
- `BudgetModule.tsx` — `admin||accountant` → `can('update')`; opens budget editing to manager/
  secretary who reach Reports; budget writes aren't role-scoped at the RLS layer.

**Deliberately LEFT admin-only — need a coordinated `is_society_admin` change first (sensitive):**
`UserManagement.tsx` (secretary has matrix `userMgmt`) and `SocietySetup.tsx` (config) are gated
server-side by `is_society_admin()` which checks `role='admin'` (supabase-security.sql) and also
backs the `app_add_society_user` RPC + societies/society_settings/society_users RLS. Opening the UI
for secretary/societyAdmin WITHOUT first widening `is_society_admin` to those roles would just cause
server rejections. That's a tenant-admin-boundary change → its own careful slice (**S7**), not a client tweak.

**Correctly admin-only, leave as-is:** `Features.tsx` (feature flags/config), `MultiSocietyConsolidation.tsx`
(federation), `OpeningBalances.tsx` (books' starting point — sensitive), `ElectionModule.tsx` /
`FundRegister.tsx` (widening would change a LEGACY role's access, not just add new roles — needs a
product decision, not a mechanical fix).

### S6 · Audit-domain create carve-out — ✅ DONE (2026-07-15, PR #180)
The auditor family's matrix `create` was consumed only by `addVoucher`'s `guardPermission('create')`
(letting an auditor attempt a financial create — client-side; the server RLS mig 045 already blocked
the write), while `addAuditObjection` didn't gate on it at all. Fixed with a dedicated **`auditNote`**
permission (15th): granted to auditor/internalAuditor/externalCA + societyAdmin/secretary; plain
`create` removed from the auditor family. `addAuditObjection`/`updateAuditObjection` now gate on
`auditNote`; `addVoucher`'s `create` guard therefore correctly excludes auditors. Client now matches
the server. test:rbac +13.

### S7 · Tenant-admin-boundary (open) — secretary user-mgmt/config
Widen `is_society_admin()` (supabase-security.sql) to accept `societyAdmin`/`secretary`, then open
`UserManagement.tsx` / `SocietySetup.tsx` for them (see S5). Coordinated client+server+RLS change;
product + auth decision, not scheduled.

---

## 4. Rollback
- S1: `045_down` (restore 029 helper bodies).
- S2/S3: pure client — revert the PR.
- A mis-provisioned user: switch their role back in UserManagement (takes effect next token refresh).

## 5. Session pre-flight (for whoever implements this)
1. Read `src/lib/rbac.ts`, `src/lib/navigation/moduleCatalog.ts`, mig 029, TASK3.3 Table 1.
2. `npx tsc --noEmit -p tsconfig.app.json` must be 0 before and after every slice.
3. CLAUDE.md RULES 6/7/8 apply (FY-guard untouched, Hindi toasts, Edit-tool only).
4. Re-verify §1's fact table — especially whether anything already extended the helpers after 2026-07-15.

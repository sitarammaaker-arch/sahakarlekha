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

### S1 · Server RLS helpers learn the matrix (migration 045) — DO THIS FIRST
Extend the two helpers (idempotent `create or replace`, no policy changes needed — 029–032 policies
call the helpers):
- `jwt_can_write()` → null OR role in **(matrix roles holding create|update)**:
  `admin, accountant, societyAdmin, manager, cashier, storeKeeper, procurementOfficer, salesOperator,
  secretary, employee, dataEntry` (+ auditor/internalAuditor/externalCA hold scoped *create* only —
  include them; their write surface is bounded client-side to audit objections, and R-side SELECT
  policies still apply).
- `jwt_can_delete()` → null OR role in `admin, societyAdmin, secretary` (matrix D ✓/◐; superAdmin
  has no society JWT).
- Keep legacy names in the lists forever (existing users' claims carry them).
- `_down` restores the 029 bodies verbatim.
- **Verify:** existing admin/accountant sessions unaffected (lists are supersets); no new role exists
  yet, so nothing else changes. Zero-risk to ship immediately.

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

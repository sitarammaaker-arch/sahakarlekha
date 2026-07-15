# SahakarLekha Gap Analysis — Session 1 (Platform, Navigation, Auth, Access)

**Nature:** Audit only. No code written, no files modified, no refactor. Assesses the **current codebase** against the approved target architecture (Phase-3/4 blueprints: RBAC 17×14, multi-tenancy/branch, MFA, dual-control, role dashboards, segregation of duties).
**Scope (this session):** Architecture · Navigation · Sidebar · Routing · Dashboard · Authentication · Authorization · User Roles · Permission System · Feature Visibility. **Accounting modules explicitly excluded.**
**Prepared:** 2026-07-08.

---

## 1. Executive Summary

SahakarLekha is a **mature, feature-rich Vite + React + TypeScript + Supabase SPA** with ~150 routes and a genuinely well-engineered **capability-based navigation engine** that cleanly separates society-type entitlement from admin visibility, with nav and route-guard sharing one predicate. The platform foundation (routing, lazy-loading with stale-chunk recovery, capability resolver, FY-lock) is above-average for a product at this stage.

The **principal gaps are in the access-control layer**, measured against the approved target architecture:

- **Role model is 4 roles (admin/accountant/viewer/auditor)** vs the target **17 roles × 14 permission categories**; there is **no per-action (create/update/delete/approve) permission system** — gating is coarse, module-level, with `admin = everything`.
- **Route authorization is auth + society-capability only**; explicit **role gates exist on only a minority of modules** (~15 of ~100 catalog entries). Most operational routes are reachable by any authenticated role; client enforcement is **presentation-layer** and leans on Supabase RLS as the real backstop.
- **No branch dimension** in the data model (single-society-per-login); multi-branch / MSCS consolidation is page-level, not a first-class scope.
- **No MFA** in the login flow (an OTP UI component exists but is unused for auth); **session is localStorage-based** with a 30-min inactivity timeout.
- **Dashboard is single, role-agnostic** — the target's 7 role dashboards do not exist.
- **All 7 cooperative-type data providers mount for every society** regardless of type — a memory/performance and blast-radius concern at scale.

None of these are "broken product" issues — the app works — but they are the **defense-in-depth, scalability, and target-architecture** gaps that matter before scaling to many societies and role types. Overall platform health is **solid-but-uneven: strong navigation/capability core, weak fine-grained access control.**

---

## 2. Area-by-area assessment

| Area | Current design | Strengths | Key weaknesses / gaps |
|---|---|---|---|
| **1 Architecture** | Vite/React/TS SPA; Supabase backend; 7 React context providers (Data + 5 vertical + Language) all mounted globally; lazy routes with stale-chunk auto-reload | Clean lazy-loading; resilient chunk recovery; ErrorBoundary; capability engine isolates policy from code | **All vertical providers always mounted** (perf/memory, blast radius); heavy reliance on client contexts for financial data; no branch/tenant scoping layer |
| **2 Navigation** | `MODULE_CATALOG` single source of nav facts; `getVisibleGroups` renders domain-ordered groups; `useNavigation` engine | Excellent single-source design; nav & route-guard share `isModuleVisible`; extensible capabilities without touching module code | Role gates declared on only a minority of modules; `auditor` absent from nav `Role` type (only admin/accountant/viewer) — mapped to viewer |
| **3 Sidebar** | Capability-driven, collapsible, mobile-responsive, tooltips, i18n headings | Clean, accessible, engine-fed (never hardcoded); good UX | No search within nav; long lists for multi-capability societies; no favorites/recents |
| **4 Routing** | ~150 `ProtectedRoute` routes (auth-only) + `CapabilityGuard`; `SuperAdminRoute` for platform; catch-all 404 | Single chokepoint; CapabilityGuard closes URL-bypass for society-type; SEO noindex on app routes | **ProtectedRoute checks auth only, not role**; role enforcement depends on per-module `requiredRoles` (sparse); routes not in catalog treated as universal |
| **5 Dashboard** | One `Dashboard.tsx` (~586 lines); KPIs + compliance checks + charts; housing KPIs computed always, shown conditionally | Rich compliance/health checks; capability-aware KPI display | **Single role-agnostic dashboard** (no role dashboards); housing data hook always invoked; heavy client-side compute on render |
| **6 Authentication** | Multi-path login (Supabase Auth JWT → platform_admins RPC → `app_login` SECURITY DEFINER RPC → localhost demo users); 30-min idle timeout | Robust fallback chain; server-side password verify via RPC under RLS; demo users disabled in prod | **localStorage session** (XSS-exposure surface); **no MFA**; demo passwords in source (localhost-gated but present); reset flow auto-creates Supabase Auth users (complexity) |
| **7 Authorization** | `hasPermission(role)`: admin=all, auditor→viewer, list-match; route = auth + capability + optional `requiredRoles` | FY-lock guard on mutations; capability resolver prevents admin self-entitlement | **No per-action permission model**; coarse module-level gating; client-side only (explicitly "does not replace RLS"); segregation of duties not enforced in app |
| **8 User Roles** | 4 roles: admin, accountant, viewer, auditor | Covers the common minimum; auditor read-only intent | **Far below target 17 roles**; no Cashier/Store-keeper/Procurement/Board/Chairman/Secretary/CA distinctions; auditor≡viewer collapses a needed separation |
| **9 Permission System** | Role membership + module `requiredRoles` + capability entitlement | Capability entitlement model is sophisticated (server-sourced, admin can only hide) | **No 14-category permission matrix** (Create/Read/Update/Delete/Approve/Reject/Export/Print/Lock/Unlock/CloseFY/UserMgmt/Backup/Config); no dual-control for unlock/FY-close; no field/branch scoping |
| **10 Feature Visibility** | Capability-based per society type + jurisdiction (state) packs; super-admin show-all | Best-in-class: entitlement vs visibility split; state packs; deterministic pure resolver | Visibility ≠ authorization (a hidden module's route may still be reachable if not in catalog / no `requiredRoles`); relies on RLS for true enforcement |

---

## 3. Gap Register

| Gap ID | Area | Current situation | Expected (target architecture) | Business impact | Priority | Complexity | Dependencies |
|---|---|---|---|---|---|---|---|
| G-01 | Permission System | No per-action permission model; `admin = all`, coarse module gating | 14 permission categories × role (Create…Config) | Cannot enforce least privilege; audit/segregation weak | **P0** | XL | Roles, RLS |
| G-02 | Authorization | ProtectedRoute is auth-only; role gates on ~15% of modules | Every route role-scoped; server + client enforcement | Any role reaches most mutation routes (client) | **P0** | L | RLS, permission model |
| G-03 | User Roles | 4 roles; auditor≡viewer | 17 roles (Cashier, Store-keeper, Procurement, Board, Chairman, Secretary, CA…) | Real-world duties can't be modeled; SoD impossible | **P0** | L | Permission model |
| G-04 | Authorization | Segregation of duties not enforced (entry≠approval≠audit≠config) | Enforced SoD; maker-checker | Fraud-control gap; audit objection risk | **P0** | L | G-01, G-03 |
| G-05 | Permission System | Unlock/FY-close are single-admin ("contact administrator") | Dual-control (Chairman/Secretary + Admin) for unlock/FY-close | Back-dating / tampering risk | **P1** | M | Roles, FY-lock |
| G-06 | Authentication | No MFA on login or sensitive actions | MFA mandatory for privileged roles + unlock/FY-close | Account-takeover risk on admin | **P1** | M | Auth, roles |
| G-07 | Authentication | Session in localStorage | Hardened session (httpOnly where possible) + timeout | XSS token-theft surface | **P1** | M | Auth |
| G-08 | Architecture | No branch scoping; single-society-per-login | Tenant + branch + module scoping first-class | Multi-branch/MSCS societies unsupported at scale | **P1** | XL | Data model |
| G-09 | Architecture | All 7 vertical providers mount for every society | Providers loaded per society type | Memory/perf overhead; larger blast radius | **P1** | L | Provider refactor |
| G-10 | Dashboard | Single role-agnostic dashboard | 7 role dashboards (Chairman/Manager/Accountant/Auditor/Procurement/Inventory/Compliance) | Weak decision support; noise for narrow roles | **P1** | L | Roles, reports |
| G-11 | Feature Visibility | Visibility ≠ authorization; non-catalog routes universal | Every route in catalog with role+capability gate; deny-by-default | URL-typing can reach ungated sub-pages | **P1** | M | Catalog completeness, RLS |
| G-12 | Routing | Routes-not-in-catalog treated as allowed | Deny-by-default; explicit allow | Silent authorization gaps for new routes | **P1** | M | CapabilityGuard |
| G-13 | Navigation | `auditor` missing from nav Role type | All roles first-class in nav model | Auditor mis-modeled as viewer | **P2** | S | Role model |
| G-14 | Authentication | Demo users with plaintext passwords in source (localhost-gated) | No credentials in source | Low (gated) but hygiene/secret-scan risk | **P2** | S | — |
| G-15 | Dashboard | Housing data hook always invoked; heavy render compute | Lazy per-type KPI compute; memoized/server-side | Perf on large datasets | **P2** | M | Provider refactor |
| G-16 | Sidebar | No nav search / favorites / recents | Search + recents for 100+ modules | Findability at scale | **P2** | M | — |
| G-17 | Authorization | Client capability check duplicated; RLS is the real gate | Documented server-authoritative policy + parity tests | Drift risk between client and RLS | **P2** | M | RLS audit |
| G-18 | Permission System | No Export/Print/Backup permission gating | Those 3 categories gated per role | Data-exfil control gap | **P2** | M | G-01 |
| G-19 | Authentication | Multi-path login (4 fallbacks) adds surface/complexity | Consolidated, documented auth path | Maintenance & security-reasoning burden | **P3** | M | Auth |
| G-20 | Architecture | Financial state largely client-context resident | Server-authoritative with client cache | Integrity/scale ceiling | **P3** | XL | Data model |

---

## 4. Product Health Score

| Area | Score /10 | Note |
|---|---|---|
| Architecture | 6.5 | Strong lazy/resilience; provider-mount & client-state ceilings |
| Navigation | 9.0 | Best-in-class single-source capability engine |
| Sidebar | 8.0 | Clean, responsive; lacks search/recents |
| Routing | 6.5 | Single chokepoint good; role-gating sparse; non-catalog = allow |
| Dashboard | 6.0 | Rich content; no role dashboards; heavy render |
| Authentication | 5.5 | Robust fallbacks; no MFA; localStorage session |
| Authorization | 4.5 | Coarse; client-only; SoD unenforced |
| User Roles | 4.0 | 4 vs target 17; auditor≡viewer |
| Permission System | 4.0 | No per-action matrix; sophisticated capability layer offsets slightly |
| Feature Visibility | 8.5 | Excellent entitlement/visibility split & state packs |
| **Overall (weighted)** | **6.0 / 10** | Strong navigation/capability core; weak fine-grained access control |

*Weighting favors security-relevant areas (Authorization, Permission, Roles, Auth). The capability/navigation engine is a genuine asset; the access-control model is the priority remediation area.*

---

## 5. Top 20 Findings

1. **No per-action permission model** — `admin = all`, gating is module-level only (P0, G-01).
2. **Route protection is auth-only**; role gates on ~15% of modules (P0, G-02).
3. **Only 4 roles vs target 17**; auditor collapsed into viewer (P0, G-03).
4. **Segregation of duties not enforced** in the app layer (P0, G-04).
5. **Client-side authorization only** — CapabilityGuard explicitly defers to RLS as the real gate (P0/P1, G-02/G-17).
6. **Non-catalog routes are treated as universally allowed** — new routes are silently ungated (P1, G-12).
7. **No branch dimension** — single-society-per-login; multi-branch/MSCS not first-class (P1, G-08).
8. **No MFA** anywhere in the auth flow, incl. privileged actions (P1, G-06).
9. **localStorage session** — token-theft surface under XSS (P1, G-07).
10. **Unlock / FY-close are single-admin** — no dual-control (P1, G-05).
11. **All 7 vertical providers mount for every society** — perf/blast-radius (P1, G-09).
12. **Single role-agnostic dashboard** — target's 7 role dashboards absent (P1, G-10).
13. **Feature visibility ≠ authorization** — hidden modules may still be routable (P1, G-11).
14. **FY-lock IS implemented** (guardFYLocked on mutations) — a genuine strength to preserve (positive).
15. **Capability resolver prevents admin self-entitlement** — sophisticated, keep (positive).
16. **Navigation single-source `MODULE_CATALOG`** with shared nav/guard predicate — keep (positive).
17. **Demo credentials in source** (localhost-gated) — hygiene/secret-scan finding (P2, G-14).
18. **No Export/Print/Backup permission gating** — data-exfil control gap (P2, G-18).
19. **Dashboard housing hook always invoked** + heavy render compute (P2, G-15).
20. **Multi-path login (4 fallbacks)** increases security-reasoning and maintenance burden (P3, G-19).

*Positive findings (#14–16) are called out so remediation does not regress existing strengths.*

---

*End of Gap Analysis Session 1 — audit only; no code, no changes. Accounting modules out of scope (future session). STOP.*

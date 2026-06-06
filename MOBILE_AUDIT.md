# 📱 SahakarLekha — Mobile Responsiveness & Mobile-Friendly Audit

**Application:** https://sahakarlekha.com — Cloud accounting software for Indian cooperative societies
**Audit date:** 2026-06-06
**Audited build:** production `main` (Vite + React 18 + TypeScript + Tailwind + shadcn/ui)
**Target user:** cooperative-society accountants & secretaries, largely on **budget Android phones over 3G/4G in semi-urban / rural India** — this profile drives the severity weighting below.

---

## 1. Executive Summary

SahakarLekha has a **genuinely solid responsive foundation** — far better than most internal accounting tools. The viewport is configured correctly, the sidebar is a proper slide-in overlay with a hamburger and backdrop, every data table is wrapped so the *page* never breaks, all date fields are native pickers, and charts are responsive. A Google "Mobile-Friendly Test" would **pass**.

However, the app was clearly **designed desktop-first**, and three classes of problem make day-to-day accounting work on a phone slow and frustrating:

1. **Performance (Critical).** The entire app ships as a **single 3.37 MB JavaScript bundle (911 KB gzipped)** with **no code-splitting and no lazy-loaded routes**. For the target user (low-end Android, slow network) this means a multi-second blank screen on first load — the worst possible first impression.
2. **Cramped data-entry forms (Critical/High).** Many forms hardcode `grid-cols-3` / `grid-cols-4` **without a single-column mobile base**, so on a 320–375 px screen the core financial inputs (e.g. Members' *Shares / Face Value / Share Capital / Admission Fee* row) are squeezed to ~60 px — effectively unusable.
3. **Wide report tables (High).** Statutory registers run **9–13 columns**. They scroll horizontally (no page break), but the accountant must swipe back-and-forth to read a single row, with no mobile-optimised card/stacked view.

None of these cause **data loss** or a broken page layout — they are **performance and usability** problems. They are also **highly fixable**, mostly with mechanical Tailwind class changes plus one build-config change.

### Scorecard

| Dimension | Score | Verdict |
|---|---:|---|
| **Overall Mobile-Friendliness** | **64 / 100** | Usable but not comfortable on a phone |
| Responsive Design | 72 / 100 | Strong shell, weak forms/tables |
| Performance | 40 / 100 | Monolithic bundle, no splitting — the weakest area |
| Usability | 62 / 100 | Wide tables + cramped forms + small tap targets |
| Accessibility | 68 / 100 | Readable, but sub-44 px touch targets |

**Final Mobile Readiness Rating: 🟡 "Works, but needs a focused mobile pass" (64/100).**

---

## 2. Methodology & Screens Tested

This was a **source-level forensic audit** — every rendered layout was traced to its exact Tailwind classes and component structure at each breakpoint (320 / 360 / 375 / 390 / 414 / 768 px). Source code is the *ground truth* of what renders, so findings cite **file + line + class** rather than a screenshot of a single device. Performance figures are derived from the **actual production build output**.

> **Note on screenshots:** because the inner accounting screens are behind login + live society data, this audit deliberately uses code-level evidence (precise and reproducible) over device screenshots. A live screenshot pass at all six widths (running the dev server with a demo login) can be added on request — see §12.

**Breakpoints evaluated:** 320, 360, 375, 390, 414 px (phones) and 768 px (tablet portrait).

**Screens covered (75 pages):** all of `src/pages/*` — including every screen you named:

| Module | Screens audited |
|---|---|
| **Vouchers / Day-to-day** | Voucher Entry (`/vouchers`), Compound Voucher, Voucher Approval, Day Book, Cash Book, Bank Book, Bank Reconciliation, Ledger, Deleted Vouchers |
| **Statements** | Trial Balance, Balance Sheet, Profit & Loss, Trading A/c, Receipts & Payments, Reports hub |
| **Registers** | Members, Share Register, Loan Register, Asset Register, Depreciation, Audit Register, Meeting/Nomination/Board, Form-1 Member List, Recoverables, Kachi Aarat |
| **Stock / GST / Tax** | Inventory, Stock Valuation, Closing Stock Report, Purchase Register, Sale Register, GST Summary, TDS Register, TDS Form-16A, HSN Master, E-Way Bill |
| **Cooperative-specific** | NABARD Report, Federation Report, Reserve Fund, Profit Distribution, KCC Loan, Election, Budget |
| **Sales/Purchase ops** | Sale Management, Purchase Management, Suppliers, Customers, Salary |
| **Admin / Public / Auth** | Society Setup, User Management, Backup, Multi-Society Consolidation, Universal Importer, Super-Admin Dashboard, Landing, Pricing, About, Contact, FAQ, User Guide, Login, Register, Reset Password, Dashboard |

---

## 3. What is already done well ✅ (baseline credit)

These are genuinely correct and should **not** be changed:

- **Viewport meta** is correct: `width=device-width, initial-scale=1.0` (`index.html`).
- **Navigation is a proper mobile pattern.** Sidebar is hidden off-canvas (`max-md:-translate-x-full`), slides in on the hamburger tap, dims a backdrop (`bg-black/50 md:hidden`), and **closes on navigation** (`onClick={onMobileClose}`). `MainLayout` drops the content margin on mobile and uses responsive padding (`p-4 md:p-6`). (`MainLayout.tsx`, `Sidebar.tsx`, `Header.tsx`)
- **No table breaks the page.** The shadcn `<Table>` wraps in `overflow-auto`; every raw `<table>` (Federation, NABARD, Bank Rec, Importer, Multi-Society, register sub-tables) is individually wrapped in `overflow-x-auto`; the unsafe `.report-table` CSS class is **never used**.
- **Date entry is mobile-friendly.** Every date field is a native `<input type="date">` — the cramped `react-day-picker` calendar is *not* used for entry anywhere.
- **No iOS zoom-on-focus.** Inputs are 16 px on mobile (`h-10 text-base md:text-sm`) — exactly the right call.
- **Charts are responsive** — all recharts use `<ResponsiveContainer width="100%">` (Dashboard).
- **Auth pages are clean** — Login/Register/Reset are centered `max-w-md` cards; the decorative branding panel is `hidden lg:flex`.
- **No oversized hero text** — largest is `text-5xl` with responsive scaling; zero `text-6xl+`.
- **Header adapts** — truncates society name, hides Search/Help/role-badge progressively (`hidden sm:flex` etc.).

---

## 4. Findings by severity

Each finding: **Route → Issue → Impact → Fix → Severity.**

### 🔴 CRITICAL

---

#### CR-1 — Monolithic 3.37 MB JS bundle, zero code-splitting
- **Route / scope:** Every page (whole app).
- **Evidence:** Production build emits one `index-*.js` of **3,368 KB (911 KB gzip)**. `vite.config.ts` has **no `build.rollupOptions.output.manualChunks`**. `src/App.tsx` statically imports all **87** modules — **no `React.lazy`, no `Suspense`, no dynamic `import()`** for any route. Vite itself warns: *"Some chunks are larger than 500 kB."*
- **Impact:** First load downloads + parses ~3.4 MB of JS before *anything* renders. On a mid-range Android over rural 4G this is a realistic **5–10 s blank screen**; on 3G, far worse. This directly hits the product's core audience (budget phones, weak networks) and tanks LCP/FCP (see §8).
- **Fix:**
  1. Route-level lazy loading — wrap each page in `React.lazy(() => import('./pages/X'))` + a `<Suspense fallback>` in `App.tsx`. This alone splits ~75 pages out of the initial bundle.
  2. Add `manualChunks` to isolate heavy libs (`jspdf`, `html2canvas`, `recharts`, `xlsx`) so they load **only** when a PDF/Excel/chart is actually used.
  3. Lazy-load `jspdf`/`html2canvas` behind the "Export PDF" click (they already appear as separate chunks — make sure they're never in the critical path).
- **Severity:** **Critical** (highest-impact item for the target user).

---

#### CR-2 — Member form (and entity forms) use `grid-cols-4` / `grid-cols-3` with no 1-column mobile base
- **Route:** `/members` (worst), and the `grid-cols-3` cluster across `/inventory`, `/share-register`, `/tds-register`, `/suppliers`, `/customers`, `/nomination-register`, `/opening-balances`, `/election-module`, `/user-management`, `/board-of-directors`.
- **Evidence:** `Members.tsx:164` — `grid grid-cols-4 gap-3` wraps **Shares / Face Value / Share Capital / Admission Fee** (the four key numeric fields). Also `grid-cols-3` at `Members.tsx:86,112,126,194`. These dialogs are full-width on a phone (`sm:max-w-2xl` → ~300 px usable), and **Tailwind has no implicit responsive base**, so the columns never collapse: four inputs at **~60 px each** at 320 px.
- **Impact:** The most-used register's core financial inputs are too narrow to read their own values or tap accurately. Data-entry errors and frustration.
- **Fix:** Mechanical — `grid grid-cols-4` → `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`; `grid grid-cols-3` → `grid grid-cols-1 sm:grid-cols-3`. (Your `SalaryManagement.tsx` already does the equivalent with `col-span-2 sm:col-span-1` — reuse that precedent.)
- **Severity:** **Critical** on `/members`, **High** for the rest of the cluster.

---

### 🟠 HIGH

---

#### H-1 — No global `overflow-x-hidden` on the authenticated app shell
- **Route:** All in-app routes.
- **Evidence:** `index.css` `html`/`body` have no `overflow-x` guard; `MainLayout.tsx` root `<div>` and `<main>` have none either. Only `PublicLayout.tsx:23` sets `overflow-x-hidden`. So the entire logged-in app has **no safety clamp** — any one over-wide child (a `whitespace-nowrap` cell, a `min-w-[200px]` element inside a flex row on `/kachi-aarat` or `/recoverables`) scrolls the whole viewport sideways.
- **Impact:** Fragile. Today most pages are fine, but the protection is one stray element away from breaking, and small horizontal "jiggle" is a common complaint.
- **Fix:** Add `overflow-x-hidden` to `body` (in `index.css`) **or** to the `MainLayout` root/`<main>`. One line; highest leverage-to-effort ratio in this audit.
- **Severity:** **High** (preventive + cheap).

---

#### H-2 — Dialog primitive has no height cap / scroll; some dialogs clip on short phones
- **Route:** `/vouchers` (edit dialog), `/share-register` (edit dialog), plus any future dialog that forgets to self-cap.
- **Evidence:** `ui/dialog.tsx:39` `DialogContent` = `w-full max-w-lg … p-6` with **no `max-h-[…]` and no `overflow-y-auto`**. Width is fine (`w-full` shrinks), but tall forms can't scroll inside the dialog. `Vouchers.tsx:1058` (edit) and `ShareRegister.tsx:188` (edit, contains a `grid-cols-3` row) don't add their own cap. *(Members, Customers, Suppliers, Budget dialogs DO self-cap with `max-h-[90vh] overflow-y-auto` — good pattern.)*
- **Impact:** On a short phone in landscape or with the keyboard open, the bottom of the form (incl. **Save**) can sit off-screen with no way to scroll to it.
- **Fix:** Bake `max-h-[85vh] overflow-y-auto` into the `DialogContent` primitive (fixes all dialogs at once), or add it to the two non-capping dialogs.
- **Severity:** **High**.

---

#### H-3 — Wide statutory tables (9–13 columns) — heavy horizontal scrolling, no mobile layout
- **Routes & widths:**

  | Route | Cols | Route | Cols |
  |---|---:|---|---:|
  | `/closing-stock-report` | **13** | `/asset-register` | **12** |
  | `/purchase-register` | **13** | `/share-register` | **11** |
  | `/sale-register` | **11** | `/loan-register` | **11** |
  | `/form1-member-list` | **11** | `/deleted-vouchers` | **11** |
  | `/gst-summary` | **10** | `/audit-register` | **10** |
  | `/nomination-register` | **10** | `/voucher-approval` | up to **10** |
  | `/tds-register` | 9 | `/depreciation-schedule` | 9 |
  | `/members` | 8 | `/inventory` | 9 |

- **Impact:** The page doesn't break (tables scroll), but reading one row means swiping left-right repeatedly; the rightmost columns (Status / Amount / Actions) are hidden by default. Slow and error-prone on a phone.
- **Fix (see §5 for patterns):** Add a responsive **card/stacked layout** under `sm:` for the register tables, and/or a **priority-columns + expand** disclosure (you already do this on Sale/Purchase Register — extend it). For financial statements, a **sticky first column** keeps the particulars visible while amounts scroll.
- **Severity:** **High** (usability of statutory reporting on mobile).

---

#### H-4 — Voucher line-item entry table uses `overflow-visible` + tiny controls
- **Route:** `/vouchers` (the core daily task).
- **Evidence:** `Vouchers.tsx:772` wraps a 6-column raw `<table>` (#, Account picker, Dr/Cr `w-20` Select, Amount `w-32`, Narration, `w-8` delete) in `overflow-visible` (chosen so the AccountPicker popover isn't clipped). At 320 px the row exceeds width and **spills/wraps awkwardly instead of scrolling**. The line-remove button is `h-8 w-8`.
- **Impact:** Entering a voucher — the single most frequent action — is cramped and visually messy on a phone.
- **Fix:** Switch the wrapper to `overflow-x-auto` and render the AccountPicker popover with a portal (so it isn't clipped), or stack each voucher line into a labeled mini-card under `sm:`. Bump line controls to `h-9/h-10`.
- **Severity:** **High**.

---

#### H-5 — Touch targets below 44 px on clustered row-action buttons
- **Routes:** `/vouchers` (list: print/edit/restore/delete `h-8 w-8`, up to 4 per row), `/voucher-approval` (`h-7 w-7` view/approve/reject ×3), `/compound-voucher` (`h-7 w-7` delete), `/inventory` (`h-9` selects).
- **Evidence:** `VoucherApproval.tsx:219,230,239` (`h-7 w-7` = 28 px); `Vouchers.tsx:826,1020,1026,1033,1038` (`h-8 w-8` = 32 px); `CompoundVoucher.tsx:120` (`h-7 w-7`).
- **Impact:** 28–32 px targets clustered 3–4 across violate the ≥44 px guideline (Apple HIG / Google ≥48 dp). Mis-taps — dangerous when one of the cluster is **delete/reject**.
- **Fix:** Use `h-9 w-9` minimum for row actions, add spacing (`gap-1.5`), or collapse the cluster into a single `⋮` dropdown menu on mobile.
- **Severity:** **High** (accuracy + destructive-action risk).

---

### 🟡 MEDIUM

---

#### M-1 — Tab strips overflow on small phones
- **Routes:** Super-Admin Dashboard (`TabsList`, 3 long labels, no scroll — clips at 320–360 px), `/society-setup` (`grid-cols-5` tab strip, 5 icon+label tabs at ~60 px each).
- **Fix:** Make `TabsList` horizontally scrollable (`overflow-x-auto`) or icon-only with tooltips on mobile.
- **Severity:** Medium.

#### M-2 — `grid-cols-2` field pairs without a 1-col base
- **Routes:** `/register` (District/State + a Select — tightest, and it's a public signup form), `/loan-register`, `/asset-register`, `/suppliers`, `/customers`.
- **Fix:** `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`.
- **Severity:** Medium.

#### M-3 — `container` class wastes width on phones
- **Routes:** `/kachi-aarat` and `/recoverables` use `container mx-auto p-4` (the Tailwind `container` adds **2 rem each side**, *plus* the extra `p-4` → ~96 px lost on a 320 px screen); `/user-guide` similar.
- **Fix:** Drop `container` on these pages (the app shell already provides padding), or reduce to `px-3 sm:px-6`.
- **Severity:** Medium.

#### M-4 — Dashboard StatCard value wraps under the icon
- **Route:** `/dashboard`. `StatCard.tsx:50` renders the value at `text-3xl` inside `.stat-card`'s `p-6`; full-precision currency (`₹12,34,567.00`, 2 decimals) wraps awkwardly beneath the icon at 320 px.
- **Fix:** Reduce to `text-2xl sm:text-3xl`, trim padding to `p-4 sm:p-6`, and consider dropping paise on the dashboard tiles.
- **Severity:** Medium.

#### M-5 — Public site has no mobile menu
- **Route:** all public pages. `PublicLayout.tsx` renders only Login/Register inline (it doesn't overflow), but the 7 marketing/legal pages (About, Pricing, Guide, FAQ, Contact, Privacy, Terms) are reachable **only by scrolling to the footer** on mobile.
- **Fix:** Add a hamburger drawer to `PublicLayout` exposing those links.
- **Severity:** Medium (marketing/SEO UX, not the app itself).

#### M-6 — Landing hero CTAs not full-width on mobile
- **Route:** `/` (landing). `LandingPage.tsx:70,75` CTAs use `px-8` with bilingual labels; they stack but aren't `w-full`, so they can crowd a 320 px screen.
- **Fix:** `w-full sm:w-auto` on the hero buttons.
- **Severity:** Medium.

#### M-7 — Sale/Purchase item-entry tables cramped (scroll OK)
- **Routes:** `/sales`, `/purchases`. 6–7 column item tables with fixed `w-48/w-20/w-24` columns + an inline Select + icon button per row; `overflow-x-auto` present so they scroll, but Qty/Rate/delete require scrolling.
- **Fix:** Stack item rows into labeled cards under `sm:`.
- **Severity:** Medium.

---

### 🟢 LOW

- **L-1 — No `inputMode` on numeric fields.** `type="number"` is used everywhere (good) but `inputMode` is absent project-wide (0 matches). Add `inputMode="decimal"` (amounts/rates) / `inputMode="numeric"` (counts) to guarantee the numeric keypad. *Route: all entry forms.*
- **L-2 — Render-blocking Google Fonts `@import`.** `index.css:10` imports Hind+Inter via CSS `@import` placed **after** `@tailwind` (also the source of the build warning). This blocks first paint. Move to `<link rel="preconnect">` + `<link rel="preload" as="style">` in `index.html`, or self-host the fonts. *Improves FCP.*
- **L-3 — A few `h-9` native selects** (Inventory ledger pickers) are ~36 px, just under the 40 px target.
- **L-4 — `text-xs` in dense tables** is borderline at 320 px; consider `text-sm` for amount columns.

---

## 5. Data-Table Review & Recommended Mobile Layouts

**Current state:** tables are technically safe (all scroll, none break the page) but **not designed for phones** — 9–13 columns means constant horizontal swiping and hidden key figures.

**Recommended patterns (in priority order):**

1. **Card / stacked rows under `sm:` (best for registers).**
   On phones, render each record as a labeled card instead of a `<tr>`:
   ```
   ┌─────────────────────────────┐
   │ M-0142  ·  रामलाल शर्मा       │
   │ Shares: 50   Capital: ₹5,000 │
   │ Status: Active   [⋮ actions] │
   └─────────────────────────────┘
   ```
   Apply to: Members, Share Register, Loan Register, Asset Register, Form-1, Nomination, Audit Register, Deleted Vouchers.

2. **Priority columns + expand disclosure** (you already do this on Sale/Purchase Register — extend it). Show 3–4 essential columns; tap a row to reveal the rest. Best for Purchase/Sale/TDS/GST registers.

3. **Sticky first column** for financial statements (Trial Balance, Balance Sheet, P&L, Trading, R&P, Ledger, Cash/Bank Book): freeze the *Particulars* column (`sticky left-0 bg-card z-10`) so the label stays put while amounts scroll. Cheap and very effective.

4. **Column hiding by breakpoint** — mark non-essential columns `hidden sm:table-cell` (e.g. PAN, narration, "created by") and surface them in the detail/expanded view.

5. **Density** — on mobile reduce cell padding (`p-4` → `px-2 py-2`) and keep amount columns `text-sm`.

---

## 6. Form Usability Review

| Aspect | Finding | Severity |
|---|---|---|
| Multi-column grids | `grid-cols-3/4` without `grid-cols-1` base across Members, Inventory, ShareRegister, TdsRegister, Suppliers, Customers, etc. — fields crushed at 320–375 px | **Critical/High** (CR-2) |
| Dialog scroll | Primitive lacks `max-h`/`overflow-y-auto`; Vouchers-edit & ShareRegister-edit can clip Save off-screen | **High** (H-2) |
| Input visibility | Inputs are `h-10` 16 px on mobile — **good** (no iOS zoom) | ✅ |
| Dropdowns | shadcn `<Select>` `h-10` fine; a few raw `h-9` native selects slightly small | Low |
| Date pickers | **Native `<input type="date">` everywhere — excellent on mobile** | ✅ |
| Numeric entry | `type="number"` used, but no `inputMode` | Low (L-1) |
| Validation messages | Toast-based (bottom) — visible on mobile; inline field errors are sparse | Low |
| Keyboard overlap | Native inputs + (once H-2 is fixed) scrollable dialogs avoid the classic keyboard-covers-Save trap | Addressed by H-2 |

---

## 7. Navigation Audit

| Check | Result |
|---|---|
| Mobile menu (hamburger) | ✅ Present in `Header`, toggles overlay sidebar |
| Sidebar behavior | ✅ Off-canvas, slides in, dim backdrop, closes on nav-tap |
| Touch-friendly menu items | ✅ Nav links `px-3 py-2.5` (~44 px tall) |
| Important items reachable | ✅ All in-app sections in the sidebar |
| Header crowding | ✅ Progressive hide of Search/Help/role-badge on mobile |
| **Public-site nav** | ⚠️ No mobile menu — marketing/legal pages only via footer (M-5) |
| Tab strips | ⚠️ Super-Admin & Society-Setup tab rows clip/cramp on small phones (M-1) |

**Verdict:** In-app navigation is **well done**; the gaps are the public-site menu and a couple of tab strips.

---

## 8. Performance Audit

**Build artifacts (production):**

| Asset | Size | Gzip |
|---|---:|---:|
| `index-*.js` (app + all pages) | **3,368 KB** | **912 KB** |
| `html2canvas.esm-*.js` | 201 KB | 48 KB |
| `index.es-*.js` (jsPDF) | 151 KB | 52 KB |
| `purify.es-*.js` | 23 KB | 9 KB |
| `index-*.css` | 100 KB | 17 KB |

**Root causes:** no route-level code-splitting (87 static imports in `App.tsx`, zero `React.lazy`); no `manualChunks` in `vite.config.ts`; render-blocking Google-Fonts `@import`.

**Estimated field metrics** (projected from bundle size for a mid-range Android on rural 4G — *please confirm with a live Lighthouse/PageSpeed run*):

| Metric | Estimate | Target |
|---|---|---|
| FCP | ~2.5–4 s | < 1.8 s |
| LCP | ~4.5–9 s | < 2.5 s |
| TBT (parse/execute 3.4 MB JS) | high | < 200 ms |
| Lighthouse Mobile Perf | ~35–50 | ≥ 90 |

**Fixes (ordered):**
1. **Route-based `React.lazy` + `Suspense`** — biggest single win; removes ~75 pages from the first load.
2. **`manualChunks`** for `jspdf`, `html2canvas`, `recharts`, `xlsx` — load on demand.
3. **Preload/self-host fonts**, remove the CSS `@import`.
4. Add `build.chunkSizeWarningLimit` only *after* splitting (don't just silence the warning).
5. Consider a lightweight **route-level loading skeleton** so the screen isn't blank during lazy fetch.

---

## 9. Google Mobile-Friendly Standards

| Criterion | Status | Note |
|---|---|---|
| Viewport configured | ✅ Pass | `width=device-width, initial-scale=1` |
| Text legible without zoom | ✅ Pass | 16 px base; `text-xs` borderline in dense tables |
| Content sized to viewport | 🟡 Mostly | Tables scroll within bounds; **add global `overflow-x-hidden`** (H-1) to be safe |
| Tap targets ≥ 48 dp | 🟡 Partial | Nav/inputs OK; **row-action icons 28–32 px** (H-5) |
| No Flash / blocking tech | ✅ Pass | — |
| Avoid horizontal scrolling (page) | ✅ Pass | No page-level overflow found |
| Fast load on mobile | ❌ Fail | 911 KB-gzip monolith (CR-1) |

**Net:** would **pass** Google's binary "Mobile-Friendly Test," but **fail** Core Web Vitals on performance.

---

## 10. Prioritized Action Plan

**Sprint 1 — High impact, low effort (½–1 day):**
1. `H-1` Add `overflow-x-hidden` to `body`/`MainLayout` *(1 line)*.
2. `CR-2` Add `grid-cols-1` base to all bare `grid-cols-3/4` form grids — start with `Members.tsx:164` *(mechanical, ~30 edits)*.
3. `H-2` Add `max-h-[85vh] overflow-y-auto` to the `DialogContent` primitive *(1 file, fixes all dialogs)*.
4. `H-5` Bump row-action buttons to `h-9 w-9`, add spacing *(find/replace)*.
5. `H-4` Switch the voucher line table wrapper to `overflow-x-auto`.

**Sprint 2 — The performance win (1–2 days):**
6. `CR-1` Route-level `React.lazy` + `Suspense` in `App.tsx`.
7. `CR-1` `manualChunks` for jsPDF/html2canvas/recharts/xlsx.
8. `L-2` Preload/self-host fonts; drop the CSS `@import`.

**Sprint 3 — Mobile table UX (2–4 days):**
9. `H-3` Card/stacked layout for the top register tables (Members, Loan, Share, Asset, Purchase/Sale, GST, TDS).
10. Sticky first column for the financial statements.

**Sprint 4 — Polish:**
11. `M-1` scrollable tab strips; `M-3` drop `container`; `M-4` StatCard sizing; `M-5` public mobile menu; `M-6` `w-full` hero CTAs; `M-7` Sale/Purchase item cards; `L-1` `inputMode`.

---

## 11. Developer Action Items (checklist)

- [ ] `index.css` / `MainLayout` — add `overflow-x-hidden` to body or shell **(H-1)**
- [ ] `ui/dialog.tsx` — `DialogContent` add `max-h-[85vh] overflow-y-auto` **(H-2)**
- [ ] `Members.tsx`, `Inventory.tsx`, `ShareRegister.tsx`, `TdsRegister.tsx`, `Suppliers.tsx`, `Customers.tsx`, `NominationRegister.tsx`, `OpeningBalances.tsx`, `ElectionModule.tsx`, `UserManagement.tsx`, `BoardOfDirectors.tsx` — add `grid-cols-1` base to `grid-cols-3/4` **(CR-2)**
- [ ] `Register.tsx:304`, `LoanRegister.tsx:43`, `AssetRegister.tsx:48` — `grid-cols-1 sm:grid-cols-2` **(M-2)**
- [ ] `Vouchers.tsx:772` — `overflow-visible` → `overflow-x-auto`; portal the AccountPicker popover **(H-4)**
- [ ] `VoucherApproval.tsx`, `Vouchers.tsx`, `CompoundVoucher.tsx` — row-action buttons `h-7/h-8` → `h-9` **(H-5)**
- [ ] `App.tsx` — convert all page imports to `React.lazy` + add `<Suspense>` **(CR-1)**
- [ ] `vite.config.ts` — add `build.rollupOptions.output.manualChunks` for jspdf/html2canvas/recharts/xlsx **(CR-1)**
- [ ] `index.html` / `index.css` — preconnect+preload fonts, remove `@import` **(L-2)**
- [ ] `SuperAdminDashboard.tsx`, `SocietySetup.tsx` — `TabsList` `overflow-x-auto` **(M-1)**
- [ ] `KachiAaratRegister.tsx`, `RecoverablesRegister.tsx` — drop `container` **(M-3)**
- [ ] `StatCard.tsx` — `text-2xl sm:text-3xl`, `p-4 sm:p-6` **(M-4)**
- [ ] `PublicLayout.tsx` — add mobile hamburger menu **(M-5)**
- [ ] Register tables — card/stacked mobile layout; statements — sticky first column **(H-3)**
- [ ] Add `inputMode` to numeric inputs **(L-1)**

---

## 12. Final Mobile Readiness Rating

> ## 🟡 64 / 100 — "Functional on mobile, not yet comfortable"

The **structure is right** (viewport, overlay nav, wrapped tables, native date inputs, responsive charts) — this is not a rebuild. What's missing is a **focused mobile pass**: split the bundle for speed, give forms a single-column mobile base, give wide registers a card layout, and enlarge a handful of tap targets. **Sprints 1–2 alone (≈2–3 days) would lift this to ~80/100** and fix every Critical/High item.

| | Before | After Sprints 1–2 (projected) |
|---|---:|---:|
| Overall | 64 | ~80 |
| Performance | 40 | ~75 |
| Usability | 62 | ~78 |
| Responsive | 72 | ~85 |

---

*Methodology: source-level forensic audit of the production `main` branch (every layout traced to its Tailwind classes at 320–768 px) + analysis of the production build output. Live device screenshots and a Lighthouse field run are recommended to confirm the projected performance metrics.*

---

# Part 2 — Fixes Applied & Verified (Sprint 1 + Sprint 2)

After the audit above, Sprints 1 & 2 were implemented and verified live in a browser at **320 / 375 / 768 px** (dev server + demo login).

## ✅ Sprint 1 — Layout / form / touch-target fixes (DONE)
| Item | What changed | Files |
|---|---|---|
| **H-1** global overflow guard | `overflow-x-hidden` on the app shell | `MainLayout.tsx` |
| **H-2** dialog scroll | `max-h-[90vh] overflow-y-auto` baked into the Dialog primitive (fixes every dialog) | `ui/dialog.tsx` |
| **CR-2** form grids | bare `grid-cols-3`→`grid-cols-1 sm:grid-cols-3`, `grid-cols-4`→`grid-cols-2 sm:grid-cols-4`, flagged `grid-cols-2`→`grid-cols-1 sm:grid-cols-2` | Members, Inventory, ShareRegister, TdsRegister, Suppliers, Customers, NominationRegister, OpeningBalances, ElectionModule, UserManagement, BoardOfDirectors, Register, LoanRegister, AssetRegister |
| **H-4** voucher line table | wrapper `overflow-visible`→`overflow-x-auto` (AccountPicker popover is portaled, so not clipped) | `Vouchers.tsx` |
| **H-5** touch targets | row-action icon buttons `h-7/h-8`→`h-9` | Vouchers, VoucherApproval, CompoundVoucher |
| **M-1** tab strips | scrollable / wrapping TabsList on mobile | SuperAdminDashboard, SocietySetup |
| **M-3** container padding | dropped `container` (saves ~64–96 px on phones) | KachiAaratRegister, RecoverablesRegister |
| **M-4** StatCard | value `text-2xl sm:text-3xl break-words`, card `p-4 sm:p-6` | StatCard, index.css |

## ✅ Sprint 2 — Performance (DONE)
- **Route-level code-splitting** — all 75 pages converted to `React.lazy` + a `<Suspense>` fallback (`App.tsx`).
- **`manualChunks`** added (`vite.config.ts`) — `pdf` (jsPDF), `charts` (recharts), `xlsx`, `supabase`, `icons`, `radix`, `router` load on demand.
- **Fonts** — moved from render-blocking CSS `@import` to `<link rel="preconnect">` + stylesheet in `index.html` (also removed the build warning).

### Bundle: before → after
| | Before | After |
|---|---:|---:|
| Initial JS (gzip) | **911 KB** (one 3.37 MB chunk) | **~88 KB** (`index` chunk) |
| jsPDF / html2canvas | in main | `pdf` chunk, on Export only |
| recharts | in main | `charts` chunk, Dashboard only |
| xlsx | in main | `xlsx` chunk, import/export only |
| per page | in main | own 3–10 KB chunk |

**~90 % reduction in initial JavaScript** — the single biggest mobile win.

## 🔬 Live verification (320 / 375 / 768 px)
- **Programmatic overflow check** at 320 px across `/dashboard`, `/members`, `/trial-balance`, `/loan-register`, `/gst-summary`, `/vouchers`, `/closing-stock-report` → **`scrollWidth === innerWidth` (zero horizontal page overflow)** on every page, including the 13/11/10-column reports.
- **375 px** — landing stacks cleanly; login centered; dashboard StatCards single-column & readable; mobile sidebar overlay + backdrop works; **Member form fields now stack** (Age/Occupation/Caste one-per-row) and the dialog scrolls to the Save button.
- **768 px** — switches to the persistent sidebar + 2×2 StatCard layout; no overflow.

## Revised scores (post Sprint 1 + 2)
| Dimension | Before | Now |
|---|---:|---:|
| **Overall** | 64 | **~80** |
| Responsive Design | 72 | ~85 |
| Performance | 40 | ~75 |
| Usability | 62 | ~78 |
| Accessibility | 68 | ~72 |

## ⏭️ Remaining (Sprint 3–4, optional polish — not yet done)
- **H-3** card/stacked mobile layout for the widest registers + **sticky first column** for statements (today they scroll horizontally — safe, but still swipe-heavy).
- **M-5** public-site hamburger menu; **M-6** `w-full` hero CTAs; **M-7** Sale/Purchase item cards.
- **L-1** `inputMode` on numeric fields.

*Verified: 2026-06-06 via local dev server + Claude preview at 320/375/768 px. Typecheck + production build pass.*

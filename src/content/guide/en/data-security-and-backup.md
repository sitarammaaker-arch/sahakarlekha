# Chapter 26 — Data Security & Backup

> **After this chapter you will be able to:** cloud security and RLS; role control; export backups; password hygiene; the "local vs cloud" safeguard.

## 26.1 Cloud security
Data lives in the Supabase cloud (Postgres); society-level row security (RLS) — each society sees only its own data.

## 26.2 RLS & isolation
JWT login + society-scoped RLS → another society’s data is out of reach; tested without lockout.

## 26.3 Role control
Admin/Accountant/Viewer + Maker-Checker — a separate login per person with limited rights.

## 26.4 Local vs cloud (RULE 1)
The biggest risk: it shows locally, isn’t saved to cloud, gone on F5. The safeguard: base columns first on every save; on failure, local rollback + a destructive toast (≥10s).

> ⚠️ "Saved locally, not in Supabase" — this is exactly what the two-step save and rollback prevent.

## 26.5 Export backups
Export report PDFs/Excel regularly and keep them safe — an extra layer and an offline copy.

## 26.6 Password hygiene
Strong, separate passwords; don’t share; reset via email; society_users ↔ Auth kept in sync.

## ⚠️ Common mistakes

| Mistake | Avoid by |
|---|---|
| Shared login | A separate user |
| No backups | Regular export |
| Ignoring a save failure | Watch the toast, retry |

## 🔍 Audit note
"Data cloud-secured (RLS); role control; regular backups; rollback on a save failure."

## 📘 Standard
Member data is confidential; access is role-based; record-retention is required.

## ✅ Worked example
Rania: 3 users (Admin/Accountant/Viewer), month-end PDF backups, a red toast on a save failure → nothing lost.

## 📚 Case study
A voucher used to show locally and vanish on F5. After the two-step save + rollback, a failure shows immediately and data stays safe.

## ❓ FAQ
**Q. If the internet drops?** Watch the save confirmation; the PDF backup is offline.
**Q. Will another society see it?** No — RLS.

## ✏️ Exercises
1. RLS in one line.
2. RULE 1’s risk and safeguard.
3. How do you take a backup?
4. The harm of a shared login.
5. What to do on a save failure?

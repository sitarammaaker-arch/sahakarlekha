# SahakarLekha Research Task 3.9 — Security, Governance & Reliability Architecture

**Scope:** Enterprise security/governance/reliability only. No code, schema, UI, or infra detail. Based on prior findings.

## PART 1 — Security architecture
| Control | Design / policy |
|---|---|
| **Authentication** | Email/mobile + password, per-tenant; **platform-admin is JWT-less** → data access via controlled SECURITY-DEFINER-style RPCs only |
| **Authorization** | RBAC (17 roles × 14 permissions), **tenant + branch + module scoped**, least privilege, segregation of duties |
| **Multi-Factor Auth** | **Mandatory** for privileged roles (Admin, Chairman, Secretary) and sensitive actions (unlock, FY-close); optional for others |
| **Password policy** | Min length + complexity, expiry, history reuse-block, lockout on repeated failures |
| **Session management** | Idle timeout, token expiry, concurrent-session control, forced logout on role change |
| **Device management** | Trusted-device registration/binding for finance & admin roles |
| **IP restrictions** | Optional per-society IP allowlist for admin/finance functions |
| **Encryption** | In-transit (TLS) + at-rest; sensitive fields (KYC/PII) field-encrypted |
| **Data privacy** | PII minimization, consent, purpose limitation, role-scoped access to member data |
| **Digital signatures** | DSC for statutory filings & audit sign-off where legally required |

## PART 2 — Governance
| Control | Rule | Authority |
|---|---|---|
| **Financial Year Lock** | Lock on FY close post-AGM; blocks all mutation; dual-control unlock only | Secretary/Board |
| **Voucher Lock** | Approved/posted vouchers locked; changes via reversal only (no hard edit) | System on approval |
| **Period Lock** | Monthly/period lock after reconciliation; reopen via dual-control | Accountant/Admin |
| **Audit Lock** | Records under audit locked; no edit during audit window | Auditor/Secretary |
| **Approval Governance** | Authorization matrix (amount+type+role) + maker-checker + segregation | Per matrix |
| **Data Ownership** | Society owns its data; platform is custodian; strict per-tenant ownership | Society |
| **Data Retention** | ≥10 years books/vouchers; member/share records permanent | Secretary/Admin |
| **Archival Policy** | Archive post-retention → read-only, lifecycle-managed | Admin |
| **Record Restoration** | Restore from backup/archive via dual-control + logged reason | Admin + approval |

## PART 3 — Reliability
| Area | Strategy |
|---|---|
| **Backup Strategy** | Automated periodic + point-in-time; per-tenant; **restore-tested** |
| **Disaster Recovery** | Defined RPO/RTO; geo-redundant copies |
| **Business Continuity** | Continuity plan; offline fallback for field operations |
| **High Availability** | Redundant services; no single point of failure |
| **Offline Strategy** | **Offline-first field capture with integrity-safe sync** (the market gap) |
| **Data Recovery** | Point-in-time restore; **no silent data loss** |
| **Version History** | Before/after versioning on key records |
| **Change Log** | Immutable change log spanning all modules |

## PART 4 — Audit trail (model for every transaction)
| Field | Captures |
|---|---|
| **Who** | User identity + role (+ tenant/branch) |
| **What** | Entity + action (create / update / delete / approve / reject / cancel / unlock) |
| **When** | Immutable timestamp |
| **Before value** | Prior state of changed fields |
| **After value** | New state of changed fields |
| **Reason** | Mandatory on edit / cancel / reject / unlock / FY-close |
| **Approval** | Approver identity + level (per authorization matrix) |

*Storage: **append-only / WORM**, non-repudiable, spans all modules and privileged actions.*

## PART 5 — Risk register (Top 25)
| # | Risk | Impact | Prob. | Prevention | Recovery | Pri |
|---|---|---|---|---|---|---|
| 1 | Local-vs-cloud data divergence (silent save fail) | Lost work/data | High | Rollback + two-step persist | Audit trail + backup restore | Critical |
| 2 | Report-vs-source formula drift | Wrong financials/audit fail | Med | Single computation layer | Recompute | Critical |
| 3 | NPA misclass. / overdue interest as income | Overstated surplus, objection | High | NPA engine + exclusion rule | Restatement | Critical |
| 4 | Fraud via unauthorized payments | Financial loss | Med | Maker-checker + dual signatories | Reversal + investigation | Critical |
| 5 | Backup failure / data loss | Irrecoverable loss | Low | Tested backups + redundancy | DR restore | Critical |
| 6 | Offline sync conflict / field-data loss | Lost field data | Med | Integrity-safe sync + queue | Replay queue | Critical |
| 7 | Multi-tenant data leakage | Cross-society breach | Low | Strict isolation + tests | Contain + audit | Critical |
| 8 | Unauthorized access / privilege creep | Breach/fraud | Med | RBAC + segregation + access review | Revoke + audit | High |
| 9 | FY/period unlock misuse (back-dating) | Manipulated accounts | Low-Med | Dual-control + logging | Audit-trail review | High |
| 10 | Data breach / PII leakage | Legal/reputational | Med | Encryption + access control + privacy | Incident response | High |
| 11 | Statutory non-compliance (missed filings) | Penalties/deregistration | Med | Compliance calendar + alerts | Late-file + rectify | High |
| 12 | Migration errors (opening balances) | Wrong opening books | High | Validation + audited-closing tie | Re-migrate | High |
| 13 | Stock shortage / valuation error | Overstated assets | Med | Canonical formula + verification | Adjust + write-off | High |
| 14 | Duplicate / erroneous payments | Financial loss | Med | Duplicate detection + approval | Reverse | High |
| 15 | Config error (reserve %, tax rate, cap) | Wrong appropriation/tax | Med | Validated + effective-dated config | Recompute | High |
| 16 | Audit-trail integrity loss | Non-repudiation failure | Low | Append-only / WORM | Forensic review | High |
| 17 | Ransomware / malware | Outage/loss | Low | Security controls + backups | DR restore | High |
| 18 | Untrained users (PACS secretaries) | Data errors / low adoption | High | Guided workflows + training | Support + correction | High |
| 19 | Integration failure (bank/GST/gateway) | Failed filings/payments | Med | Retry/circuit-breaker + adapters | Manual fallback | Med |
| 20 | Vendor/format change (GST/TDS) | Broken returns | Med | Versioned adapters | Adapter update | Med |
| 21 | Audit-objection non-rectification | Repeated objections/downgrade | Med | Objection tracking + follow-up | Rectify | Med |
| 22 | Key-person dependency (single secretary) | Continuity risk | Med | Role backup + delegation | Reassign | Med |
| 23 | Scalability/performance degradation | Slow/unusable | Med | OLTP/OLAP split + scaling | Scale-out | Med |
| 24 | Regulatory change (RBI/Labour Codes/Finance Act) | Non-compliance | High | Configurable rules + monitoring | Update config | Med |
| 25 | Government ERP competition (free NLPS) | Market/business risk | High | Differentiation (offline, multi-type) | Reposition | Med |

**Governance note:** the Critical cluster (risks 1–7) is dominated by **data integrity, correctness and fraud** — not infrastructure — consistent with prior-phase findings; these are mitigated primarily by the rollback/formula-consistency/segregation/audit-trail controls above, and secondarily by backups and DR.

*End of Task 3.9 — stopping here. Enterprise security/governance/reliability architecture only; no code, schema, UI, or infra detail. (~880 words.)*

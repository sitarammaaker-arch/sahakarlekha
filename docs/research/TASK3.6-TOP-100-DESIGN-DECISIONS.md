# SahakarLekha Research Task 3.6 — Top 100 Product Design Decisions (pre-development)

**Scope:** Enterprise product-design decisions only. No code, UI, schema, or new research. Based on all prior phases. **Fields:** Decision · Why it matters · Options · Recommended · Reason · Risks · Dependencies · Priority (Critical/High/Medium) · Change later? (Y/N). 100 decisions across 25 categories (4 each).

## 1. Accounting Engine
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Basis of accounting | Determines income/expense recognition | Accrual / Cash | **Accrual (cash for tiny societies)** | NABARD CAS mandates accrual; NPA needs it | Migration effort if switched | COA, Loans | Critical | N |
| Double-entry enforcement | Financial correctness | Strict / lenient | **Strict balanced vouchers** | Prevents unbalanced books | Rejects some quick entries | Voucher engine | Critical | N |
| Posting model | Ledger timeliness | Real-time / batch | **Real-time posting + period lock** | Live balances; audit trust | Concurrency load | FY-lock | High | N |
| Multi-currency | Future scope | INR-only / multi | **INR-only, extensible** | India-only now | Rework if global | — | Medium | Y |

## 2. Financial Year
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| FY definition | Period boundary | Apr–Mar fixed / configurable | **Apr–Mar default, configurable** | Statutory norm; some vary | Cut-off errors | Society master | High | Y |
| FY-lock/unlock | Data integrity | No lock / lock+dual-unlock | **Lock on close, dual-control unlock** | Prevents back-dated tampering | Ops friction | RBAC | Critical | N |
| Opening-balance rule | Continuity | Manual / auto from audited | **Auto = prior audited closing** | Prevents wrong openings | Blocks pre-audit open | Audit | Critical | N |
| Concurrent open periods | Adjustments | Single / multiple | **One active FY + prior-year window** | Allows audit adjustments | Complexity | FY-lock | Medium | Y |

## 3. Voucher Engine
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Voucher taxonomy | Transaction classification | Fixed / extensible | **Core fixed + config sub-types** | Consistency + flexibility | Sprawl if uncontrolled | Accounting | Critical | N |
| Numbering | Audit continuity | Free / gap-free serial | **Gap-free per type/FY/branch** | Audit requirement | Renumber pain | FY, Branch | High | N |
| Edit/cancel policy | Integrity | Hard edit / soft-cancel | **Soft-cancel + reversal, no post-approval hard edit** | Never lose audit trail | User confusion | Audit trail | Critical | N |
| Per-item ledger routing | Category-wise reporting | Lumped / per-account | **Route by sales/purchase account (default 4101/5101)** | Enables per-category Trading/P&L | Setup effort | COA | High | Y |

## 4. Chart of Accounts
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| COA structure | Reporting basis | Fixed template / per-society | **Standard template + per-society extension** | Consistency + local needs | Divergence | Society type | High | Y |
| Coding scheme | Grouping/reporting | Flat / class-coded hierarchy | **5-class coded hierarchy** | Maps to statements | Rework if changed | — | Critical | N |
| CAS alignment (PACS) | Statutory | Generic / NABARD CAS | **NABARD CAS heads for PACS** | Refinance/audit compliance | Type-specific effort | Accounting | High | N |
| Control/subsidiary model | Member-wise balances | Single / control+sub | **Control + member-wise subsidiaries** | Reconciliation invariant | Complexity | Member | Critical | N |

## 5. Member Management
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Member uniqueness | Identity integrity | Free / unique+KYC | **Unique membership no. + KYC** | Statutory register | KYC friction | Society | Critical | N |
| Nominee | Statutory | Optional / mandatory | **Mandatory nominee** | Legal requirement | Onboarding delay | Member | High | Y |
| Deletion policy | Audit continuity | Delete / inactive-only | **Never delete, inactive only** | Historical integrity | Data growth | — | Critical | N |
| Member entity model | Cross-type reuse | Per-type / common+attributes | **Common member + type attributes** | One-core reuse | Over-generalization | Society type | Medium | Y |

## 6. Share Capital
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Share-capital model | Capital accuracy | Aggregate / member-wise | **Member-wise ledger tied to control** | Prevents ledger≠BS | Complexity | Member, COA | Critical | N |
| Transfer premium cap | Compliance | Fixed / configurable | **Configurable cap (₹25k Maha housing)** | State-variant | Wrong cap risk | Config | High | Y |
| Dividend cap & gate | Statutory | Free / cap+AGM gate | **Config cap + AGM approval gate** | Legal limit | Over-distribution | Appropriation | High | Y |
| Certificate lifecycle | Traceability | Untracked / tracked | **Issue/transfer/cancel tracked** | Audit trail | Overhead | Share ledger | Medium | Y |

## 7. Procurement
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Procurement model | Type coverage | Purchase-only / +MSP/pool | **Both purchase + agency/pool** | Marketing/PACS need pool | Complexity | Inventory | High | Y |
| Approval thresholds | Governance | Fixed / configurable | **Configurable tender/quote thresholds** | State/bye-law variance | Misconfig | Approvals | High | Y |
| 3-way match | Purchase integrity | Off / enforced | **Enforce PO-GRN-invoice** | Prevents fictitious purchases | Slower entry | Inventory | High | Y |
| Agency reconciliation | Marketing/PACS | Manual / built-in | **Built-in agency/federation reconciliation** | Ends unreconciled accounts | Effort | Procurement | High | Y |

## 8. Inventory
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Valuation method | Stock value accuracy | FIFO / weighted-avg | **Weighted average (config FIFO)** | Simpler, common | Hard to switch later | Item master | High | N |
| Canonical stock formula | Report consistency | Field / formula / mixed | **Single formula (opening+movements) shared everywhere** | Prevents phantom-stock bug | Bugs if split | Inventory | Critical | N |
| Physical verification | Shortage control | Ad hoc / periodic+approval | **Periodic verification + committee write-off** | Audit requirement | Overhead | Approvals | High | Y |
| Batch/expiry | Perishables | None / optional | **Optional per item (Consumer/Dairy)** | Only some need it | Complexity | Item | Medium | Y |

## 9. Assets
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Depreciation method | P&L accuracy | SLM / WDV | **WDV default, configurable** | Common practice | Restatement if switched | Assets | High | Y |
| Capitalization threshold | Expense vs asset | Fixed / configurable | **Configurable threshold** | Society-specific | Misclassification | Config | Medium | Y |
| Disposal approval | Governance | Manager / committee | **Committee/general-body approval** | Statutory control | Delay | Approvals | High | N |
| Property-register alignment | Statutory | Custom / Rule-65 property register | **Map to property register** | Audit compliance | State variance | COA | Medium | Y |

## 10. Payroll
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Payroll scope | Coverage | Staff-only / +member-workers | **Both; Labour muster model** | Labour co-ops need muster | Complexity | Employee | High | Y |
| Statutory deductions | Compliance | Manual / engine | **Config PF/ESI/TDS/PT engine** | Penalty risk | Rate churn | Tax | High | Y |
| Muster-wage linkage | Integrity | Separate / tied | **Muster-to-wage tie-out** | Ends wage≠muster | Effort | Attendance | High | Y |
| Module optionality | Fit | Always-on / optional | **Optional module** | Not all have staff | — | Society config | Medium | Y |

## 11. Loans
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Product configurability | Flexibility | Hard-coded / configurable | **Configurable ST/MT/LT products** | Varied loan types | Config complexity | Loans | High | Y |
| NPA classification | Statutory | None / NABARD-RBI engine | **Config NPA policy + provisioning** | #1 audit defect area | Wrong provisioning | Accounting | Critical | N |
| Overdue-interest treatment | Income correctness | Accrue all / exclude overdue | **Exclude overdue interest from income** | Prevents overstated surplus | Restatement | NPA engine | Critical | N |
| DCB model | Recovery tracking | None / DCB | **Demand-collection-balance tracking** | Recovery discipline | Effort | Loans | High | N |

## 12. Deposits
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Product support | Coverage | Fixed / configurable | **Configurable SB/FD/RD/pigmy** | Varied products | Complexity | Deposits | High | Y |
| Interest engine | Accuracy | Manual / product-wise | **Product-wise interest engine** | Correct accrual | Miscalculation | Accounting | High | N |
| Maturity/renewal | Lifecycle | Manual / auto+workflow | **Auto maturity + renewal workflow** | Reduces errors | Edge cases | Workflow | Medium | Y |
| Deposit KYC | Compliance | Optional / mandatory | **Mandatory KYC** | Regulatory | Friction | Member | High | N |

## 13. Taxation
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| GST engine | Compliance | Manual / config+ITC | **Config GST + ITC reconciliation** | Penalty risk | Rate churn | Sales/Procurement | High | Y |
| TDS engine | Compliance | Manual / engine | **Config TDS + challan/return** | Statutory | PAN errors | Payments | High | Y |
| Income-tax capture | Filing support | None / 80P vs 115BAD capture | **Capture data, no advice** | Enables ITR prep | Regime change | Accounting | Medium | Y |
| Rate-change tolerance | Annual change | Hard-coded / effective-dated | **Effective-dated config rates** | Finance Act changes yearly | Stale rates | Tax master | High | Y |

## 14. Reports
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Statutory formats | Compliance | Generic / per-type templates | **Template set per society type** | R&P/P&L/BS/DCB differ | Effort | Accounting | Critical | Y |
| Formula consistency | Correctness | Per-report / shared layer | **Single shared computation layer** | Prevents report≠source drift | Bugs if split | Accounting | Critical | N |
| OLTP/OLAP split | Performance | Same DB / separated | **Read-replica/analytics store** | Heavy reports scale | Cost | Infra | Medium | Y |
| Export formats | Usability | PDF only / +Excel | **Excel + PDF** | Statutory & MIS | — | Reports | High | Y |

## 15. Workflow
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| State machine | Consistency | Per-module / uniform | **Uniform Draft→…→Locked→Archived** | Predictable behaviour | Rigidity | — | High | N |
| Config vs fixed | Flexibility | Fixed / configurable routing | **Fixed states + configurable approval routing** | Balance | Misconfig | Approvals | Medium | Y |
| Cancel/reopen contract | Integrity | Ad hoc / standard | **Reason-gated soft-cancel + dual-control reopen** | Audit trail | Friction | Audit | Critical | N |
| Escalation | Bottlenecks | None / route-up | **Route-up + FY-lock block** | Prevents stuck items | Complexity | Approvals | Medium | Y |

## 16. Approvals
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Approval-matrix engine | Governance | Hard-coded / configurable | **Configurable matrix (amount+type+role)** | Authorization matrix varies | Misconfig | RBAC | High | Y |
| Maker-checker | Fraud control | Optional / mandatory high-risk | **Mandatory for e-payments/loans** | Prevents fraud | Slower | Workflow | High | N |
| Auto-approval | Efficiency | None / threshold | **Config low-value auto-approve** | Reduces friction | Bypass risk | Matrix | Medium | Y |
| Delegation of authority | Continuity | None / DoA | **Documented DoA with segregation** | Cover absences | Over-delegation | RBAC | Medium | Y |

## 17. Security
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| RBAC model | Access control | Coarse / roles×permissions | **17 roles × 14 permissions, scoped** | Least privilege | Complexity | Users | Critical | N |
| Segregation of duties | Fraud control | None / enforced | **Entry≠approval≠audit≠config** | Fraud prevention | Staffing constraints | RBAC | Critical | N |
| Sensitive-permission governance | Risk | Open / dual-control | **Dual-control unlock/FY-close** | Highest-risk actions | Friction | Workflow | Critical | N |
| Platform-admin access | Admin data | Direct / controlled RPC | **Controlled SECURITY-DEFINER RPCs (JWT-less admin)** | Safe admin access | Misuse | Audit | High | N |

## 18. Multi-Society
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Tenancy model | Scale/isolation | Per-instance / multi-tenant | **Multi-tenant** | Scale + cost | Isolation bugs | Infra | Critical | N |
| Society-type axis | Verticalization | Single / type-config | **Type drives module enablement** | One-core-many-verticals | Config sprawl | Modules | Critical | N |
| Data isolation | Privacy | Shared / strict isolation | **Strict tenant isolation** | Legal/privacy | Leakage risk | Tenancy | Critical | N |
| Shared vs per-society masters | Consistency | All-shared / per-society | **Per-society + shared reference (tax)** | Local control | Duplication | Master data | Medium | Y |

## 19. Multi-Branch
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Branch scoping | Data segregation | None / branch scope | **Branch scope on entities** | Multi-branch societies | Rework if added late | Tenancy | High | N |
| Inter-branch account | Reconciliation | None / IB account | **Inter-branch reconciliation account** | Prevents unreconciled | Complexity | Accounting | High | N |
| Reporting level | Visibility | Branch / consolidated | **Both branch + HO consolidation** | Governance need | Perf | Reports | High | Y |
| MSCS consolidation | Multi-state | None / state+branch | **State+branch consolidation** | MSCS Act | Complexity | Multi-branch | High | Y |

## 20. Mobile
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Mobile scope | Field use | None / field roles | **Field roles (collection, milk, member self-service)** | Rural field capture | Scope creep | Core APIs | Medium | Y |
| Capability approach | Reach | Web-only / mobile capability | **Mobile capability for field capture** | Field reality | Effort | Offline | Medium | Y |
| Mobile data integrity | Correctness | Relaxed / same-as-core | **Same validation + rollback as core** | No divergence | Complexity | Data integrity | High | Y |
| Member self-service | Engagement | None / read+requests | **Read + limited requests** | Engagement | Support load | RBAC | Medium | Y |

## 21. Offline
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Offline capability | Market gap | Online-only / offline-first | **Offline-first for field capture** | Connectivity gap (differentiator) | Sync complexity | Sync model | High | Y |
| Sync/conflict model | Integrity | Last-write / integrity-safe | **Integrity-safe sync, no silent divergence** | Prevents data loss | Hard to retrofit | Data integrity | Critical | N |
| Offline scope | Risk control | All / limited | **Collection/receipt entry only initially** | Contain risk | Under-serving | Modules | Medium | Y |
| Offline data-loss prevention | Trust | Best-effort / guaranteed | **Local queue + guaranteed sync/rollback** | The #1 user fear | Complexity | Sync | Critical | N |

## 22. AI
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| AI posture | Focus | Build now / readiness | **AI-readiness only (data foundation)** | Data must be clean first | Premature complexity | Data quality | Medium | Y |
| Priority use-cases | Value | Broad / targeted | **Anomaly/fraud, NPA/credit scoring (later)** | Highest-value defects | Distraction | Data | Medium | Y |
| Data foundation | Enabler | Ad hoc / event stream | **Clean master/txn + event stream** | Prerequisite | Effort | Architecture | Medium | Y |
| AI privacy/governance | Trust/legal | None / governed | **Consent + data-minimization** | Member data sensitivity | Compliance | Security | High | Y |

## 23. Integrations
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Integration boundaries | Coupling | Direct / adapters | **Versioned adapters via gateway** | Format churn isolation | Overhead | Security | High | Y |
| NABARD/NLDR linkage | PACS statutory | None / NLDR flow | **Support NLDR data flow for PACS** | Refinance/reporting | External dependency | Integration | Medium | Y |
| Payment gateway/UPI | Payments | None / pluggable | **Pluggable gateway** | Digital payments | Security | Integration | Medium | Y |
| Failure handling | Reliability | Naive / resilient | **Retry/circuit-breaker, no data loss** | External flakiness | Complexity | Integration | High | Y |

## 24. Notifications
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Channel abstraction | Flexibility | Hard-coded / provider-agnostic | **Provider-agnostic (SMS/email/app)** | Swap providers | Effort | — | Medium | Y |
| Event catalog | Coverage | Ad hoc / defined set | **Defined event set** | Consistency | Missing events | Workflow | Medium | Y |
| Compliance alerts | Timeliness | None / calendar-driven | **Compliance-calendar-driven** | Prevents penalties | Alert fatigue | Compliance | High | Y |
| Cost/rate control | Cost | Unlimited / throttled | **Throttling + preferences** | Cost/spam | Under-notify | Notifications | Medium | Y |

## 25. Audit
| Decision | Why | Options | Recommended | Reason | Risks | Depends on | Pri | Change? |
|---|---|---|---|---|---|---|---|---|
| Audit-trail scope | Non-repudiation | Partial / all + privileged | **All create/update/delete + privileged actions** | Statutory audit/fraud | Volume | All modules | Critical | N |
| Objection tracking | Rectification | None / register+follow-up | **Objection register + follow-up report** | Statutory rectification | Neglect | Audit | High | Y |
| Trail storage | Tamper resistance | Mutable / append-only | **Append-only (WORM)** | Integrity | Cost | Infra | High | N |
| Auditor access | Independence | Full / read-only time-boxed | **Read-only + time-boxed** | Independence | Access gaps | RBAC | High | Y |

---

**Cross-cutting note:** the **Critical / cannot-change-later** decisions cluster in Accounting Engine, FY-lock, Voucher/COA structure, Control-subsidiary model, Inventory formula, Loan NPA/overdue-interest, Reports formula-consistency, RBAC/segregation, Multi-tenancy, Offline sync integrity, and Audit-trail scope — these are the true "get-it-right-before-code" foundations. Decisions marked **Change? = Y** can be deferred or evolved.

*End of Task 3.6 — stopping here. Enterprise design decisions only; no code, UI, or schema.*

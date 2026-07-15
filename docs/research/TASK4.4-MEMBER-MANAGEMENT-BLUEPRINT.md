# SahakarLekha Product Blueprint 4.4 — Member Management Module

**Scope:** Business blueprint only. No code, SQL, schema, or UI. Based on prior findings. Member management is **universal to all eight cooperative types** — "Types = All" unless a note flags an exception.

**Uniform rules (apply to every topic — stated once):**
- **Approval:** per society **authorization matrix** — most member actions require **committee** approval; expulsion needs general-body/committee resolution.
- **Audit:** every member change logged (who/what/when/before/after/reason), **append-only**.
- **Dependencies:** Society master, Share Capital, Authorization matrix, Document store, Notification engine.
- **Exceptions:** invalid/ineligible actions rejected with reason; blocked items escalate to committee.
- **Deletion:** members are **never deleted** — only made inactive/exited.

## Topic matrix (20)

| Topic | Purpose | Business rules | Trigger | In → Out | Validation |
|---|---|---|---|---|---|
| **1 Member Lifecycle** | Manage member application→exit | States Applicant→Active→Inactive/Suspended→Exited (resign/expel/death); never delete | Application / exit | Application → member record + state | Valid transition; reason on status change |
| **2 Member Categories** | Classify members | Ordinary/nominal/associate + type-specific (farmer, depositor, flat-owner) | Admission | Category → categorized member | Valid category per society type |
| **3 Membership Eligibility** | Gate admission | Age, area of operation, category criteria per bye-laws; one membership/person | Application | Applicant details → eligible/rejected | Eligibility per bye-laws |
| **4 Application Process** | Capture request | Form + entrance/share fee + KYC + nominee | Prospect applies | Application form → pending application | Mandatory fields; fee paid |
| **5 Approval Process** | Authorize admission | Committee approval; allot membership no. + shares | Application submitted | Application → approved member + no. | Committee sanction; eligibility met |
| **6 Member KYC** | Verify identity | ID/address proof; PAN where applicable; Aadhaar/eKYC where legal | Admission / update | KYC docs → verified member | Doc validity & format |
| **7 Status Management** | Track active/inactive/suspended | Status changes logged; affects dividend/voting eligibility | Event / admin action | Status change → updated status | Valid status + reason |
| **8 Share Capital Relationship** | Link member to shares | Member-wise share ledger; min shares on admission; refund on exit | Admission/transfer/exit | Share txn → shareholding | Min shares held; ledger = control |
| **9 Nominee Management** | Succession | **Nominee mandatory**; single/multiple with %; updatable | Admission/update/death | Nominee details → nominee record | Nominee present; %s sum 100 |
| **10 Joint Membership** | Shared membership | Primary + joint holders; operation mode | Joint application | Joint details → joint member | Primary designated *(Housing/credit)* |
| **11 Member Communication** | Notify members | SMS/email/app; AGM notices, dues, dividend | Events | Contact + event → notification | Valid contact; consent |
| **12 Member Documents** | Store member docs | Application, KYC, nominee, certificates; retention | Upload | Documents → linked docs | Required docs present |
| **13 Member Certificates** | Issue membership/share certificate | On admission/transfer; serial; reissue on loss | Admission/transfer | Member/share → certificate | Unique serial |
| **14 Member Transfer** | Transfer membership/shares | To eligible transferee/nominee/heir; premium/fee; committee approval | Transfer request | Transfer form → transferred membership | Transferee eligible; premium ≤ cap *(esp. Housing)* |
| **15 Member Resignation** | Voluntary exit | Application; clear dues; refund shares after lock-in; approval | Resignation | Resignation → exited member + refund | No dues; lock-in met |
| **16 Member Expulsion** | Involuntary removal | Cause (bye-law breach); resolution; notice + hearing | Disciplinary action | Expulsion proposal → expelled member | Due process; resolution passed |
| **17 Member Death Handling** | Process deceased member | Transfer shares to nominee/heir; settle dues; death record | Death intimation | Death cert + nominee → settled/transferred | Death cert; nominee/heir verified |
| **18 Member Reactivation** | Restore inactive member | Eligibility re-check; committee approval; expelled needs readmission | Reactivation request | Request → active member | Eligibility; approval |
| **19 Member History** | Full member timeline | All events (admission/shares/loans/status/transfer/exit) retained | Any member event | Events → history view | Complete chronology |
| **20 Member Audit Trail** | Non-repudiation | Every change logged; append-only | Any change | Change → trail entry | Trail complete for every action |

## Master data
| Mandatory | Optional |
|---|---|
| Member (name, address, occupation, membership no., admission date, category, status); Nominee; Shareholding; KYC identifiers | Joint holders; communication preferences; income/occupation detail; photograph; bank details |

## Documents
| Mandatory | Optional |
|---|---|
| Application form; ID proof; address proof; nominee declaration; share/membership certificate | PAN; photograph; Aadhaar (where legal); joint-holder consent; transfer/resignation/expulsion forms; death certificate |

## Reports
| Category | Reports |
|---|---|
| **Core** | Member Register (Form I); Share Register (Form J) |
| **Operational** | New admissions; exits; pending applications; KYC-pending; member dues |
| **Statutory** | Member register; member list for AGM; nominee register |
| **Management** | Member-growth trend; active/inactive analysis; category-wise distribution; churn |

*End of Blueprint 4.4 — Member Management business blueprint only; no code, SQL, schema, or UI. STOP. (~720 words.)*

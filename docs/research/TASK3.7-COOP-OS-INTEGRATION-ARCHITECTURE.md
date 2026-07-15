# SahakarLekha Research Task 3.7 — Integration Architecture

**Scope:** Business integration architecture only. No code, APIs, schema, or UI. Based on prior findings. **Types:** All = all eight · Trading = PACS/Marketing/Consumer/Dairy/Industrial · Credit = PACS/credit-thrift/MSCS-credit/coop-banks. **Dir** = Import/Export/Both. **Freq** = Real-time/Scheduled/Manual. **M/O** = Mandatory/Optional.

## Integration matrix (20 external systems)

| Integration | Business purpose | Types | Trigger | Data exchanged (Dir) | Freq | M/O | Risks | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|
| **Banks** | Reconciliation & payments | All | Payment / reconciliation | Statements, payment instructions (Both) | Scheduled/Real-time | Mandatory | Format churn, security | Bank statement/API | **Core** |
| **UPI / Payment Gateways** | Digital collections & payments | All (Credit/Consumer/Housing) | Member payment | Payment request/status (Both) | Real-time | Optional | Gateway failure, charges | Gateway, bank | **High** |
| **GST Portal** | Return filing & ITC reconciliation | Trading & taxable | Return due | Invoices, returns, ITC (Both) | Scheduled (monthly) | Mandatory (registered) | Portal downtime, format change | GSTN | **High** |
| **Income Tax / TDS Utilities** | TDS challans & returns | All (deductors) | TDS deposit/return | Challans, 24Q/26Q (Export) | Scheduled | Mandatory | Format change | TRACES/NSDL | **High** |
| **PAN Verification** | Validate member/vendor PAN | All | Onboarding | PAN → name/status (Both) | Real-time | Optional | API cost/limits | NSDL/UTI/IT | **Medium** |
| **Aadhaar / eKYC** | Member KYC (where legal) | All | Member onboarding | Consent-based verification (Both) | Real-time | Optional (legal-gated) | Legal/privacy compliance | UIDAI/authorized agency | **Future** |
| **SMS Gateway** | Alerts & OTP | All | Events | Messages (Export) | Real-time | Optional (High for alerts) | Delivery, cost, DLT rules | Provider, DLT registration | **High** |
| **WhatsApp Business** | Member communication | All | Events | Messages/docs (Export) | Real-time | Optional | Template approval, cost | BSP | **Medium** |
| **Email Services** | Statements, reports, notices | All | Events/reports | Emails, attachments (Export) | Real-time/Scheduled | Optional | Deliverability | Provider | **Medium** |
| **Document Storage** | Store statutory documents | All | Upload/retention | Documents (Both) | Real-time | Core | Cost, retention compliance | Object storage | **Core** |
| **Digital Signature (DSC)** | Sign returns/reports | All (MSCS/audit) | Filing/approval | Signed documents (Both) | Manual | Optional | Token/legal validity | CA/DSC token | **Medium** |
| **Barcode / QR Code** | Item & member ID, receipts | Trading (+ member cards) | Scan | Codes (Both) | Real-time | Optional | Hardware reliability | Scanner | **Medium** |
| **Biometric Attendance** | Staff attendance / member auth | All w/ staff; PACS | Attendance/auth | Biometric events (Import) | Real-time | Optional | Device, privacy | Device | **Medium** |
| **Weighbridge** | Weight capture | Marketing/PACS/Dairy | Weighing | Weight readings (Import) | Real-time | Optional (High dairy) | Device integration | Weighbridge/analyzer | **Medium** |
| **POS Devices** | Retail billing | Consumer (+ PACS retail) | Sale | Sales txns (Both) | Real-time | Optional | Device, offline | POS hardware | **Medium** |
| **Excel Import / Export** | Bulk data & reports | All | Migration/report | Tabular data (Both) | Manual | Core | Data validation | — | **Core** |
| **Tally Import / Export** | Migrate from/to Tally | All | Migration/interop | Masters, vouchers (Both) | Manual/Scheduled | Optional (High onboarding) | Mapping errors | Tally format | **High** |
| **Government Cooperative Portals** | Statutory reporting (RCS/NABARD-NLDR/CRCS) | All (PACS→NLDR; MSCS→CRCS) | Statutory filing | Returns, financials (Export) | Scheduled | Mandatory (type-dependent) | Portal availability, format | Govt portals | **High** (Core for PACS) |
| **ERP / Accounting Migration** | Onboard from legacy systems | All | Onboarding | Masters, opening balances, history (Import) | Manual (one-time) | Optional (High onboarding) | Data integrity, opening-balance errors | Source data | **High** |
| **AI Services** | Analytics/fraud/scoring | All | Analysis | Anonymized txn/master data (Both) | Scheduled/Real-time | Optional | Privacy, data quality | Clean data, event stream | **Future** |

## Cross-cutting integration principles
- **Adapter pattern via a gateway** — every external system behind a **versioned adapter** to isolate format churn (GST/TDS/bank formats change).
- **Integrity-safe** — inbound data (migration, POS, offline field capture) passes the same validation/rollback as core; **no silent data divergence**; opening-balance import ties to audited closing.
- **Resilience** — retry/circuit-breaker on external calls; failures never lose transactions.
- **Compliance-gated** — Aadhaar/eKYC only where legally permitted; DLT registration for SMS; DSC where statutorily required.

## SPECIAL SECTION — Integration roadmap by version

| Version | Integrations | Rationale |
|---|---|---|
| **V1 — Immediate** | Banks; GST Portal; Income Tax/TDS Utilities; Document Storage; Excel Import/Export; Tally Import/Export; SMS Gateway; ERP/Accounting Migration; Government Cooperative Portals (PACS-NLDR / MSCS-CRCS) | Statutory-mandatory + onboarding-critical (societies must file returns, migrate off Tally/legacy, and store records from day one) |
| **V2 — Near-Term** | UPI/Payment Gateways; PAN Verification; Email; WhatsApp Business; POS Devices; Barcode/QR; Weighbridge; Biometric Attendance | Operational efficiency & member engagement; hardware/field-capture integrations per society type |
| **V3 — Long-Term** | Aadhaar/eKYC (legal-gated); Digital Signature (DSC); AI Services | Legally-gated, advanced, or data-maturity-dependent — deferred until foundation is clean and compliance is cleared |

**Priority logic:** Core/Mandatory (banking, GST, TDS, government portals, document storage, Excel/migration) anchor V1 because a cooperative cannot legally operate or onboard without them. Field-hardware and engagement channels (V2) add efficiency. Identity/signature/AI (V3) carry legal or data-readiness prerequisites and are intentionally last.

*End of Task 3.7 — stopping here. Business integration architecture only; no code, APIs, schema, or UI. (~760 words.)*

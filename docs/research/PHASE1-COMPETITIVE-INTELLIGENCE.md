# SahakarLekha Master Research Program — Phase 1

## Competitive Intelligence & Market Mapping Report

**Prepared:** 2026-07-07
**Scope:** All software, ERP, cloud platforms, portals, desktop software, mobile apps and government systems relevant to cooperative management — India-first, international where relevant.
**Method:** Multi-agent web research (5 parallel search angles → source fetch → claim extraction → 3-vote adversarial verification), supplemented by direct targeted searches. 63 research agents completed; the adversarial-verification stage completed fully for the government/PACS cluster and partially for private-vendor claims (a usage-limit interruption killed 41 verification agents — see §10 Research Limitations).
**Confidence key:** **High** = verified against ≥2 independent primary sources (most survived 3-0 adversarial refutation votes). **Medium** = single primary source (usually the vendor's own site) or reputable secondary source, unverified. **Low / Needs Verification** = directory listings, blogs, forum claims, or single unclaimed profiles.

> This is a research-only deliverable. Per program rules it contains **no feature designs, no implementation suggestions, and no SahakarLekha product recommendations.** Phase 1 stops here.

---

## 1. Executive Summary

**F1. The single biggest structural force in this market is the Government of India itself.** The Centrally Sponsored PACS Computerization Project (approved 29 June 2022; 2022-23 to 2026-27; sunset 31 March 2027) puts all *functional* PACS onto **one common national ERP (NLPS)**, built by a single National Level PACS Software Vendor selected by NABARD. Original outlay ₹2,516 crore for 63,000 PACS; **revised to ₹2,925.39 crore covering 79,630 sanctioned PACS**, with ~63,428 PACS live on the ERP by mid-2026. *(Sources: cooperation.gov.in, NABARD FAQ, PIB PRID 1837890/2080081/2211795, Rajya Sabha USQ 322. Confidence: **High** — every claim in this cluster survived 3-0 adversarial verification.)*

**F2. The NLPSV is a consortium of BECIL + AFC India Ltd + Intellect Informatics**, awarded a single contract of ₹320.18 crore + GST on 11.01.2023 (RFP NB.HO.IDD/570/Pol-06/2022-23), completion 31.03.2027. NABARD is custodian of the software **and all data** (National Level Data Repository), with a **pay-per-use model planned after 2027**. *(Source: nabard.org tender award PDF, scheme guidelines. Confidence: **High**.)*

**F3. The government has set a rock-bottom price anchor for PACS software: ₹72,103 per PACS for a comprehensive ERP** (within a ₹3,91,369 total per-PACS package incl. hardware ₹1,22,158, training ₹10,198, support ₹1,86,910). Any commercial vendor selling into PACS competes against an effectively free, subsidized system. *(Sources: Revised Scheme Guidelines §3.8.3, PIB PRID 2080074. Confidence: **High**.)*

**F4. The private credit-cooperative software segment is crowded, regional, opaque on pricing, and technologically dated.** At least a dozen vendors (Websoftex, Genius Technology, Fin Superb/Cyrus Technoedge, Co-FiM/SNS System, CreditSociety.in/Anush, Finsta, AOPAY, Shinewell, Jayam Solutions, NetQuest/Society-Biz, Oceansoft, MSCS Software Kerala) sell near-identical loan/FD/RD/share/member stacks. Most hide pricing; the few public data points range ₹15,000–₹45,000/year (CreditSociety.in tiers) to ₹90,000–₹1,50,000 base cost (Genius Technology). At least one prominent product (Fin Superb) still runs **ASP.NET 4.0 + MS SQL 2010**. *(Confidence: **Medium** — vendor primary sources; verification votes were rate-limit interrupted.)*

**F5. Housing society management is the most commercially mature cooperative-adjacent segment, and its leaders are moving into accounting.** MyGate (Capterra 4.7/5, 63 reviews) is praised specifically for its accounting module; MyGate/ApnaComplex/NoBrokerHood price at roughly ₹3–15 per flat per month. Repeated complaints: **no offline capability, slow support, intrusive ads, weak navigation, single-role login**. NoBrokerHood shows materially weaker support ratings (3.1/5 support on a small sample). *(Confidence: **Medium** — reputable review platforms, small samples.)*

**F6. Dairy is effectively locked up at the village level by hardware-rooted incumbents.** NDDB's own AMCS runs in 26,000+ village societies (17.3 lakh producers, 54 unions); Prompt (Ahmedabad) claims 46,965 active milk societies and ~2M farmers; Stellapps claims ~3M farmers across 36,000 villages; Akashganga has ~9,200 of ~25,000 installed AMCUs. Their accounting depth is shallow (cash book + collection reports), not full double-entry cooperative ERP. *(Confidence: **Medium** — vendor/institutional primary sources.)*

**F7. Generic accounting incumbents (Tally, Busy, Marg, Zoho) are the de facto standard in thousands of societies but have no native cooperative features.** Documented practice: books in Tally, **member interest calculated manually or in Excel**; cooperative gaps are patched by third-party partner add-ons (e.g., TallyWorld housing-society module). Pricing: TallyPrime Silver ₹22,500 / Gold ₹67,500 one-time + TSS renewal ₹4,500–13,500/yr; Zoho Books free–₹9,999/mo; Busy from ~₹4,999–14k/yr; Marg ~₹5,550–15k/yr. *(Confidence: **Medium-High** for pricing; Medium for the fit-gap evidence.)*

**F8. Whole cooperative categories are essentially unserved by dedicated software**: consumer stores, labour cooperatives, industrial cooperatives, fisheries, weaver/handloom societies, and marketing societies show only one-off ₹5,000–₹35,000 Windows products on IndiaMART-class directories and no credible cloud vendor. FPOs have a young, fragmented tool set (FPOhub+, Samunnati FPO stack, FpoGrow, KhetiBuddy). *(Confidence: **Medium** — absence-of-evidence finding across multiple searches.)*

**F9. User-research coverage of this market is extraordinarily thin.** Credit-cooperative products routinely have **zero reviews** on Capterra/GetApp/SoftwareSuggest; several vendor profiles are unclaimed. The loudest documented pain points in adjacent segments: internet-dependency/no offline mode, poor support, opaque pricing, and (for the government ERP) a workforce problem — **the majority of PACS secretaries are 50+ and lack ERP skills**, with only 26,882 trained by Dec 2024 against ~68k sanctioned societies. *(Confidence: **Medium**; PACS training figures **High** — Lok Sabha reply 03.12.2024.)*

**F10. No player found in this research positions as a full-spectrum "Cooperative Operating System" across cooperative types.** Every mapped competitor is either segment-locked (credit, dairy, housing, PACS, FPO), a horizontal accounting tool with no cooperative constructs, or an enterprise CBS priced for banks. The closest breadth claim is MSCS Software (Ernakulam), which lists "29+ cooperative types" but discloses no pricing, customers, or deployment evidence. *(Confidence: **Medium** — bounded by search coverage; see §10.)*

---

## 2. Market Map

### 2.1 Segments × Players

| Segment | Government / institutional | Dedicated private vendors | Generic tools actually used |
|---|---|---|---|
| **PACS (agri credit)** | **NLPS common ERP** (NABARD/MoC; BECIL+AFC+Intellect consortium); state legacy systems (e.g., Telangana/Vedavaag, Kerala's own path) | VSoft "Roots", Websoftex, Jayam Solutions | Tally + Excel; paper |
| **Credit cooperatives / thrift / Nidhi / multi-state credit** | ARDB computerization project (1,851 units, 13 states) | Websoftex, Genius Technology, Fin Superb (Cyrus Technoedge), Co-FiM (SNS System), CreditSociety.in (Anush), Finsta, AOPAY, Shinewell, NetQuest Society-Biz, Oceansoft, Jayam, MSCS Software (Kerala) | Tally, Busy, Excel |
| **Cooperative banks (UCB/DCCB/StCB)** | RBI-regulated CBS mandates | Virmati iCBS, VSoft Wings, TrustBankCBS, Intellect, Infosys Finacle & TCS BaNCS (large banks) | — |
| **Dairy (VDCS → union → federation)** | **NDDB AMCS** (26,000+ DCS) | Prompt AMCS, Stellapps smartAMCU/SmartMoo, Akashganga (IDMC), Ekomilk (analyzers, via MK Enterprises) | Manual registers + union systems |
| **Housing societies / RWA** | — | MyGate, ApnaComplex (ANAROCK), NoBrokerHood, ADDA, SocietyRun, Society123, TallyWorld society add-on | Tally, Excel |
| **Marketing cooperatives** | State federations' bespoke systems | *None found dedicated* | Tally, Excel |
| **Consumer stores** | State federations (bespoke) | One-off Windows products (e.g., Esjay IT, Rajkot — ₹35,000) | Tally, Marg, POS software |
| **Labour / industrial cooperatives** | — | *None found dedicated* | Tally, Excel |
| **FPO** | NABARD-promoted tools | FPOhub+, Samunnati FPO solutions, FpoGrow, KhetiBuddy | Excel, WhatsApp |
| **Multi-State Cooperative Societies (MSCS Act 2002)** | Central Registrar portal | MSCS Software (Ernakulam), Fin Superb, Genius (multi-state modules) | — |
| **Generic accounting** | — | — | TallyPrime, Busy, Marg ERP, Zoho Books, Saral (Relyon) |
| **Generic ERP** | — | — | ERPNext, Odoo, SAP, Oracle NetSuite (no cooperative-primary evidence found) |
| **International reference points** | — | Credit-union cores: FIS Profile, Temenos, Fiserv-class "top 20 cores"; TrustBankCBS (SACCOs, East Africa/diaspora); Velera | — |

*(Composition confidence: **Medium** — assembled from verified PACS cluster + vendor primaries + directory sweeps. "None found" cells are absence-of-evidence, not proof of absence.)*

### 2.2 Structural reading of the map

1. **Vertical fortresses:** dairy (hardware+software incumbents), PACS (state monopoly ERP), cooperative banks (regulated CBS). High entry walls documented.
2. **Contested commons:** credit societies and housing societies — many vendors, weak differentiation, opaque pricing, thin reviews.
3. **Empty quarters:** marketing, consumer, labour, industrial, fisheries cooperatives; multi-cooperative-type platforms.
4. **The horizontal default:** Tally's ecosystem is the real incumbent almost everywhere, with cooperative logic living outside the software (Excel/manual).

---

## 3. Competitor Profiles

Format: each profile lists what the evidence supports; unpopulated fields were not disclosed by any found source.

### 3.1 Government & institutional systems

#### NLPS / PACS Common ERP (the "national baseline")
- **Owner:** Ministry of Cooperation (sponsor), NABARD (implementing agency & custodian of software and data, on behalf of GoI).
- **Builder:** NLPSV consortium — **BECIL + AFC India Ltd + Intellect Informatics** — single contract ₹320.18 Cr + GST, awarded 11.01.2023, completion 31.03.2027. **(High)**
- **Scale:** 79,630 PACS sanctioned across 30–31 states/UTs (original target 63,000); ~63,428 live on ERP (mid-2026); hardware to ~89% of target; 42,700+ online audits conducted. **(High)**
- **Functional scope (per guidelines):** membership, deposits, ST/MT/LT lending, procurement, processing units, PDS, business planning, warehousing, merchandising, borrowings, asset management, HR, RuPay/KCC integration, Common Accounting System (CAS), MIS, **offline mode with later data upload**, cybersecurity + data storage. Specified scope, not independently verified shipped maturity. **(High for the spec; deployed maturity Needs Verification)**
- **Commercial model:** free to PACS during project (per-PACS ERP cost to the scheme ₹72,103); **pay-per-use planned post-2027** (NABARD to finalize with StCBs/state govts). Pre-computerized PACS get only ₹50,000 reimbursement and must integrate with NLPS. **(High)**
- **Documented weaknesses:** secretary workforce 50+/low ERP skills; only 26,882 officials trained by Dec 2024; no funding for outsourced staff; per-state customization channeled through System Integrators; 27,203 PACS not yet onboarded as of 21.11.2024. **(High — Lok Sabha reply 03.12.2024, NABARD best-practices doc)**
- **Positioning:** not a market player but a **state-sponsored standard** — simultaneously the largest "competitor" (for PACS wallets) and the largest proof that cooperatives will adopt cloud ERP.

#### NDDB AMCS (dairy)
- Government-promoted institution's own product. 26,000+ village dairy cooperative societies, 12 states, 17.3 lakh milk producers, 54 milk unions (site also states "25+ milk unions" — internal inconsistency, **Needs Verification**). Android app = farmer digital passbook + staff alerts. Multi-tier (DCS/Union/Federation/National). No public pricing/tech stack. Portal: amcs.coop. **(Medium — institutional primary)**

#### ARDB computerization & RCS office computerization
- Parallel central projects: 1,851 ARDB units across 13 states (NABARD implementing), plus computerization of Registrars of Cooperative Societies. Signals government intent to digitize the *entire* cooperative credit structure top-down. **(High — PIB)**

### 3.2 Private credit-cooperative software vendors

#### Websoftex Software Solutions (Bangalore)
- Operating since ≥2012. Web + Windows deployment. Modules: SB/DD/RD/FD/MIS/loans "per Nidhi Rules"; deposit instruments incl. pigmy/daily, cash certificates, thrift; loans incl. surety, crop, vehicle, gold. Hierarchy: Company > HO > Branch > CSP > Customer. Customer-facing net-banking-style panel + agent/customer mobile apps. Pricing undisclosed. **(Medium — vendor primary; verification interrupted)**

#### Genius Technology (Kolkata)
- Dedicated multi-state credit cooperative software; desktop + web + Android; member/loan/savings/share management with **dividend generation**; double-entry accounting with Trial Balance/P&L/Balance Sheet; biometric (thumb) verification, QR/barcode, bulk SMS. **Base cost ₹90,000–₹1,50,000** (cited from vendor pages). Site copyright 2017 → possibly stale content. **(Medium; pricing Needs Verification)**

#### Fin Superb — Cyrus Technoedge (Jaipur)
- 6+ years in credit-coop software. Targets credit co-ops, Nidhi/NBFC, housing credit co-ops, agro credit, microfinance, employee credit societies. Web-based; **ASP.NET 4.0 + MS SQL 2010** (outdated stack); Android app "on demand" + free agent app. Features: loans (processing/EMI/pre-closure), RD/FD/MIS/DD/MIP, KYC, journal/trial balance/P&L, agent commission hierarchy, SMS/email, document vault, multi-branch multi-state RBAC. No public pricing/customer counts. **(Medium — vendor primary)**

#### Co-FiM — SNS System (Indore/Gwalior, MP)
- Web-based cloud; "auto posting" to day book/ledger/balance sheet; audit reports (JReports); automated interest; dashboards; date-lock; double password; POS device + thermal printer integration; RTGS/NEFT; Android+iOS customer and agent apps; claims "AI to simplify accounting operations" (marketing claim, **Needs Verification**). Targets credit co-ops + Nidhi, rural/suburban focus. Pricing "policy-based packages" (opaque). **(Medium — vendor primary)**

#### CreditSociety.in — Anush Technology
- **Rare public pricing:** Basic ₹1,500/mo (₹15,000/yr, ≤2,000 members, 1 branch) / Standard ₹2,500/mo (₹25,000/yr, ≤5,000 members, multi-branch, RBAC, Excel/PDF export, backup) / Premium ₹4,500/mo (₹45,000/yr, unlimited members, member self-service portal, digital payments, Android app, dedicated manager). Cloud, claimed 99.9% uptime. Notable: mobile app & member portal **gated to top tier**. **(Medium-High — published price page)**

#### Finsta
- All-in-one ERP positioning for credit co-ops (loans, members, accounting, compliance, reports). Discovered via directory sweep; depth unknown. **(Low — Needs Verification)**

#### AOPAY
- Cloud + Android + iOS; member onboarding, deposits, loan lifecycle, **dividend distribution**, banking/payment-gateway integrations, audit trails, regulatory reporting. **Zero reviews** on GetApp; no pricing. **(Low-Medium — directory + vendor)**

#### Shinewell Innovation Softech
- Credit-coop product (members, loans, savings/FD/RD, shares, accounting); unclaimed SoftwareSuggest profile, zero reviews, email-only support listed. **(Low — Needs Verification)**

#### MSCS Software (Ernakulam, Kerala)
- Positions as "India's leading software for Multi-State Cooperative Societies," since 2004. Claims support for **29+ cooperative types** (credit, agri, UCB, dairy federation, housing, fisheries, organic). Modules: membership, FD/RD, gold/term/deposit loans, collection-agent app, maker-checker, analytics, inventory, "core banking, online banking, doorstep services." No pricing, no customer counts, no MSCS-Act compliance specifics on page. **(Low-Medium — vendor primary, unverified)**

#### Others observed (directory tier)
Jayam Solutions (Hyderabad), NetQuest Society-Biz, Oceansoft, Microdot (₹5,000 entry), Camwel, Space Softech, Esjay IT (consumer co-op, ₹35,000 Windows). Collectively confirm a long tail of low-cost, low-cloud, regionally sold products. **(Low)**

### 3.3 Cooperative bank CBS vendors

#### Virmati (Ahmedabad) — iCBS
- 25+ years; ISO 9001/27001, CMM L3. Targets UCBs, district banks, RRBs, credit societies. Full CBS: maker-checker, multi-currency, KYC/AML, NPA management, sweep accounts, bulk account opening; channels: ATM/SMS/internet/mobile/phone/kiosk. Stack: browser clients over **MS SQL 2017–2022 / Oracle 12c–19c / PostgreSQL**, centralized day-end/day-begin — traditional CBS, not cloud-native SaaS. No public pricing/customer counts. **(Medium)**

#### VSoft Technologies — Wings CBS & "Roots" for PACS
- Wings: full CBS for banks of all sizes. **Roots: PACS-specific**, centralized, cloud-hostable at district/state/national level — directly mirrors the NLPS model; automates agri-loan cycles (credit limit, withdrawal, repayment). Adjacent payments product (Bolt switch, 230k+ NFS ATMs). No pricing/traction data. **(Medium)**

#### TrustBankCBS
- CBS for SACCOs, credit unions, employee credit societies, diaspora credit societies — an international (incl. Africa) cooperative-credit reference point. **(Low-Medium)**

### 3.4 Dairy segment

#### Prompt (Ahmedabad) — Prompt AMCS
- 20+ years; hardware-rooted (weighing scales, Fat/SNF analyzers, kiosks) + cloud portal + Android apps (Farmer/VDCS/MU). Claims **46,965 active milk societies, 2.01M active farmers, 2.6 crore L/day, 6.15 lakh app users**; "connecting 3.6M farmers of Gujarat." Accounting depth shallow: cash book + collection reports. No public pricing. **(Medium — vendor primary; scale claims Needs Verification)**

#### Stellapps (Bangalore, 2011, IIT-M incubated)
- IoT dairy stack (smartAMCU, smartCC, mooPay farmer payments, SmartMoo platform). ~3M farmers, 36,000 villages, ~10–13.5M L/day digitized; customers include major private and cooperative dairies. VC-funded (CNN/press coverage). **(Medium — press + vendor)**

#### Akashganga (IDMC ecosystem)
- ~9,200 of ~25,000 AMCUs installed in India. DCS-level milk collection automation. **(Medium — third-party innovation profile)**

#### Ekomilk (via MK Enterprises)
- Milk analyzers (hardware), not a management platform — relevant only as integration periphery. **(Medium)**

### 3.5 Housing society platforms

#### MyGate (Bangalore)
- Capterra 4.7/5 (63 reviews; ease-of-use 4.8, support 4.4); SoftwareSuggest 4.9 (66 reviews). Strengths: visitor management; **accounting module praised** ("streamlined collections, expense tracking, reporting"). Complaints: **no offline capability** ("functionality significantly hampered if there is an internet outage"), slow support ("feedback actioned very late"), **in-app ads** ("distracting", "annoying"), navigation ("Breadcrumb just made useless"), no multi-role single login. Pricing on request; market range ₹3–15/flat/month. **(Medium — review platforms)**

#### NoBrokerHood
- SoftwareSuggest 3.6/5 (9 reviews; support 3.1). Differentiators: visitor/delivery/staff management, guard patrol. Complaints: complaint-management lacks escalation & auto-assignment; non-functional IVR; hidden pricing. **(Medium — small sample)**

#### ApnaComplex (ANAROCK)
- Pricing from ~₹8/flat/month (one listing cites ~$40/user/month — inconsistent, **Needs Verification**). Positioned for 200–1,000-flat societies alongside ADDA for feature depth. **(Low-Medium)**

#### ADDA, SocietyRun, Society123
- ADDA: cited as feature-deep for larger societies. SocietyRun: accounting + billing + communication; one source cites "~₹25,000/community/month" (implausibly high vs market ₹3–15/flat — **Needs Verification**). Society123: communication-first society management. **(Low)**

#### TallyWorld housing-society add-on (Technowin, Mumbai)
- Partner-built Tally Prime add-on: society billing, share certificates, nominations, share register, dues, maintenance registers, multi-society management. Evidence that the Tally channel patches cooperative gaps rather than Tally shipping them natively. No pricing. **(Medium)**

### 3.6 Generic accounting incumbents

| Product | Pricing (found) | Cooperative fit evidence |
|---|---|---|
| **TallyPrime** | Silver ₹22,500 / Gold ₹67,500 one-time (+18% GST); TSS renewal ₹4,500/₹13,500/yr; rental from ₹750/mo | De facto standard; societies keep books in Tally, **interest computed manually/Excel** (Gujarat co-op accounting practice blog); gaps filled by partner add-ons. No member/share/dividend constructs natively. **(Medium)** |
| **Busy** | From ~₹4,999/yr (Express free tier); listings cite ~$160/yr; "contact sales" opacity | Small traders/distributors focus; no cooperative features found. **(Low-Medium)** |
| **Marg ERP** | ~₹5,550–15,000/yr | Pharma/FMCG focus; no cooperative features found. **(Low-Medium)** |
| **Zoho Books** | Free (<₹25L turnover) → ₹899/₹1,499/₹2,999/₹5,999/₹9,999 per month (+GST) | Closest horizontal-cloud move toward societies: nonprofit positioning + **15% discount for registered charities/trusts/societies**; no member ledger/share capital/dividend features. **(Medium)** |
| **Saral (Relyon, Bangalore, since 2000)** | Saral Accounts ₹12,000 single / ₹25,000 multi-user; GST/Billing SKUs ₹7,620–₹20,000 | Compliance suite (TDS/GST/payroll) used by CAs serving societies; no cooperative-native features found. **(Medium)** |

### 3.7 Generic ERP

- **ERPNext / Odoo:** strong India localization ecosystems; **no cooperative-society implementation case studies surfaced** in searches. TCO guides position ERPNext (no per-user license, self-host, IT-led orgs), Odoo (modular), Zoho (fastest GST compliance). Cooperative fit must be custom-built. **(Medium for positioning; cooperative absence Needs Verification)**
- **SAP / Oracle NetSuite:** no evidence found of primary-society deployments; relevant only at federation/apex tier (e.g., GCMMF/Amul manages 3.6M producers across 13 unions — its internal IT stack was **not identified** in this research; **Needs Verification**). **(Low)**

### 3.8 FPO platforms

- **FPOhub+**: FPO-exclusive ERP — members, production & business planning, inventory, manufacturing/logistics, HR, e-commerce, accounting; claims availability "in all Indian languages." **(Low-Medium — vendor)**
- **Samunnati** (NBFC since 2014): FPO tech for members, output purchase, demand aggregation + finance + market linkage — a finance-led platform play. **(Medium)**
- **FpoGrow**: inventory, production tracking, sales, procurement, financial management. **(Low)**
- **KhetiBuddy**: farmer-member record digitization, member-board communication. **(Low)**

### 3.9 UNITE ERP (clarification)
The name "UNITE ERP" resolves to two distinct things: (a) **Unite India** — a school ERP/LMS (700+ schools; not cooperative); (b) **uniteerp.in "ERP for Agriculture Cooperatives"** — live login portals for Andhra Pradesh districts (13 districts listed) and a Maharashtra instance (mh.uniteerp.in). The agri-coop product's vendor, modules, and commercial model are not publicly discoverable — it appears to be a closed state-deployment system. **(Low — Needs Verification; the AP/MH portals confirm existence and state-level deployment only.)**

---

## 4. Feature Comparison Matrix

Legend: ✅ documented · ◐ partial/claimed · ✗ not found · ? unknown. Rows are the program's Step-3 checklist collapsed to discriminating dimensions.

| Capability | NLPS (PACS ERP) | Websoftex | Genius | Fin Superb | Co-FiM | CreditSociety.in | Virmati iCBS | Prompt AMCS | NDDB AMCS | MyGate | Tally Prime | Zoho Books |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Double-entry accounting | ✅ (CAS) | ◐ | ✅ (TB/P&L/BS) | ✅ | ✅ (auto-posting) | ◐ | ✅ | ◐ (cash book) | ◐ | ◐ (society acctg) | ✅ | ✅ |
| Member management | ✅ | ✅ | ✅ | ✅ (KYC) | ✅ | ✅ | ✅ (KYC/AML) | ✅ (farmers) | ✅ | ✅ (residents) | ✗ | ✗ |
| Share capital / dividend | ◐ | ? | ✅ (dividend gen.) | ◐ | ◐ | ◐ | ◐ | ✗ | ✗ | ◐ (share cert. via add-ons) | ✗ | ✗ |
| Loans (EMI, pre-closure) | ✅ (ST/MT/LT) | ✅ (incl. gold/crop) | ✅ | ✅ | ✅ | ✅ | ✅ (NPA mgmt) | ✗ | ✗ | ✗ | ✗ | ✗ |
| FD/RD/pigmy deposits | ✅ | ✅ (incl. pigmy/thrift) | ✅ | ✅ (RD/FD/MIS/DD/MIP) | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Procurement / PDS / warehouse | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ (milk proc.) | ◐ | ✗ | ◐ (inventory) | ◐ |
| Inventory | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ |
| Payroll / HR | ✅ (HR) | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ | ✗ | ✗ | ◐ (staff) | ◐ | ◐ |
| GST/TDS compliance | ◐ | ? | ? | ? | ? | ? | ✅ | ✗ | ✗ | ◐ | ✅ | ✅ (fastest e-invoice) |
| Audit support | ✅ (42,700+ online audits) | ? | ◐ | ◐ | ✅ (audit reports) | ◐ | ✅ | ✗ | ✗ | ◐ | ✅ | ✅ |
| Maker-checker / approvals | ◐ | ◐ | ◐ | ◐ (RBAC) | ✅ (date-lock) | ◐ (RBAC tier-gated) | ✅ | ✗ | ✗ | ◐ | ✗ | ◐ |
| Mobile app | ◐ | ✅ (agent+customer) | ✅ (Android) | ◐ (on demand) | ✅ (iOS+Android) | ◐ (top tier only) | ✅ (channels) | ✅ (3 apps) | ✅ (passbook) | ✅ | ✗ (partner) | ✅ |
| **Offline capability** | ✅ (offline mode + later upload) | ✗ | ◐ (desktop) | ✗ | ✗ | ✗ | ✗ | ◐ (kiosk/edge) | ◐ | **✗ (top complaint)** | ✅ (desktop) | ✗ |
| API / integrations | ◐ (RuPay/KCC) | ◐ (RTGS/NEFT) | ✗ | ◐ (SMS/email) | ◐ (POS/RTGS) | ◐ (payments, top tier) | ✅ (switch/ATM) | ◐ | ✗ | ◐ | ◐ | ✅ |
| AI features | ✗ | ✗ | ✗ | ✗ | ◐ (claimed, unverified) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ |
| Hindi / regional language UI | ◐ (state customization) | ? | ? | ? | ? | ? | ? | ◐ | ◐ | ◐ | ◐ | ✗ |

*(Matrix confidence: Medium overall — most cells rest on vendor primaries; treat as directional, not certified. "?" cells were simply not documented anywhere found.)*

---

## 5. Pricing Comparison

| Product / tier | Price point | Model | Confidence |
|---|---|---|---|
| **NLPS (PACS)** | ₹72,103/PACS (scheme cost; free to PACS); pay-per-use planned post-2027 | Subsidy → utility | **High** |
| CreditSociety.in Basic/Standard/Premium | ₹15,000 / ₹25,000 / ₹45,000 per year | SaaS, member-count gated | Medium-High |
| Genius Technology | ₹90,000–₹1,50,000 base | License + customization | Medium (NV) |
| Websoftex, Fin Superb, Co-FiM, AOPAY, Shinewell, MSCS Software, Virmati, VSoft, Prompt, NDDB | **Undisclosed** — quote-only | Opaque | High (that it's opaque) |
| MyGate / ApnaComplex / NoBrokerHood | ~₹3–15 per flat per month; ApnaComplex from ~₹8/flat/mo | SaaS per-unit | Medium |
| SocietyRun | "~₹25,000/community/month" (one listing) | — | **Low / Needs Verification** |
| TallyPrime | ₹22,500 Silver / ₹67,500 Gold one-time (+GST); TSS ₹4,500–13,500/yr; rental ₹750/mo | Perpetual + service subscription | Medium-High |
| Busy | from ~₹4,999/yr; free Express tier | Hybrid | Medium |
| Marg ERP | ~₹5,550–15,000/yr | Subscription | Medium |
| Zoho Books | Free → ₹899–₹9,999/mo (+GST); 15% society/charity discount | SaaS tiers | Medium-High |
| Saral Accounts | ₹12,000 single / ₹25,000 multi-user | License | Medium |
| GetApp credit-coop category floor | from ~$350/year | — | Low |

**Pricing pattern findings:**
1. **Opacity is the segment norm** in credit-coop and CBS software — quote-only pricing dominates; buyers on Quora complain about custom-quote opacity. *(Medium)*
2. The **₹15k–45k/year band** appears to be the visible market-clearing range for small credit societies.
3. Housing has converged on **per-flat-per-month** SaaS pricing — the only segment with a modern, transparent unit-economics norm.
4. The government has anchored PACS at **~free**, with a post-2027 pay-per-use unknown.

---

## 6. Technology Comparison

| Player | Stack (as documented) | Reading |
|---|---|---|
| NLPS | Centralized national ERP + NLDR data repository; VPN + biometric endpoints; offline-capable client | Purpose-built, state-controlled; custodianship = data lock-in **(High)** |
| Fin Superb | **ASP.NET 4.0, MS SQL 2010**, web | A decade+ behind current stacks **(Medium)** |
| Virmati iCBS | Browser clients; MS SQL 2017–2022 / Oracle / PostgreSQL; centralized day-end batch | Traditional CBS, not cloud-native **(Medium)** |
| Genius | Desktop + web + Android; site content c.2017 | Legacy-leaning **(Medium)** |
| Websoftex | Web + Windows GUI hybrid | Transitional **(Medium)** |
| Co-FiM | Cloud web app; POS/thermal-printer integrations | Mid-modern **(Medium)** |
| CreditSociety.in | Cloud, 99.9% uptime claim | SaaS-normal **(Medium)** |
| Prompt / Stellapps | IoT + edge hardware + cloud + Android fleet | Hardware-moat architectures **(Medium)** |
| MyGate / NoBrokerHood / ApnaComplex | Cloud-native consumer-grade apps; **no offline mode** | Modern but connectivity-fragile **(Medium)** |
| Tally / Busy / Marg / Saral | Desktop-first, LAN licensing; cloud bolt-ons | Entrenched desktop estate **(Medium-High)** |
| Zoho / ERPNext / Odoo | Cloud-native / open-source | Modern, but zero cooperative domain layer found **(Medium)** |

**Technology findings:** the cooperative-specific tier is dominated by pre-cloud or transitional architectures; cloud-native + offline-tolerant + mobile-first exists **nowhere together** in the cooperative-specific tier documented here — the government ERP is the only found system that explicitly specifies offline mode with sync. *(Medium)*

---

## 7. User Pain Analysis

Evidence base is thin by industry standards (see §10); documented signals:

| Pain | Evidence | Segment | Confidence |
|---|---|---|---|
| **Internet dependency / no offline** | MyGate Capterra: "functionality significantly hampered if there is an internet outage" | Housing (and by architecture, most cloud coop tools) | Medium |
| **Support quality** | MyGate "feedback actioned very late"; NoBrokerHood support 3.1/5, "non-functional IVR", "unheard grievances" | Housing | Medium |
| **Ads/monetization intrusion** | MyGate in-app ads "distracting", "annoying" | Housing | Medium |
| **UI/navigation complexity** | "Navigation is worst. Breadcrumb just made useless"; no multi-role login | Housing | Medium |
| **Workflow automation gaps** | NoBrokerHood complaints: no escalation, no auto-assignment in ticketing | Housing | Medium |
| **Manual interest/dividend work outside the books** | Gujarat co-op practice: Tally books + Excel/manual interest | Credit/housing societies on generic tools | Medium |
| **Multiple disconnected data sets** | Same source: societies run several platforms in parallel | All | Medium |
| **Opaque pricing → distrust** | Quora threads on credit-coop software cost; near-universal quote-only pricing | Credit co-ops | Medium |
| **Elderly, untrained operators** | NABARD: majority of PACS secretaries 50+, lack ERP skills; 26,882 trained vs ~68k societies; no outsourced-staff funding | PACS | **High** |
| **Migration/legacy-data burden** | Scheme requires SIs specifically to digitize legacy PACS data — a project-scale acknowledgment of migration pain | PACS | High |
| **Review deserts** | AOPAY/Shinewell: zero reviews; unclaimed profiles; category mapped against irrelevant international products | Credit co-ops | Medium |
| **Statutory compliance workload** | TDS by 7th monthly (18% p.a. delay interest), ITR Oct 31 (audited)/Jul 31, statutory reserve %, mandatory cooperative audit, dual MSCS/state law regimes | All Indian co-ops | Medium |

---

## 8. SWOT Analysis

### 8.1 NLPS / government PACS ERP
- **S:** free; national mandate; full functional spec incl. offline; NABARD refinance linkage; 63k+ live societies; online audit rail.
- **W:** one-size-fits-all with SI-mediated customization; aging untrained operators; deployment maturity unverified per state; single-vendor consortium dependency.
- **O (for it):** post-2027 pay-per-use platform; NLDR as national data asset; extension to ARDB/RCS.
- **T (to it):** sunset-date execution risk; training gap; state politics (Kerala/Telangana parallel paths).

### 8.2 Private credit-coop vendors (Websoftex / Genius / Fin Superb / Co-FiM class)
- **S:** deep domain fit (FD/RD/pigmy/shares/dividend); regional sales & support relationships; multi-state modules; low price points vs CBS.
- **W:** dated stacks (ASP.NET 4.0/SQL 2010; 2017-era sites); opaque pricing; near-zero review presence; shallow compliance/GST documentation; desktop legacies.
- **O:** Nidhi/multi-state growth; displaced state PACS software; upsell mobile/portals.
- **T:** government ERP scope creep beyond PACS; modern SaaS entrants; RBI/MSCS regulatory tightening.

### 8.3 CBS vendors (Virmati / VSoft / TrustBankCBS)
- **S:** regulatory-grade depth (KYC/AML/NPA/maker-checker); bank references; channel integrations (ATM/switch).
- **W:** heavy, bank-priced, not cloud-native; overkill for primary societies.
- **O:** UCB modernization; PACS-adjacent products (Roots).
- **T:** cloud-native CBS entrants; consolidation of UCBs.

### 8.4 Dairy incumbents (NDDB AMCS / Prompt / Stellapps / Akashganga)
- **S:** hardware+software moat; federation relationships; massive deployed bases; farmer payment rails.
- **W:** shallow accounting (cash book level); hardware capex model; society-tier UX secondary to union needs.
- **O:** full-stack dairy fintech (mooPay-style).
- **T:** commoditization of AMCU hardware; union-level platform standardization (NDDB).

### 8.5 Housing platforms (MyGate / NoBrokerHood / ApnaComplex / ADDA)
- **S:** consumer-grade UX; per-flat SaaS economics; network effects (guards/residents/vendors); accounting modules maturing.
- **W:** no offline; support complaints; ads; RWA ≠ registered-cooperative compliance depth (share certificates, statutory audit) is add-on grade.
- **O:** upmarket into registered housing cooperatives' statutory needs.
- **T:** price war (₹3/flat entrants); committee churn; data-privacy scrutiny.

### 8.6 Generic incumbents (Tally / Busy / Marg / Zoho)
- **S:** ubiquity, CA-channel distribution, GST/compliance trust, price familiarity.
- **W:** zero cooperative constructs (members/shares/dividends/interest); desktop legacy (Tally/Busy/Marg); partner add-on dependence.
- **O:** cloud transitions (TallyPrime rental, Zoho tiers); society discounts (Zoho 15%).
- **T:** vertical SaaS unbundling their society users.

### 8.7 Combined industry SWOT (the cooperative-software market as a whole)
- **Strengths:** enormous installed need (8 lakh+ cooperatives in the National Cooperative Database; ~13 crore farmers linked to PACS); proven willingness to digitize when subsidized; per-segment domain knowledge exists.
- **Weaknesses:** fragmentation by segment and state; pre-cloud technology base; pricing opacity; near-absent user-research/review culture; training/skills deficit at society level; compliance complexity (dual state/MSCS regimes) unevenly handled.
- **Opportunities:** government-created digital literacy wave (PACS project as market-priming); Model Bye-Laws enabling 25+ business activities per PACS (40,214 PACS already run CSC services; 36,180 as PM Kisan Samridhi Kendras) — societies are becoming multi-business entities their current software doesn't model; post-2027 pay-per-use inflection.
- **Threats:** state software monopoly expanding segment by segment; free-government-ERP price anchoring; consolidation among housing SaaS players; regulatory shocks.

*(§8 confidence: analysis grounded in the cited evidence; the synthesis itself is analyst judgment.)*

---

## 9. Opportunity Matrix

Per program rules: **gaps identified only — no solutions proposed.**

| # | Opportunity (gap) | Evidence anchor | Confidence |
|---|---|---|---|
| G1 | **No multi-type "Cooperative OS."** Every found player is segment-locked or horizontal; only an unverified Kerala vendor even claims breadth (29+ types). | §3 profiles | Medium |
| G2 | **Consumer, labour, industrial, marketing, fisheries cooperatives are software deserts** — only one-off ₹5k–35k Windows products found. | §2.1, §3.2 tail | Medium |
| G3 | **Cooperative-native accounting is missing from every modern cloud product**: share capital as restricted equity, entrance fees, patronage refunds, statutory reserve allocation, member dividend/interest — done in Excel today. | esocieties.in, perfectaccounting.in, Tally add-on ecosystem | Medium |
| G4 | **Offline-tolerant cloud is claimed only by the government ERP.** Top documented complaint against the housing leader is internet dependency. | §6, MyGate reviews | Medium |
| G5 | **Hindi/vernacular-first UX is undocumented across the private tier** — no vendor found publishing Hindi-first product evidence (FPOhub+ language claim excepted, unverified). | §4 language row | Medium (absence-based) |
| G6 | **Pricing transparency is a differentiable norm-break** — only CreditSociety.in and housing SaaS publish prices; buyers complain about quotes. | §5 | Medium-High |
| G7 | **Statutory compliance automation** (cooperative audit formats, statutory reserve %, TDS/GST/ITR calendars, dual MSCS/state regimes, 42,700+ PACS audits now online) is nowhere productized visibly outside the government rail. | §7 compliance row | Medium |
| G8 | **The Tally estate is the largest switchable base** — thousands of societies with books in Tally + member math in Excel; add-on channel proves demand and its limits. | §3.6 | Medium |
| G9 | **Post-2027 PACS pay-per-use transition** creates a priced comparison point and a potential dissatisfaction window (training gap, one-size-fits-all). | §3.1 | High (that it's coming); timing/terms NV |
| G10 | **Societies are becoming multi-business entities** (CSC, PMKSK, PDS, procurement, 25+ activities under Model Bye-Laws) while their software models a single activity. | PIB/Lok Sabha data | High (the trend) |
| G11 | **Review/UX vacuum**: near-zero authentic user sentiment in credit-coop software = a market where trust signals are cheap to own. | §7 review deserts | Medium |
| G12 | **Workflow automation (approvals, escalation, maker-checker) is tier-gated or absent** in the visible SME tier; documented complaint in housing ticketing. | §4, §7 | Medium |
| G13 | **FPO tooling is young and fragmented**, with finance-led (Samunnati) rather than accounting-led plays. | §3.8 | Medium |
| G14 | **Overpriced/legacy CBS squeeze**: societies too big for ₹15k SaaS but unable to afford bank-grade CBS have no documented middle option. | §3.3 vs §3.2 | Medium |

---

## 10. Research Limitations

1. **Verification interruption.** The adversarial-verification stage fully covered the government/PACS cluster (all claims 3-0 confirmed; one vote correctly flagged the ₹2,516 Cr figure as superseded). Verification agents for Fin Superb, Genius, Websoftex, and PACS-status claims were killed by a session usage limit — those profiles rest on **single vendor-primary sources** and are marked Medium at best.
2. **Vendor-source bias.** Most private-vendor facts come from the vendors' own pages (feature lists are marketing claims; e.g., Co-FiM's "AI" claim).
3. **US-indexed search.** The search tool is US-based; Hindi-language sources, regional press, and India-only directories are under-sampled. Play Store review mining (a program Step-4 source) was not directly performed.
4. **Segments with thin sweeps:** sugar cooperatives, fisheries, weaver/handloom societies, urban thrift federations, state-specific PACS legacy vendors (e.g., Vedavaag/Telangana noted only in passing), and the internal IT stacks of apex federations (GCMMF/Amul, IFFCO, KRIBHCO) were **not profiled**.
5. **International coverage is reference-level only** (credit-union cores, TrustBankCBS/SACCOs); no deep international feature/pricing analysis was done.
6. **Numbers drift.** PACS rollout counts vary by date across PIB releases (40,050 live → 50,455 onboarded → 63,428 live; sanctioned 63,000 → 67,930 → 73,492 → 79,630). This report standardizes on the latest verified figures and flags the sequence.
7. **Some third-party price points are single-listing** (SocietyRun ₹25k/community/month; ApnaComplex $40/user/month) and internally inconsistent with market norms — retained but flagged Needs Verification.
8. **Absence findings** (e.g., "no dedicated labour-coop software", "no SAP at primary societies") are bounded by search coverage and cannot be proven.

---

## 11. Questions Requiring Further Investigation

**Government rail**
1. What are the actual post-2027 pay-per-use terms NABARD finalizes, and who bears them (PACS vs DCCB/StCB)?
2. What is per-state NLPS deployment maturity vs the guideline spec (which modules actually work in the field)? Field interviews needed.
3. Will the NLPS scope expand to non-PACS cooperative types (dairy DCS, consumer, labour) — any policy signals?
4. Which states retained parallel software (Kerala, Telangana/Vedavaag) and on what terms did they integrate with NLDR?

**Private vendors**
5. Real customer counts and churn for Websoftex, Genius, Fin Superb, Co-FiM, MSCS Software — none disclose; requires reference-checking, RoC filings, and job-posting analysis.
6. Actual quoted prices in the opaque tier (mystery-shopping the quote process).
7. Is the uniteerp.in agriculture-cooperative ERP a state contract (AP/Maharashtra)? Vendor identity and procurement route unknown.
8. Play Store review mining for the credit-coop and dairy vendor apps (agent/customer apps) — the one untouched Step-4 source likely to hold authentic sentiment.

**Segments**
9. Sugar cooperative software landscape (mills + cane societies) — entirely unmapped here.
10. Apex federation IT stacks (GCMMF/Amul, IFFCO, NAFED, state marketing federations) — SAP/Oracle presence and downstream society touchpoints.
11. Housing: how do *registered cooperative housing societies'* statutory needs (share certificates, transfer premiums, statutory audit formats, deemed conveyance) differ from what RWA-grade apps ship — and who certifies compliance?
12. FPO segment unit economics and whether NABARD/SFAC mandates any specific FPO software.

**Demand side**
13. What do society secretaries/accountants actually pay their CAs annually for the Excel+Tally workflow (the true budget envelope)?
14. Hindi/vernacular UI demand quantification — no vendor publishes it; primary research required.
15. Migration friction specifics: what does legacy-data digitization cost per society outside the subsidized PACS channel?

---

*End of Phase-1 report. Per the program's absolute stop rule, no Phase-2 work, feature design, or implementation planning has been performed.*

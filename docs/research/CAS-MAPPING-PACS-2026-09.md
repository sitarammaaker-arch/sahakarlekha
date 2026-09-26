# NABARD CAS बनाम सहकार लेखा का PACS chart — मिलान रिपोर्ट

**तारीख:** 27-09-2026 · **स्थिति:** सिर्फ रिपोर्ट (कोई code नहीं बदला) · ECR-23 का पहला कदम

## स्रोत (source)

| दस्तावेज़ | जारीकर्ता | कहाँ से |
|---|---|---|
| *Manual on Common Accounting System (CAS) for Primary Agricultural Credit Societies* — अध्याय 2 "Chart of Accounts" (पृ. 2–7), अध्याय 6.3 (ब्याज की entries) | NABARD, Department for Cooperative Revival and Reforms, Head Office Mumbai | UP Cooperative Bank tender, Annexure IV-A — https://www.upcbl.in/tender/annexure_4a.pdf |
| *Hand Book on Management Information System for PACS* | NABARD, वही विभाग | UPCBL, Annexure IV-B — http://www.upcbl.in/tender/annexure_4b.pdf |
| *Common Accounting System — PACS & LAMPS* (वही CAS, राज्य संस्करण; NABARD + GTZ, Revival Package) | Cooperation Dept., Tripura | https://cooperation.tripura.gov.in/sites/default/files/CAS%20for%20PACS%20&%20LAMPS_0.pdf |

CAS खातों के **नाम और समूह** देता है, कोई संख्यात्मक code नहीं। नियम: *"No additional General Ledger Heads of Accounts to be opened other than the ones prescribed."*

ऐप का पक्ष: `PACS_SOCIETY_ACCOUNTS` (`src/lib/storage.ts`) + `migrateAccounts` से अपने-आप जुड़ने वाले `ACCOUNTS_TO_ADD` = **147 खाते** (समूह सहित)।

संकेत: ✓ = है · ~ = है पर नाम/समूह/बँटवारा अलग · ✗ = नहीं है

---

## सार

| CAS समूह | CAS heads | ✓ | ~ | ✗ |
|---|---:|---:|---:|---:|
| Capital | 3 | 2 | 1 | 0 |
| Reserves, Funds & Grants | 13 | 3 | 0 | 10 |
| Deposits | 5 | 2 | 0 | 3 |
| Borrowings from DCCB/SCB | 17 | 1 | 3 | 13 |
| Contra / Branch Adjustment | 2 | 0 | 0 | 2 |
| Other Liabilities | 5 | 1 | 4 | 0 |
| Provisions | 12 | 1 | 1 | 10 |
| Cash & Bank | 4 | 0 | 1 | 3 |
| Investments | 8 | 2 | 3 | 3 |
| Loans & Advances | 12 | 2 | 1 | 9 |
| Closing Stocks | 8 | 0 | 1 | 7 |
| Fixed Assets | 5 | 3 | 1 | 1 |
| Other Assets | 10 | 2 | 4 | 4 |
| P&L — Expenditure | 29 | 13 | 2 | 14 |
| P&L — Income | 6 | 5 | 0 | 1 |
| Trading Account | 31 | 9 | 1 | 21 |
| **कुल** | **170** | **46** | **23** | **101** |

ज़्यादातर ✗ चार जगह हैं: (1) DCCB से अलग-अलग उधार-सीमाएँ, (2) **Provisions** (NPA/Standard assets), (3) Trading के ढुलाई-खर्च व छोटे heads, (4) Reserves के सरकारी फंड (Recapitalisation वगैरह)। रोज़मर्रा के खाते (पूँजी, नकद/बैंक, KCC/MT/LT ऋण, वेतन-प्रशासन खर्च, ब्याज आय, खाद/बीज/कीटनाशक/PDS खरीद) ज़्यादातर मौजूद हैं।

---

## ⚠️ मिलान के दौरान मिली असली गड़बड़ियाँ (CAS से अलग, code की)

**G1 — PACS chart में बिक्री/खरीद/स्टॉक के समूह और खाते ही नहीं हैं।** CMS और Consumer chart में `4100 Trading Income / 4101 Sales`, `5100 Direct Expenses / 5101 Purchase`, `3400 Inventory` हैं; PACS chart में नहीं। फिर भी:
- बिक्री/खरीद का default खाता `'4101'` / `'5101'` है (RULE 4; `DataContext.tsx` ~1168, 1180, 1229, 1309)। जिस PACS item पर अलग sales/purchase खाता न चुना हो, उसकी बिक्री **ऐसे खाते में post होगी जो PACS की सूची में है ही नहीं** — Trial Balance उसे `[Deleted] 4101` नाम की नकली देनदारी बनाकर दिखाता है (`DataContext.tsx` ~4805), और Trading Account में वह बिक्री नहीं दिखती।
- `ACCOUNTS_TO_ADD` PACS में `4104–4108`, `5110–5116`, `3406` जोड़ता है जिनके parent `4100` / `5100` / `3400` **मौजूद नहीं** — ये खाते बिना समूह के लटके रहते हैं।
- कोड पढ़कर मिला है; prod में असर है या नहीं — नीचे की query से पक्का करें।

**G2 — `3110 Accum. Dep. - Vehicle` है, पर PACS में Vehicle (वाहन) का asset खाता नहीं** (CMS में `3104` है)।

**G3 — जमा (deposit) पर दिया ब्याज `5604 Interest on Borrowings` में जाता है** (`postDepositInterest`, सोच-समझकर: "member deposits are borrowings from members")। CAS दोनों अलग रखता है: *Interest on Deposits* और *Interest on Borrowings from DCCB/SCB*। Trial Balance में दोनों का जोड़ सही है, पर CAS रिपोर्ट के लिए अलग करना होगा।

**G4 — Subsidy का तरीका अलग।** ऐप में `4303 Govt Subsidy / NABARD Grant` **आय** है; CAS में *Subsidy meant for Society* **फंड** (Reserves) है और *Subsidy meant for Members* **बाहरी देनदारी**। यह हिसाब का फ़र्क है, सिर्फ नाम का नहीं।

---

## विस्तृत मिलान

### देनदारियाँ (Liabilities)

| CAS head | ऐप | स्थिति |
|---|---|---|
| **Capital** Paid up – Individual | 1102 Individual Share Capital | ✓ |
| Paid up – Government | 1101 Govt Share Capital | ✓ |
| Paid up – Others | 1103 "PACS Share Capital" | ~ (नाम भ्रामक) |
| **Reserves** Reserve Fund | 1201 Statutory Reserve Fund | ✓ |
| Capital Reserve | — | ✗ |
| Agriculture Credit Stabilization Fund | — (1209 Agricultural Dev Fund अलग चीज़) | ✗ |
| Dividend Equalization Fund | — | ✗ |
| Building Fund | 1202 | ✓ |
| Common Good Fund | — (1207 Welfare / 1210 Social Dev मिलते-जुलते) | ✗ |
| Balance in P&L Account | 1208 Net Surplus / (Deficit) | ✓ |
| Subsidy meant for Society | — (4303 आय के रूप में, G4) | ✗ |
| Subsidy meant for Members | — | ✗ |
| Recapitalisation Assistance Fund – GoI | — | ✗ |
| Recapitalisation Assistance Fund – State | — | ✗ |
| Provident Fund | — (2203 EPF Payable अलग) | ✗ |
| Other Grants | — | ✗ |
| *ऐप में अतिरिक्त:* 1203 Education, 1204 Risk, 1205 Bad Debt Fund, 1206 Depreciation Fund, 1211 Dividend Distribution | | + |
| **Deposits** Saving | 2107 Member Savings Deposits (Current Liabilities में) | ✓ |
| Recurring | — | ✗ |
| Fixed | 2108 Fixed Deposits from Members | ✓ |
| Reinvestment | — | ✗ |
| Other | — | ✗ |
| **Borrowings** ST (SAO)/KCC Credit Limit | 2305 KCC / Crop Loan (DCCB) | ✓ |
| MT/LT Agri Loans | 2304 Loan from DCCB/NABARD | ~ |
| MT Conversion · MT/LT Reschedulement · SHG · Non-Farm · Fertilizer CC · Seeds CC · Agri Produce CC · Gold Loan CC · PDS CC · Consumer CC · Other Non-Credit · Loan against Deposits · Borrowings from State Govt | — | ✗ (13) |
| Other Borrowings from DCCB/SCB | 2301 Bank OD | ~ |
| Borrowings from Other Institutions | 2306 SCB / Refinance Loan | ~ |
| **Contra** Bills for Collection | — | ✗ |
| **Branch Adjustment A/c** | — | ✗ |
| **Other Liabilities** Interest Accrued on Deposits | 2208 Interest Payable (एक ही head) | ~ |
| Interest Accrued on Borrowings | 2208 Interest Payable (वही) | ~ |
| Unclaimed Dividend | 2104 Dividend Payable | ~ |
| Sundry Creditors | 2101 | ✓ |
| Other Liabilities | 2102 / 2109 / 2210 | ~ |
| *ऐप में अतिरिक्त:* 2200 Statutory Liabilities (2202 TDS, 2203 EPF, 2204 ESI, 2205 HRDF, 2206 IT, 2207 PT), 2209 Audit Fee Payable, 2103 Salary Payable | | + |
| **Provisions** PF/Gratuity/Bonus/Pension | — (5206 सिर्फ खर्च) | ✗ |
| Standard Assets · NPA Sub-Standard · NPA Doubtful · NPA Loss | — | ✗ (4) |
| **Overdue Interest Reserve** | 2211 (H2-1; पर Current Liabilities समूह में) | ✓ |
| Overdue interest on investments | — | ✗ |
| Outstanding Expenses | 2102 Expenses Payable | ~ |
| Sundry Debtors (credit sales) · Sundry Debtors (others) · Depreciation in Investments · Other Provisions | — | ✗ (4) |

### परिसंपत्तियाँ (Assets)

| CAS head | ऐप | स्थिति |
|---|---|---|
| **Cash & Bank** (CAS: 4 बैंक heads — Current/SB × DCCB/अन्य) | 3301 Cash in Hand, 3302 Bank Accounts (एक head) | ~ / ✗ (3) |
| **Investments** Govt & Trustee Securities | — | ✗ |
| Shares in Other Coop Institutions | 3208 DCCB / SCB Shares | ✓ |
| **TD with SCB/DCCB representing Reserve Fund** | — | ✗ |
| TD with DCCB/SCB (other) · TD with other banks | 3205 FDR (एक head) | ~ |
| NSC / KVP | 3207 | ✓ |
| Staff PF with PF Trust | — | ✗ |
| Other Investments | 3206 Security Deposits | ~ |
| **Loans** ST (SAO)/KCC | 3303 Short-term Loans (KCC) | ✓ |
| MT/LT Agricultural | 3304 Medium-term + 3305 Long-term | ✓ |
| MT Conversion · Reschedulement · Pledge · SHG · Non-Farm · Against Deposit · Consumer Durables · Gold · Other | — | ✗ (9) |
| Loans to Staff | 3315 Advance to Employees | ~ |
| *ऐप में अतिरिक्त:* 3316 Overdue / NPA Loans (CAS में अलग खाता नहीं, वर्गीकरण register से) | | + |
| **Closing Stocks** (8: खाद, बीज, कीटनाशक, PDS, Non-PDS, खरीद-योजना अनाज, Mid-day Meal, अन्य) | 5150 Closing Stock (Trading) + stock module; 3400 समूह नहीं (G1) | ~ / ✗ (7) |
| **Fixed** Land & Buildings incl. Godowns | 3101 + 3102 | ✓ |
| Furniture & Fixtures | 3103 | ✓ |
| Computers & Electrical | 3107 (+3106) | ✓ |
| Vehicles | — (G2) | ✗ |
| Other Fixed Assets | 3106 Office Equipment | ~ |
| **Other Assets** Interest accrued not due — Standard loans | 3313 Member Loan Interest Rec. | ~ |
| Interest accrued not due — NPA loans | — | ✗ |
| **Overdue interest receivable** | — (3313 में ही, अलग नहीं) | ✗ |
| Interest receivable on Investments | — (3312 "on Loans") | ~ |
| TDS | 3307 | ✓ |
| Sundry Debtors — credit sales | — | ✗ |
| Sundry Debtors — others | — | ✗ |
| Deposits with Agencies | 3206 Security Deposits | ~ |
| Prepaid Expenses | 3311 | ✓ |
| Misc. Income receivable | 3314 Commission Receivable | ~ |
| *ऐप में अतिरिक्त:* 3310 GST ITC, 3108–3112 Accumulated Depreciation | | + |

### लाभ-हानि (P&L)

| CAS head | ऐप | स्थिति |
|---|---|---|
| Interest on Deposits | — (5604 में, G3) | ✗ |
| Interest on Borrowings DCCB/SCB | 5604 | ✓ |
| Interest on Loans from State Govt | — | ✗ |
| Interest on Borrowings from others | 5604 | ~ |
| Salary & Allowances (PF, Bonus, Gratuity सहित) | 5201–5209 (और बारीक) | ✓ |
| Management expenses | 5310 Meeting / AGM | ✓ |
| Rent, Taxes, Electricity | 5308, 5602, 5302 | ✓ |
| Repairs · Insurance · Law · Postage & Telephone · Printing · Audit · Travelling · Donations | 5402 · 5403 · 5305 · 5304/5313 · 5303 · 5306 · 5309 · 5405 | ✓ (8) |
| Vehicle expenses | — | ✗ |
| Depreciation on properties | 5501–5505 | ✓ |
| Depreciation in value of investments | — | ✗ |
| Other expenses | 5301 / 5312 / 5314 / 5315 | ~ |
| Provisions (10: Standard, Sub-standard, Doubtful, Loss, Bad debts ×2, Overdue interest loans/investments, Invest. depreciation, Other) | — (सिर्फ 5404 Bad Debt Written Off) | ✗ (10) |
| **Income** Interest on Loans & Advances | 4408 | ✓ |
| Dividend on Investments | 4404 | ✓ |
| Interest on deposits with banks | 4403 | ✓ |
| Rental Income | — (PACS chart में नहीं) | ✗ |
| Admission Fees | 4407 | ✓ |
| Misc (Locker rent, fee, custom hiring) | 4405 / 4208 / 4207 | ✓ |
| *ऐप में अतिरिक्त:* 4205 Commission, 4303–4305 Scheme Income, 4409 Bad Debt Recovery, 4410 Profit on Sale of Assets | | + |

### Trading Account

| CAS head | ऐप | स्थिति |
|---|---|---|
| Purchase: Fertilizers · Seeds · Pesticides · PDS · Non-PDS · Procurement | 5110 · 5111 · 5113 · 5115 · 5112 · 5116 | ✓ (6) |
| Purchase: Mid-day Meal | — | ✗ |
| Sale: Fertilizers · Seeds | — (4101 नहीं, G1) | ✗ (2) |
| Sale: Pesticides · PDS · Procurement | 4104 · 4107 · 4108 (parent 4100 नहीं, G1) | ✓ (3) |
| Sale: Non-PDS · Mid-day Meal | — | ✗ (2) |
| Transport/other expenses — 7 श्रेणियाँ | — | ✗ (7) |
| Salary of Salesman · License Fee · Gunny Bag Sales · Impairment in Stocks · Factory Expenses · Compensation · Other Trading Income · Purchase Returns · Sales Returns | — | ✗ (9) |
| Commission | 4205 Society Commission | ~ |
| *ऐप में अतिरिक्त:* 4105 Animal Feed, 4106 Implements, 5114 Animal Feed Purchase | | + |

---

## CAS बनाम ऐप — ब्याज का तरीका (H2 से जुड़ा)

CAS अध्याय 6.3: ब्याज पहले **आय** (Dr Non-overdue interest receivable / Cr Interest on loans) → overdue होने पर **Overdue Interest Receivable** में transfer → NPA ऋणों के overdue ब्याज पर **Provision** (Dr P&L / Cr Provision for overdue interest)। ऐप (H2, Haryana Act धारा 87 व्याख्या) में अतिदेय ब्याज **सीधे** 2211 संचय में जाता है। शुद्ध लाभ पर असर लगभग बराबर; खाते व Balance Sheet की प्रस्तुति अलग। CAS format बनाते समय इसे reporting-परत में मिलाना होगा (3313 → "Interest accrued / Overdue interest receivable", 2211 → Provisions समूह) — मूल ढाँचा बदले बिना।

---

## सुझाया गया क्रम (कोई भी कदम अलग मंज़ूरी से)

1. **G1 की prod जाँच** (नीचे query) → अगर असर है तो PACS chart में `3400 / 4100 / 4101 Fertilizer Sales / 4102 Seed Sales / 5100 / 5101` जोड़ना — यह CAS से स्वतंत्र, सीधी गड़बड़ है।
2. G2: PACS में Vehicle asset खाता।
3. **"NABARD CAS (PACS)" format** — `stateAuditFormats.ts` जैसा data-mapping (खाता → CAS head), जिससे CAS Trial Balance / Trading / P&L / Balance Sheet बने। सिर्फ PACS प्रकार पर लागू; बाकी समितियाँ अछूती।
4. Provisions / NPA (IRAC) — RBI/NABARD NPA norms व MIS Handbook (Annexure VII–VIII: overdue का period-wise वर्गीकरण, asset classification व provisioning) के आधार पर; अलग प्लान।

## Prod जाँच (सिर्फ पढ़ना)

```sql
-- 1) Vouchers जिनकी कोई leg ऐसे खाते पर है जो उस समिति की सूची में नहीं (G1 का असर)
select s.name, v.society_id, l->>'accountId' as account, count(*) as legs,
       sum((l->>'amount')::numeric) as amount
from vouchers v
left join society_settings s on s.society_id = v.society_id
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(v.lines) = 'array' and jsonb_array_length(v.lines) > 0 then v.lines
       else jsonb_build_array(jsonb_build_object('accountId', v."debitAccountId", 'amount', v.amount),
                              jsonb_build_object('accountId', v."creditAccountId", 'amount', v.amount)) end) l
where coalesce(v."isDeleted", false) = false
  and coalesce(l->>'accountId', '') <> ''
  and not exists (select 1 from accounts a where a.society_id = v.society_id and a.id = l->>'accountId')
group by 1, 2, 3 order by 1, 3;

-- 2) खाते जिनका parent समूह उस समिति में नहीं (लटके हुए खाते)
select s.name, a.society_id, a.id, a.name, a."parentId"
from accounts a
left join society_settings s on s.society_id = a.society_id
where a."parentId" is not null
  and not exists (select 1 from accounts p where p.society_id = a.society_id and p.id = a."parentId")
order by 1, 3;
```

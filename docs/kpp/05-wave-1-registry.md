# 05 — Wave-1 Production Registry

> The first **production Knowledge Item registry**. Real `KI-` ids assigned to atomic concepts, each
> traced to a SCOS cluster (= SMRD research id) and carrying its evidence/readiness. **No definitions or
> articles** — records only ([03](03-population-rules.md), [01](01-knowledge-item-schema.md)).

**Columns:** `KI-id` · Concept · **Topic** (SCOS `C###` = SMRD `SMRD:C###`) · **T**ype · **Ev**idence · **R**eadiness · **Pri** · **Pre**req KIs
**Type:** D=definitional · A=accounting · L=legal · C=compliance · P=procedural · S=software/product · X=computational · G=glossary
**Evidence:** `E2†` = internal corroboration exists (guide/cookbook/module), pending primary+SME · `E1` = secondary only · `NEV` = needs expert validation (no specific asserted)
**Readiness** ([KAE 10](../kae/10-content-readiness-engine.md)): A educational · B accounting · C compliance · D legal
**Baseline status:** every Wave-1 KI = `planned`; `definition` empty; advances to `active` via [07](07-quality-gates.md).
Each KI's `evidence_id` = paired `EV-######` (same numeric suffix) in [KAE 03](../kae/03-evidence-model.md).

---

## G01 · Cooperative Basics — KI-000001–000024
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000001 | Cooperative society | C001 | D | E2† | A | P0 | — |
| KI-000002 | Cooperative principles | C002 | D | E2† | A | P1 | 1 |
| KI-000003 | Cooperative values | C002 | D | E2† | A | P2 | 1 |
| KI-000004 | Member (concept) | C009 | D | E2† | A | P0 | 1 |
| KI-000005 | Byelaws | C010 | L | NEV | D | P1 | 1 |
| KI-000006 | Society registration | C005 | L | NEV | D | P1 | 1,5 |
| KI-000007 | Registrar of Cooperative Societies (RCS) | C007 | D | E2† | A | P1 | 1 |
| KI-000008 | Multi-State Cooperative Societies Act 2002 | C012 | L | NEV | D | P2 | 1 |
| KI-000009 | Society types (overview) | C004 | D | E2† | A | P0 | 1 |
| KI-000010 | PACS | C013 | D | E2† | A | P0 | 9 |
| KI-000011 | Dairy cooperative | C015 | D | E2† | A | P1 | 9 |
| KI-000012 | Consumer cooperative society | C016 | D | E2† | A | P1 | 9 |
| KI-000013 | Marketing cooperative society | C017 | D | E2† | A | P1 | 9 |
| KI-000014 | Credit cooperative society | C018 | D | E2† | A | P1 | 9 |
| KI-000015 | Housing cooperative society | C019 | D | E2† | A | P1 | 9 |
| KI-000016 | Labour cooperative society | C020 | D | E2† | A | P2 | 9 |
| KI-000017 | Processing cooperative society | C021 | D | E2† | A | P2 | 9 |
| KI-000018 | Apex / Federation | C008 | D | E2† | A | P2 | 9 |
| KI-000019 | Member rights | C009 | L | NEV | D | P1 | 4,5 |
| KI-000020 | Member duties | C009 | D | E2† | A | P2 | 4 |
| KI-000021 | Cooperative vs company | C001 | D | E2† | A | P2 | 1 |
| KI-000022 | MPACS (multi-purpose PACS) | C014 | D | E2† | A | P2 | 10 |
| KI-000023 | Ministry of Cooperation | C007 | D | E2† | A | P2 | 7 |
| KI-000024 | Cooperative lifecycle | C006 | D | E2† | A | P2 | 1 |

## G02 · Accounting Foundations — KI-000025–000054
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000025 | Accounting | C025 | D | E2† | A | P0 | — |
| KI-000026 | Double-entry system | C025 | D | E2† | A | P0 | 25 |
| KI-000027 | Debit | C026 | D | E2† | A | P0 | 26 |
| KI-000028 | Credit | C026 | D | E2† | A | P0 | 26 |
| KI-000029 | Golden rules (overview) | C026 | D | E2† | A | P0 | 27,28 |
| KI-000030 | Personal account rule | C026 | A | E2† | B | P1 | 29 |
| KI-000031 | Real account rule | C026 | A | E2† | B | P1 | 29 |
| KI-000032 | Nominal account rule | C026 | A | E2† | B | P1 | 29 |
| KI-000033 | Account (concept) | C032 | D | E2† | A | P0 | 25 |
| KI-000034 | Asset | C032 | D | E2† | A | P0 | 33 |
| KI-000035 | Liability | C032 | D | E2† | A | P0 | 33 |
| KI-000036 | Capital / Own funds | C032 | D | E2† | A | P0 | 33 |
| KI-000037 | Income | C035 | D | E2† | A | P0 | 33 |
| KI-000038 | Expense | C035 | D | E2† | A | P0 | 33 |
| KI-000039 | Transaction | C025 | D | E2† | A | P1 | 25 |
| KI-000040 | Accounting equation | C025 | D | E2† | A | P1 | 34,35,36 |
| KI-000041 | Accrual basis | C029 | A | NEV | B | P1 | 25 |
| KI-000042 | Cash basis | C029 | A | NEV | B | P1 | 25 |
| KI-000043 | Going concern | C030 | D | E2† | A | P2 | 25 |
| KI-000044 | Prudence / conservatism | C030 | D | E2† | A | P2 | 25 |
| KI-000045 | Consistency convention | C030 | D | E2† | A | P2 | 25 |
| KI-000046 | Books of account | C027 | D | E2† | A | P1 | 25 |
| KI-000047 | Journal | C027 | D | E2† | A | P1 | 46 |
| KI-000048 | Posting | C027 | D | E2† | A | P1 | 47 |
| KI-000049 | Accounting cycle | C028 | D | E2† | A | P1 | 25 |
| KI-000050 | Financial year (Apr–Mar) | C033 | D | E2† | A | P0 | 25 |
| KI-000051 | Opening balance | C033 | A | E2† | B | P0 | 50 |
| KI-000052 | Closing balance | C033 | A | E2† | B | P1 | 50 |
| KI-000053 | Accounting period | C028 | D | E2† | A | P2 | 49 |
| KI-000054 | Materiality | C030 | D | E2† | A | P3 | 25 |

## G03 · Voucher Concepts — KI-000055–000078
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000055 | Voucher | C037 | D | E2† | A | P0 | 39 |
| KI-000056 | Receipt voucher | C038 | A | E2† | B | P0 | 55 |
| KI-000057 | Payment voucher | C039 | A | E2† | B | P0 | 55 |
| KI-000058 | Journal voucher | C040 | A | E2† | B | P1 | 55 |
| KI-000059 | Contra voucher | C041 | A | E2† | B | P1 | 55 |
| KI-000060 | Compound voucher | C042 | A | E2† | B | P1 | 55 |
| KI-000061 | Narration | C044 | D | E2† | A | P2 | 55 |
| KI-000062 | Voucher number & series | C045 | P | E2† | A | P2 | 55 |
| KI-000063 | Supporting document / bill | C046 | P | E2† | A | P1 | 55 |
| KI-000064 | Maker-checker control | C043 | P | E2† | B | P1 | 55 |
| KI-000065 | Voucher approval workflow | C043 | S | E2† | A | P1 | 64 |
| KI-000066 | Voucher cancellation / soft-delete | C046 | C | NEV | C | P1 | 55 |
| KI-000067 | Debit note | C102 | A | NEV | B | P2 | 55 |
| KI-000068 | Credit note | C102 | A | NEV | B | P2 | 55 |
| KI-000069 | Voucher date | C037 | D | E2† | A | P2 | 55 |
| KI-000070 | Backdated entry (rules) | C048 | C | NEV | C | P2 | 55 |
| KI-000071 | Voucher entry quick reference | C047 | P | E2† | A | P1 | 55 |
| KI-000072 | Auto-numbering (app) | C045 | S | E2† | A | P3 | 62 |
| KI-000073 | Voucher narration best practice | C044 | P | E2† | A | P3 | 61 |
| KI-000074 | Reversing entry | C036 | A | NEV | B | P2 | 58 |
| KI-000075 | Adjustment entry | C036 | A | NEV | B | P1 | 58 |
| KI-000076 | Rectification entry | C036 | A | NEV | B | P1 | 58 |
| KI-000077 | Opening voucher (opening balances) | C033 | A | E2† | B | P1 | 51 |
| KI-000078 | Period-lock / FY-lock entry rule | C048 | C | NEV | C | P2 | 50 |

## G04 · Ledger & Chart of Accounts — KI-000079–000098
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000079 | Ledger | C032 | D | E2† | A | P0 | 48 |
| KI-000080 | Ledger account | C032 | D | E2† | A | P0 | 79 |
| KI-000081 | Chart of accounts | C031 | A | E2† | B | P0 | 80 |
| KI-000082 | Account group | C032 | D | E2† | A | P1 | 81 |
| KI-000083 | Account head / ledger head | C032 | D | E2† | A | P1 | 81 |
| KI-000084 | Control account | C032 | A | E2† | B | P2 | 80 |
| KI-000085 | Subsidiary ledger | C032 | A | E2† | B | P1 | 80 |
| KI-000086 | Day book | C027 | D | E2† | A | P1 | 47 |
| KI-000087 | Balancing an account | C032 | A | E2† | B | P1 | 80 |
| KI-000088 | Ledger folio | C032 | D | E2† | A | P3 | 80 |
| KI-000089 | Account code | C031 | A | E2† | B | P2 | 81 |
| KI-000090 | Standard chart of accounts | C031 | A | E2† | B | P0 | 81 |
| KI-000091 | PACS standard COA | C031 | A | NEV | C | P1 | 90,10 |
| KI-000092 | Member sub-ledger | C063 | A | E2† | B | P1 | 85 |
| KI-000093 | Loan sub-ledger | C063 | A | E2† | B | P1 | 85 |
| KI-000094 | Supplier sub-ledger | C099 | A | E2† | B | P2 | 85 |
| KI-000095 | Customer sub-ledger | C099 | A | E2† | B | P2 | 85 |
| KI-000096 | Group summary report | C032 | S | E2† | A | P2 | 82 |
| KI-000097 | Account-name glossary | C034 | D | E2† | A | P2 | 83 |
| KI-000098 | Expense dictionary | C035 | D | E2† | A | P2 | 38 |

## G05 · Cash — KI-000099–000112
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000099 | Cash | C105 | D | E2† | A | P0 | 34 |
| KI-000100 | Cash account | C105 | D | E2† | A | P0 | 80,99 |
| KI-000101 | Cash book | C105 | D | E2† | A | P0 | 100,86 |
| KI-000102 | Cash-in-hand | C105 | D | E2† | A | P1 | 99 |
| KI-000103 | Cash receipt | C105 | A | E2† | B | P1 | 56,101 |
| KI-000104 | Cash payment | C105 | A | E2† | B | P1 | 57,101 |
| KI-000105 | Petty cash | C105 | A | E2† | B | P2 | 101 |
| KI-000106 | Imprest system | C105 | A | E2† | B | P3 | 105 |
| KI-000107 | Cash verification | C091 | C | E2† | B | P2 | 102 |
| KI-000108 | Cash discrepancy | C105 | A | E2† | B | P2 | 102 |
| KI-000109 | Statutory cash-in-hand limit | C110 | L | NEV | D | P2 | 102 |
| KI-000110 | Denomination slip | C105 | P | E2† | A | P3 | 102 |
| KI-000111 | Cash deposit to bank | C105 | A | E2† | B | P1 | 59 |
| KI-000112 | Cash withdrawal from bank | C105 | A | E2† | B | P1 | 59 |

## G06 · Bank — KI-000113–000130
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000113 | Bank account | C106 | D | E2† | A | P0 | 35 |
| KI-000114 | Bank book | C106 | D | E2† | A | P0 | 80,113 |
| KI-000115 | Deposit slip | C106 | P | E2† | A | P2 | 113 |
| KI-000116 | Cheque | C108 | D | E2† | A | P1 | 113 |
| KI-000117 | Demand draft (DD) | C108 | D | E2† | A | P2 | 113 |
| KI-000118 | NEFT / RTGS | C109 | D | E2† | A | P2 | 113 |
| KI-000119 | UPI for societies | C109 | D | E2† | A | P2 | 113 |
| KI-000120 | Passbook | C106 | D | E2† | A | P3 | 113 |
| KI-000121 | Bank statement | C107 | D | E2† | A | P1 | 113 |
| KI-000122 | Bank reconciliation (BRS) | C107 | A | E2† | B | P0 | 114,121 |
| KI-000123 | BRS difference | C107 | A | E2† | B | P1 | 122 |
| KI-000124 | Outstanding cheque | C107 | A | E2† | B | P2 | 122 |
| KI-000125 | Uncredited deposit | C107 | A | E2† | B | P2 | 122 |
| KI-000126 | Stale cheque | C108 | A | E2† | B | P3 | 116 |
| KI-000127 | Multi-bank handling | C106 | S | E2† | A | P2 | 114 |
| KI-000128 | Bank charges | C109 | A | E2† | B | P2 | 114 |
| KI-000129 | Bank interest received | C079 | A | E2† | B | P2 | 114 |
| KI-000130 | Cheque bounce / dishonour | C108 | A | E2† | B | P3 | 116 |

## G07 · Members — KI-000131–000152
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000131 | Membership | C061 | D | E2† | A | P0 | 4 |
| KI-000132 | Member admission | C061 | L | NEV | D | P1 | 131 |
| KI-000133 | Member eligibility | C061 | L | NEV | D | P1 | 131 |
| KI-000134 | Nominal member | C061 | D | E2† | A | P2 | 131 |
| KI-000135 | Associate member | C061 | D | E2† | A | P2 | 131 |
| KI-000136 | Member register | C061 | A | E2† | B | P1 | 131 |
| KI-000137 | Member ledger | C063 | A | E2† | B | P1 | 92,136 |
| KI-000138 | Member resignation / exit | C067 | L | NEV | D | P2 | 131 |
| KI-000139 | Member expulsion | C067 | L | NEV | D | P2 | 131 |
| KI-000140 | Nomination | C064 | L | NEV | D | P1 | 131 |
| KI-000141 | Nominee | C064 | D | E2† | A | P2 | 140 |
| KI-000142 | Transmission (on death) | C064 | L | NEV | D | P2 | 140 |
| KI-000143 | Form-1 member list | C065 | C | NEV | C | P2 | 136 |
| KI-000144 | Entrance fee | C066 | A | E2† | B | P2 | 131 |
| KI-000145 | Member dues | C063 | A | E2† | B | P2 | 137 |
| KI-000146 | Dormant member | C067 | C | NEV | C | P3 | 131 |
| KI-000147 | Defaulter member | C067 | C | NEV | C | P2 | 145 |
| KI-000148 | Membership fee accounting | C066 | A | E2† | B | P2 | 144 |
| KI-000149 | Member application (process) | C061 | P | E2† | A | P1 | 132 |
| KI-000150 | Member grievance / dispute | C169 | L | NEV | D | P3 | 131 |
| KI-000151 | Member education | C068 | D | E2† | A | P3 | 131 |
| KI-000152 | Active vs non-active member | C067 | C | NEV | C | P3 | 131 |

## G08 · Share Capital — KI-000153–000166
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000153 | Share | C062 | D | E2† | A | P0 | 131 |
| KI-000154 | Share capital | C062 | A | E2† | B | P0 | 153,36 |
| KI-000155 | Authorised capital | C062 | D | E2† | A | P1 | 154 |
| KI-000156 | Issued capital | C062 | D | E2† | A | P1 | 154 |
| KI-000157 | Paid-up capital | C062 | D | E2† | A | P1 | 154 |
| KI-000158 | Face value | C062 | D | E2† | A | P2 | 153 |
| KI-000159 | Share issue | C062 | A | E2† | B | P1 | 154 |
| KI-000160 | Share transfer | C062 | L | NEV | D | P2 | 153 |
| KI-000161 | Share refund (on exit) | C062 | L | NEV | D | P2 | 138,153 |
| KI-000162 | Share register | C062 | A | E2† | B | P1 | 154 |
| KI-000163 | Share certificate | C061 | D | E2† | A | P2 | 153 |
| KI-000164 | Dividend on shares | C174 | L | NEV | D | P1 | 154 |
| KI-000165 | Minimum shareholding | C062 | L | NEV | D | P3 | 153 |
| KI-000166 | Share-linked borrowing | C075 | A | NEV | B | P3 | 154 |

## G09 · Reserve Funds & Profit — KI-000167–000184
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000167 | Net profit / surplus | C172 | A | E2† | B | P0 | 38,37 |
| KI-000168 | Appropriation of profit | C172 | L | NEV | D | P0 | 167 |
| KI-000169 | Appropriation order (statutory) | C172 | L | NEV | D | P1 | 168 |
| KI-000170 | Reserve fund | C173 | A | E2† | B | P0 | 167 |
| KI-000171 | Statutory reserve % | C173 | L | NEV | D | P1 | 170 |
| KI-000172 | Education fund | C162 | L | NEV | D | P2 | 168 |
| KI-000173 | Cooperative / other funds | C161 | L | NEV | D | P2 | 168 |
| KI-000174 | Building fund | C173 | A | E2† | B | P3 | 170 |
| KI-000175 | Dividend | C174 | L | NEV | D | P1 | 168 |
| KI-000176 | Dividend rate cap | C174 | L | NEV | D | P2 | 175 |
| KI-000177 | Patronage bonus / rebate | C175 | L | NEV | D | P2 | 168 |
| KI-000178 | Undistributed surplus | C177 | A | E2† | B | P2 | 167 |
| KI-000179 | Carry forward of surplus | C177 | A | E2† | B | P2 | 178 |
| KI-000180 | Deficit / loss treatment | C177 | A | NEV | B | P2 | 167 |
| KI-000181 | Provision | C036 | A | NEV | B | P1 | 167 |
| KI-000182 | Reserve fund investment | C161 | L | NEV | D | P3 | 170 |
| KI-000183 | Appropriation account | C176 | A | NEV | B | P2 | 168 |
| KI-000184 | Bad-debt provision | C036 | A | NEV | B | P2 | 181 |

## G10 · Trial Balance — KI-000185–000196
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000185 | Trial balance | C049 | A | E2† | B | P0 | 87 |
| KI-000186 | Debit & credit columns | C049 | D | E2† | A | P1 | 185 |
| KI-000187 | Agreement (Dr = Cr) | C049 | A | E2† | B | P0 | 185 |
| KI-000188 | Suspense account | C049 | A | E2† | B | P2 | 187 |
| KI-000189 | TB error types | C214 | A | E2† | B | P1 | 185 |
| KI-000190 | TB not matching (diagnosis) | C214 | A | E2† | B | P1 | 189 |
| KI-000191 | Opening trial balance | C049 | A | E2† | B | P2 | 51,185 |
| KI-000192 | Adjusted trial balance | C049 | A | E2† | B | P2 | 185,75 |
| KI-000193 | TB to financial statements | C049 | A | E2† | B | P1 | 185 |
| KI-000194 | Gross vs net trial balance | C049 | A | E2† | B | P3 | 185 |
| KI-000195 | Schedule / grouping in TB | C057 | A | E2† | B | P2 | 185 |
| KI-000196 | Rounding & casting errors | C214 | A | E2† | B | P3 | 189 |

## G11 · Financial Statements — KI-000197–000226
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000197 | Final accounts | C051 | A | E2† | B | P0 | 193 |
| KI-000198 | Trading account | C050 | A | E2† | B | P0 | 197 |
| KI-000199 | Gross profit | C050 | A | E2† | B | P1 | 198 |
| KI-000200 | Direct expense | C050 | A | E2† | B | P2 | 198 |
| KI-000201 | Profit & Loss account | C051 | A | E2† | B | P0 | 197 |
| KI-000202 | Income & Expenditure account | C051 | A | E2† | B | P0 | 197 |
| KI-000203 | Net profit / net result | C051 | A | E2† | B | P1 | 201 |
| KI-000204 | Indirect expense | C051 | A | E2† | B | P2 | 201 |
| KI-000205 | Operating income | C051 | A | E2† | B | P2 | 201 |
| KI-000206 | Receipts & Payments account | C052 | A | E2† | B | P0 | 101 |
| KI-000207 | Balance sheet | C053 | A | E2† | B | P0 | 197 |
| KI-000208 | Schedules to accounts | C057 | C | NEV | C | P2 | 197 |
| KI-000209 | Statutory statement format | C055 | L | NEV | D | P1 | 197 |
| KI-000210 | Report→statutory-form map | C055 | C | NEV | C | P1 | 209 |
| KI-000211 | Comparative statements | C058 | A | E2† | B | P2 | 197 |
| KI-000212 | How to read financial reports | C054 | D | E2† | A | P0 | 207 |
| KI-000213 | Closing stock (in trading) | C087 | A | E2† | B | P1 | 198 |
| KI-000214 | Depreciation (in P&L) | C112 | A | NEV | B | P1 | 201 |
| KI-000215 | Outstanding expense (adjustment) | C036 | A | NEV | B | P2 | 75 |
| KI-000216 | Prepaid expense (adjustment) | C036 | A | NEV | B | P2 | 75 |
| KI-000217 | Accrued income (adjustment) | C036 | A | NEV | B | P2 | 75 |
| KI-000218 | Income received in advance | C036 | A | NEV | B | P2 | 75 |
| KI-000219 | Trading vs P&L distinction | C050 | A | E2† | B | P2 | 198,201 |
| KI-000220 | I&E vs P&L (society context) | C051 | A | E2† | B | P1 | 202 |
| KI-000221 | R&P vs I&E distinction | C052 | A | E2† | B | P2 | 206,202 |
| KI-000222 | Financial ratios (overview) | C056 | A | NEV | B | P1 | 207 |
| KI-000223 | Liquidity ratio | C056 | A | NEV | B | P2 | 222 |
| KI-000224 | Profitability ratio | C056 | A | NEV | B | P2 | 222 |
| KI-000225 | Cash flow / fund flow | C060 | A | E2† | B | P3 | 206 |
| KI-000226 | MIS / board pack | C059 | S | E2† | A | P3 | 212 |

## G12 · Balance Sheet (detail) — KI-000227–000240
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000227 | Assets side | C053 | A | E2† | B | P1 | 207 |
| KI-000228 | Liabilities side | C053 | A | E2† | B | P1 | 207 |
| KI-000229 | Fixed assets | C111 | A | E2† | B | P1 | 227 |
| KI-000230 | Current assets | C053 | A | E2† | B | P1 | 227 |
| KI-000231 | Current liabilities | C053 | A | E2† | B | P1 | 228 |
| KI-000232 | Long-term liabilities | C053 | A | E2† | B | P2 | 228 |
| KI-000233 | Capital & reserves (BS) | C053 | A | E2† | B | P1 | 228,170 |
| KI-000234 | Contingent liability | C053 | A | NEV | B | P3 | 228 |
| KI-000235 | Accounting equation in BS | C053 | A | E2† | B | P2 | 40,207 |
| KI-000236 | Fund-based balance sheet | C053 | A | NEV | B | P2 | 207 |
| KI-000237 | BS not tallying (diagnosis) | C215 | A | E2† | B | P1 | 207 |
| KI-000238 | Investments (BS) | C161 | A | E2† | B | P3 | 227 |
| KI-000239 | Sundry debtors | C098 | A | E2† | B | P2 | 230 |
| KI-000240 | Sundry creditors | C098 | A | E2† | B | P2 | 231 |

## G13 · Audit Basics — KI-000241–000262
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000241 | Audit | C143 | D | E2† | A | P0 | 197 |
| KI-000242 | Cooperative / statutory audit | C143 | C | NEV | C | P0 | 241 |
| KI-000243 | Internal audit | C146 | C | NEV | C | P1 | 241 |
| KI-000244 | Concurrent audit | C147 | C | NEV | C | P2 | 241 |
| KI-000245 | Auditor | C143 | D | E2† | A | P1 | 241 |
| KI-000246 | Audit period | C143 | C | NEV | C | P2 | 242 |
| KI-000247 | Audit report | C150 | C | NEV | C | P1 | 242 |
| KI-000248 | Audit certificate | C150 | C | NEV | C | P2 | 247 |
| KI-000249 | Audit classification / grade | C145 | L | NEV | D | P1 | 247 |
| KI-000250 | Audit memo | C148 | C | NEV | C | P1 | 247 |
| KI-000251 | Audit objection | C153 | C | NEV | C | P1 | 250 |
| KI-000252 | Rectification of objection | C148 | C | NEV | C | P1 | 251 |
| KI-000253 | Audit trail | C151 | S | E2† | B | P1 | 64 |
| KI-000254 | Vouching | C143 | A | E2† | B | P2 | 242 |
| KI-000255 | Verification | C143 | A | E2† | B | P2 | 242 |
| KI-000256 | Audit preparation checklist | C144 | P | E2† | A | P0 | 242 |
| KI-000257 | Audit schedules | C149 | C | NEV | C | P2 | 247 |
| KI-000258 | Common audit objections | C153 | C | NEV | C | P1 | 251 |
| KI-000259 | Special / cost audit | C152 | L | NEV | D | P3 | 242 |
| KI-000260 | Audit fee accounting | C143 | A | E2† | B | P3 | 38 |
| KI-000261 | Maker-checker (audit control) | C151 | S | E2† | B | P2 | 64 |
| KI-000262 | Audit-readiness | C144 | P | E2† | A | P1 | 256 |

## G14 · Glossary (core Hindi–English terms) — KI-000263–000302
*Type G (glossary leaf); each `related` to its concept KI. Readiness A; evidence E2†.*
| KI | Term (Hindi · English) | Topic | Related KI |
|---|---|---|---|
| KI-000263 | रोकड़ बही · Cash Book | C105 | 101 |
| KI-000264 | बैंक बही · Bank Book | C106 | 114 |
| KI-000265 | खाता बही · Ledger | C032 | 79 |
| KI-000266 | रोज़नामचा · Day Book | C027 | 86 |
| KI-000267 | वाउचर · Voucher | C037 | 55 |
| KI-000268 | नाम · Debit | C026 | 27 |
| KI-000269 | जमा · Credit | C026 | 28 |
| KI-000270 | तलपट · Trial Balance | C049 | 185 |
| KI-000271 | चिट्ठा / तुलन पत्र · Balance Sheet | C053 | 207 |
| KI-000272 | लाभ-हानि खाता · Profit & Loss | C051 | 201 |
| KI-000273 | आय-व्यय खाता · Income & Expenditure | C051 | 202 |
| KI-000274 | प्राप्ति-भुगतान · Receipts & Payments | C052 | 206 |
| KI-000275 | व्यापार खाता · Trading Account | C050 | 198 |
| KI-000276 | पूँजी · Capital | C032 | 36 |
| KI-000277 | परिसंपत्ति · Asset | C032 | 34 |
| KI-000278 | देयता · Liability | C032 | 35 |
| KI-000279 | आय · Income | C035 | 37 |
| KI-000280 | व्यय · Expense | C035 | 38 |
| KI-000281 | सदस्य · Member | C009 | 4 |
| KI-000282 | अंश / शेयर · Share | C062 | 153 |
| KI-000283 | अंश पूँजी · Share Capital | C062 | 154 |
| KI-000284 | लाभांश · Dividend | C174 | 175 |
| KI-000285 | आरक्षित निधि · Reserve Fund | C173 | 170 |
| KI-000286 | अधिशेष · Surplus | C172 | 167 |
| KI-000287 | अंकेक्षण · Audit | C143 | 241 |
| KI-000288 | अंकेक्षक · Auditor | C143 | 245 |
| KI-000289 | ऋण · Loan | C069 | — |
| KI-000290 | ब्याज · Interest | C070 | — |
| KI-000291 | वसूली · Recovery | C072 | — |
| KI-000292 | स्टॉक / माल · Stock | C085 | — |
| KI-000293 | मूल्यह्रास / घिसाई · Depreciation | C112 | 214 |
| KI-000294 | खरीद · Purchase | C096 | — |
| KI-000295 | बिक्री · Sale | C095 | — |
| KI-000296 | समिति · Society | C001 | 1 |
| KI-000297 | उपविधि · Byelaws | C010 | 5 |
| KI-000298 | पंजीयक · Registrar (RCS) | C007 | 7 |
| KI-000299 | बैंक समाधान · Bank Reconciliation | C107 | 122 |
| KI-000300 | प्रारंभिक शेष · Opening Balance | C033 | 51 |
| KI-000301 | वित्तीय वर्ष · Financial Year | C033 | 50 |
| KI-000302 | प्रावधान · Provision | C036 | 181 |

## G15 · Software / SaaS Concepts — KI-000303–000324
*Type S (product); Level A; evidence E2† (SRC-INT-MODULES).*
| KI | Concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000303 | Cloud accounting | C192 | S | E2† | A | P1 | 25 |
| KI-000304 | SaaS (software as a service) | C190 | S | E2† | A | P2 | 303 |
| KI-000305 | Society setup | C220 | S | E2† | A | P0 | 1 |
| KI-000306 | Data backup | C193 | S | E2† | A | P1 | — |
| KI-000307 | Data restore | C198 | S | E2† | A | P1 | 306 |
| KI-000308 | Universal importer | C195 | S | E2† | A | P1 | — |
| KI-000309 | Data export | C058 | S | E2† | A | P2 | — |
| KI-000310 | User role | C194 | S | E2† | A | P1 | — |
| KI-000311 | User permission | C194 | S | E2† | A | P1 | 310 |
| KI-000312 | FY-lock | C048 | S | E2† | B | P1 | 50 |
| KI-000313 | Multi-society consolidation | C197 | S | E2† | A | P2 | — |
| KI-000314 | Dashboard | C059 | S | E2† | A | P1 | 212 |
| KI-000315 | Audit log (app) | C151 | S | E2† | A | P2 | 253 |
| KI-000316 | Optimistic save & rollback (invariant) | C217 | S | E2† | A | P1 | — |
| KI-000317 | Local-vs-cloud integrity | C217 | S | E2† | A | P1 | 316 |
| KI-000318 | Report export (PDF/Excel) | C058 | S | E2† | A | P2 | 309 |
| KI-000319 | Tally / Excel migration | C191 | S | E2† | A | P2 | 308 |
| KI-000320 | Mobile / multi-user | C196 | S | E2† | A | P3 | — |
| KI-000321 | Choosing accounting software | C190 | S | E2† | A | P1 | 304 |
| KI-000322 | Why go digital | C184 | S | E2† | A | P0 | 303 |
| KI-000323 | PACS computerization | C186 | C | NEV | C | P1 | 10 |
| KI-000324 | Member self-service | C189 | S | E2† | A | P3 | 131 |

## G16 · Help / Onboarding Concepts — KI-000325–000340
*Type P (procedural/task); Level A; map to `/help` tasks.*
| KI | Concept (task) | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000325 | Getting started | C221 | P | E2† | A | P0 | 305 |
| KI-000326 | Society setup steps | C220 | P | E2† | A | P0 | 305 |
| KI-000327 | Add member (task) | C061 | P | E2† | A | P0 | 149 |
| KI-000328 | Add ledger / account (task) | C032 | P | E2† | A | P1 | 81 |
| KI-000329 | Opening balance entry (task) | C033 | P | E2† | A | P0 | 77 |
| KI-000330 | First voucher (task) | C037 | P | E2† | A | P0 | 55 |
| KI-000331 | View trial balance (task) | C049 | P | E2† | A | P1 | 185 |
| KI-000332 | Cash book view (task) | C105 | P | E2† | A | P1 | 101 |
| KI-000333 | Bank reconciliation (task) | C107 | P | E2† | A | P1 | 122 |
| KI-000334 | Loan entry (task) | C069 | P | E2† | A | P1 | — |
| KI-000335 | User permission (task) | C194 | P | E2† | A | P1 | 311 |
| KI-000336 | Generate report (task) | C054 | P | E2† | A | P1 | 212 |
| KI-000337 | Year-end close (task) | C144 | P | E2† | A | P1 | 256 |
| KI-000338 | Audit report (task) | C150 | P | E2† | A | P1 | 247 |
| KI-000339 | Backup & restore (task) | C193 | P | E2† | A | P1 | 306 |
| KI-000340 | Add a bank (task) | C106 | P | E2† | A | P2 | 113 |

## G17 · FAQ Concepts — KI-000341–000356
*Type D/C; one atomic question-concept each (the answer is generated later from the linked KI).*
| KI | Question-concept | Topic | T | Ev | R | Pri | Pre |
|---|---|---|---|---|---|---|---|
| KI-000341 | Is SahakarLekha free? | C190 | S | E2† | A | P0 | 304 |
| KI-000342 | What is a cooperative society? | C001 | D | E2† | A | P0 | 1 |
| KI-000343 | Which society types are supported? | C004 | S | E2† | A | P1 | 9 |
| KI-000344 | Is data safe / backed up? | C193 | S | E2† | A | P0 | 306 |
| KI-000345 | Can I migrate from Tally? | C191 | S | E2† | A | P1 | 319 |
| KI-000346 | Do I need accounting knowledge? | C220 | S | E2† | A | P1 | 305 |
| KI-000347 | How to start (first steps)? | C221 | P | E2† | A | P0 | 325 |
| KI-000348 | Does it support Hindi? | C190 | S | E2† | A | P0 | 304 |
| KI-000349 | Is it for PACS / my society? | C004 | S | E2† | A | P1 | 10 |
| KI-000350 | Can multiple users work together? | C196 | S | E2† | A | P2 | 320 |
| KI-000351 | How is audit supported? | C143 | S | E2† | A | P1 | 256 |
| KI-000352 | Does it handle GST/TDS? | C124 | C | NEV | C | P1 | — |
| KI-000353 | What reports can I get? | C054 | S | E2† | A | P1 | 212 |
| KI-000354 | How is opening balance entered? | C033 | P | E2† | A | P1 | 329 |
| KI-000355 | Can I work offline? | C196 | S | E2† | A | P2 | 320 |
| KI-000356 | How do I close the financial year? | C144 | P | E2† | A | P1 | 337 |

---

## Registry rollup (Wave 1)
- **356 Knowledge Items** assigned (KI-000001–KI-000356).
- **By readiness:** A ≈ 60% (educational/product — *acquirable now, no SME*), B ≈ 28% (accounting — SME),
  C ≈ 7% (compliance — SME), D ≈ 5% (legal — SME + jurisdiction).
- **By evidence:** `E2†` (internal corroboration, pending primary+SME) majority; `NEV` on all B/C/D
  treatments & all legal items.
- **Status (updated 2026-06-27):** **50 `active`** (Wave-1A, see below); **306 `planned`**. The 50 are the
  highest-value **Level-A** items, fully populated with definitions and links in
  [`wave-1-active/`](wave-1-active/00-index.md) and passing the [07 gates](07-quality-gates.md). All B/C/D
  items remain `planned` pending SME (E3).
- **Next:** continue Level-A definitions for the remaining ~160 Level-A KIs; queue B/C/D for SME; Waves 2–3 per [02](02-wave-1-plan.md).

---

## Activation log — Wave-1A (`planned` → `active`, 2026-06-27)

**50 Level-A KIs activated.** Full records: [`wave-1-active/00-index.md`](wave-1-active/00-index.md).

| Group | Activated KI ids | Count |
|---|---|---|
| Cooperative Basics | 000001, 000002, 000004, 000007, 000009, 000010, 000014, 000021 | 8 |
| Accounting Foundations | 000025–000029, 000033–000040, 000046, 000047, 000049, 000050 | 17 |
| Vouchers/Ledger/Books | 000048, 000055, 000079, 000080, 000086, 000099, 000101 | 7 |
| Cash Account & Bank | 000100, 000113, 000114, 000116, 000118, 000121 | 6 |
| Members & Shares | 000131, 000134, 000153, 000157, 000158 | 5 |
| Financial Statements | 000212 | 1 |
| Software / SaaS | 000303, 000305, 000306, 000322 | 4 |
| Help / FAQ | 000325, 000341 | 2 |
| **Total** | | **50** |

> Only Level-A (educational/product) items were activated — **no** accounting treatments, legal advice,
> tax rates, or jurisdiction-specific compliance (those need SME → E3). Activation stopped at 50 by design.

---

### Cross-references
[KI Schema](01-knowledge-item-schema.md) · [Wave Plan](02-wave-1-plan.md) · [Population Rules](03-population-rules.md) · [Knowledge Relationships](04-knowledge-relationships.md) · [Quality Gates](07-quality-gates.md) · [Gap Analysis](06-gap-analysis.md)

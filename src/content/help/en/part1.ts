import type { HelpTaskEn } from './types';

export const HELP_EN_PART1: Record<string, HelpTaskEn> = {
  'add-member': {
    metaTitle: `How to Add a Member in a Cooperative Society — Step by Step | SahakarLekha`,
    metaDescription: `Add a new member, enter share capital and admission fee, and approve — in 3 minutes. The share capital receipt voucher is created automatically.`,
    title: `How to Add a Member`,
    estTime: `3 min`,
    tldr: `Members page → "New Member" → fill in name, phone, number of shares × face value per share, admission fee and nominee → "Save". The receipt (voucher) for share capital and admission fee is created automatically.`,
    prerequisites: [`Complete the society setup once`],
    steps: [
      `Open the **"Members"** page from the menu.`,
      `Click the **"New Member"** button at the top right — the "Add New Member (Direct)" form opens. A member added through this form goes straight into the verified list.`,
      `Under "Basic details", always fill in **Member Name** and **Phone** (both are marked *) and enter the correct "Date of Joining". The app fills in the next Member ID by itself — if you change it, make sure it is not another member's ID.`,
      `Under "Membership & shares", fill in **"Shares"** and **"Face Value"** — share capital is multiplied and filled in automatically. Enter the **"Admission Fee"** in its own box and choose the "Payment Mode" (Cash / Cheque / Online).`,
      `Under "Primary Nominee", always fill in the nominee's name — without it the member is not saved. If you enter Aadhaar / PAN, enter it in full and correctly.`,
      `Click **"Save"**. "Member added" appears and the receipt voucher for share capital and admission fee is created automatically — in cash, or in the bank account if paid by cheque / online. Do not create a separate voucher for it.`,
      `To add a member from an application, use the **"Application Form"** button — such members go to the **"Pending Applications"** tab and their receipt is created only when you click ✓ (approve).`,
    ],
    commonMistakes: [
      `Adding share capital and admission fee together in one field — keep them separate, otherwise the figures in reports will be wrong.`,
      `Also creating a separate manual share-capital voucher for the same member after adding them — this causes a double entry. The app creates the voucher itself.`,
    ],
    faqs: [
      {
        q: `Do I have to create a share capital voucher separately?`,
        a: `No. As soon as the member is saved (or approved), the receipt voucher for share capital and admission fee is created automatically.`,
      },
      {
        q: `What should the Member ID be?`,
        a: `Any unique number/code — but it must be different for every member, otherwise the app will warn about a duplicate.`,
      },
      {
        q: `Why can't I change the number of shares when editing a member?`,
        a: `In edit, the share count / value are locked. To increase or reduce shares, use the "Share Register" page, so the change is recorded correctly in the books.`,
      },
      {
        q: `The Vouchers page also has a "Member Share Capital" tile — should I make an entry from it too?`,
        a: `Not for a new member — the receipt is created as soon as the member is saved. Making the entry again from that tile will post the share capital twice.`,
      },
    ],
    troubleshooting: [
      {
        problem: `The "Please fill required fields" toast appeared.`,
        fix: `Fill in both the member's name and phone number — both are required.`,
      },
      {
        problem: `The "Member ID already exists" toast appeared.`,
        fix: `This ID belongs to another member. Open the form again (the app will fill in the next free number) or enter a new ID.`,
      },
      {
        problem: `The "Nominee required" or "Nominee error" toast appeared.`,
        fix: `Fill in the nominee's name under "Primary Nominee". If you have added extra nominees, their total share % must not be more than 100.`,
      },
      {
        problem: `The message "Old member — no cash receipt created" appeared.`,
        fix: `The date of joining is before this financial year, so no receipt was created in this year's cash — this is correct. Include their share amount in the share capital account in the opening balances.`,
      },
      {
        problem: `The message "Bank account not found" appeared.`,
        fix: `Payment was chosen as cheque / online but the society has no bank account, so the receipt went to cash. Create a bank account in Ledger Heads and correct that receipt voucher.`,
      },
      {
        problem: `"FY Locked", "No internet — entry paused" or "Member not saved" appeared.`,
        fix: `The member has not been saved (it will not appear in the list). If the FY is locked, ask the admin to unlock the year; if there is no internet / a red banner, fix the connection or click "Reload" and add the member again.`,
      },
    ],
    deepLinkLabel: `Add a Member in SahakarLekha now`,
  },

  'opening-balances': {
    metaTitle: `How to Enter Opening Balances — Cooperative Society Accounting | SahakarLekha`,
    metaDescription: `Carry last year's closing balances into this year's opening balances — with Dr=Cr matching. This is the root of "why doesn't the balance sheet tally".`,
    title: `How to Enter Opening Balances`,
    estTime: `5 min`,
    tldr: `"Opening Balances" page (admin only) → fill in last year's closing balance in asset, liability and capital accounts → match "Total Debit" = "Total Credit" (if there is a difference the app asks) → "Save". Balances for later years carry forward automatically.`,
    prerequisites: [`Chart of Accounts (Ledger Heads) is ready`, `Keep last year's balance sheet in front of you`],
    steps: [
      `Open the **"Opening Balances"** page in the settings part of the menu. Only the admin can enter amounts here.`,
      `Only asset, liability and capital accounts appear on this page — income / expense accounts have no opening. You can pick a type with the filter at the top, or tick **"Only non-zero"**.`,
      `In each account's "Amount (₹)", enter the balance with which the society is starting in the app — that is, the closing balance from the last audited balance sheet. This is entered only the first time (onboarding).`,
      `Check the side in the "Dr / Cr" column — assets come on debit and liabilities / capital on credit automatically; change it if needed.`,
      `Do not enter an amount on an account marked "GROUP" — put the amount on the ledger account inside it. If you entered one by mistake, click **"Clear"** (sets it to 0).`,
      `Look at "Total Debit", "Total Credit" and "Difference" at the top — match them until "Balanced ✓" appears. If a difference remains, the app will ask when you save; save an unbalanced opening only on purpose.`,
      `Click **"Save"** — "Opening balances saved" appears only after all accounts are saved to the cloud. If any account fails to save, all changes are rolled back and a red message appears — save again.`,
      `If last year is also in the app, you do not need to enter anything here — the closing balance of 31 March automatically becomes the opening balance of 1 April (at year end: FY lock → new year → close year). Entering it again counts every entry of last year twice. The **"From audited closing"** button is shown only to a society that is starting for the first time.`,
    ],
    commonMistakes: [
      `Dr and Cr totals not being equal — this is the most common reason for "the balance sheet doesn't tally".`,
      `Putting an account on the wrong side (Cr instead of Dr) — assets are always Dr, liabilities/capital always Cr.`,
    ],
    faqs: [
      {
        q: `When should I enter opening balances?`,
        a: `When starting a new society, or when bringing an existing society into the app for the first time — from last year's closing balances.`,
      },
      {
        q: `The balance sheet doesn't tally, what should I do?`,
        a: `First check total Dr = total Cr in Opening Balances — most differences come from here.`,
      },
      {
        q: `Why are income and expense accounts not on this page?`,
        a: `Income / expense start from zero every year, so they have no opening. The page shows only asset, liability and capital accounts.`,
      },
    ],
    troubleshooting: [
      {
        problem: `On saving, "Cannot set an opening on a group account" appeared.`,
        fix: `Remove the amount from the named group (parent) account with "Clear" (sets it to 0) and put the same amount on the ledger account inside it — reports do not count a group account's opening.`,
      },
      {
        problem: `The boxes to enter amounts are not visible, only ₹ figures are shown.`,
        fix: `Either you are not the admin, or a red line "... is audit-locked" is showing at the top (the year is audit-locked). Ask the admin to fill it in / unlock it.`,
      },
      {
        problem: `An amount remains in "Difference" / the balance sheet doesn't tally.`,
        fix: `An account is missing or on the wrong side. Tick "Only non-zero" and match every amount with last year's balance sheet — the share capital of old members also goes here, in the share capital account.`,
      },
      {
        problem: `After saving, "FY Locked", "No internet — entry paused" or "Update not saved" appeared.`,
        fix: `That account's balance did not reach the cloud. Fix the cause (unlock / internet / "Reload"), refresh the page, enter it again and save.`,
      },
    ],
    deepLinkLabel: `Enter Opening Balances in SahakarLekha`,
  },

  'first-voucher': {
    metaTitle: `How to Make Your First Voucher — Receipt, Payment, Journal | SahakarLekha`,
    metaDescription: `Decide Dr/Cr from "did money come in or go out", and fill receipt/payment/journal vouchers correctly — with examples, for cooperative societies.`,
    title: `How to Make Your First Voucher`,
    estTime: `4 min`,
    tldr: `Vouchers page → in "Easy" mode pick the tile for your task (e.g. "Salary Paid") → enter date and amount → "Save". For bank entries or entries between accounts, use "Expert" mode. The Cash Book and reports update automatically.`,
    prerequisites: [`The required ledger heads are created`],
    steps: [
      `Open the **"Vouchers"** page from the menu — keep **"New Entry"** selected at the top.`,
      `There are two modes at the top: **"Easy"** and **"Expert"**. For the first time, stay on **"Easy"**.`,
      `"Easy" shows two sections — "Money Received (Receipt)" and "Money Paid (Payment)". Click the tile for your task, such as "Rent Received", "Salary Paid" or "Electricity Bill". The tile itself decides which account is Dr and which is Cr, and shows it at the top (these tiles are for cash; for "Cash to Bank" / "Bank → Cash Withdrawal" choose the bank account).`,
      `Fill in "Date" and "Amount (₹)", and write a short reason in "Narration (optional)". If needed, choose a member in "Link to Member (Optional)". Leave "Voucher No." blank — the app gives the next number itself.`,
      `If your account is not in any tile (such as a payment from the bank or an adjustment between accounts), choose **"Expert"**: take one of the tabs **"Receipt" / "Payment" / "Contra" / "Journal"**, fill in account, Dr/Cr and amount on each line; for more lines use **"Add Dr Line"** / **"Add Cr Line"**. The save button turns on only when "Balanced ✓" shows at the bottom. If the account is not in the list, use **"+ Create new account"** right there (admin / accountant) — the account is selected automatically as soon as it is created.`,
      `Click **"Save"**. A green box shows "Voucher saved successfully:" with the number; the voucher goes into the **"List"** and the Cash Book and reports update automatically.`,
      `If someone else should check it, tick "Submit for Approval (Maker-Checker)" — the button becomes **"Submit for Approval"**. If approval is turned on for the society (or the amount is above the set limit), the voucher stays pending and is added to reports only after it is approved on the admin's "Voucher Approval" page.`,
    ],
    commonMistakes: [
      `Getting confused between Receipt and Payment — always think "did money come in or go out".`,
      `Trying to make an entry while the FY is locked — first unlock that year.`,
    ],
    faqs: [
      {
        q: `Which voucher when?`,
        a: `Money came in → Receipt, money went out → Payment, adjustment between accounts without cash → Journal, cash↔bank → Contra.`,
      },
      {
        q: `Do I have to decide Dr/Cr myself?`,
        a: `Not in Easy mode — the app applies it itself. In Expert mode you can make multi-line entries yourself.`,
      },
      {
        q: `A "Date Outside Financial Year" warning appeared — was the voucher saved?`,
        a: `This warning now also appears as "Date outside the current financial year". The voucher is saved (if it is not saved to the cloud, a separate red message appears), but its date is outside the current financial year. Do check the date once.`,
      },
      {
        q: `Why is Journal not shown in "Easy"?`,
        a: `"Easy" mode has only ready-made receipt / payment tiles. For a Journal or an entry with several accounts, use the "Journal" tab in "Expert" mode.`,
      },
    ],
    troubleshooting: [
      {
        problem: `The "Not permitted" toast appeared.`,
        fix: `Your role is not permitted to create vouchers. Ask the admin to give you the right role.`,
      },
      {
        problem: `"FY is Audit-Locked" or "🔒 Period Locked" appeared.`,
        fix: `The year is audit-locked, or your date falls inside a locked period. Enter the correct date, or ask the admin to unlock it.`,
      },
      {
        problem: `The save button does not work / "Debit and Credit totals must be equal" appeared.`,
        fix: `In Expert mode, make the total of the Dr lines equal to the total of the Cr lines — "Difference" at the bottom should become zero and show "Balanced ✓". Also fill in the account and amount on every line.`,
      },
      {
        problem: `"Voucher number already exists" appeared.`,
        fix: `Clear the "Voucher No." box — the app will put the next number automatically.`,
      },
      {
        problem: `"❌ Voucher not saved to the cloud" or "No internet — entry paused" appeared.`,
        fix: `The voucher was not saved — it was not added to the list, but the form you filled stays as it is. After the internet / red banner is fixed ("Reload"), click "Save" again. "Voucher saved" appears only when the cloud save is confirmed.`,
      },
      {
        problem: `"Plan expired" appeared.`,
        fix: `When the plan ends, new entries are blocked, but reports and old data stay visible. Renew the plan.`,
      },
    ],
    deepLinkLabel: `Make a Voucher in SahakarLekha now`,
  },

  'add-ledger': {
    metaTitle: `How to Create a Ledger (Account) — Cooperative Society Accounting | SahakarLekha`,
    metaDescription: `Create a new ledger head, choose the right group (asset/liability/income/expense/capital) and give it a code — so the account shows in the right place in every voucher and report.`,
    title: `How to Create a Ledger (Account)`,
    estTime: `3 min`,
    tldr: `Open the Ledger Heads page → "Add New" → choose a name and the right group (asset/liability/income/expense/capital) → save. The account will now show in voucher entry and reports.`,
    prerequisites: [`A standard chart comes ready-made — first check whether the account already exists`],
    steps: [
      `Open **"Ledger Heads"** in the "Operations" part of the menu (the page is called "Ledger Head Management"). This page is shown only to the admin and accountant.`,
      `First check in the "Search by name or code..." box that the account is not already created — accounts like Cash and Bank already exist.`,
      `Click the **"Add New"** button — the "Add New Ledger Account" form opens.`,
      `Always fill in **"Name (English)"**; fill in "Name (Hindi)" if you want.`,
      `Choose the **"Account Type"** — Capital (Equity), Asset, Liability, Income or Expense. The type cannot be changed later in edit, so choose carefully.`,
      `In **"Parent Group"**, choose the group this account will sit under (only groups of the same type are shown), or "None (Top Level)". The app gives the account code itself.`,
      `Tick "This is a Group (sub-accounts will go under it)" only if you need to create more accounts inside it — a group takes no direct entries. Do not tick it for an ordinary account. If you want, fill in "Opening Balance" and "Balance Type" (Debit Dr / Credit Cr) here too.`,
      `Click **"Save"** — "Account added" appears and the account becomes available in voucher entry and reports.`,
    ],
    commonMistakes: [
      `Putting the account in the wrong group — it then goes into the wrong report (such as expense instead of income).`,
      `Making a copy of the system's ready-made accounts (Cash, Bank etc.) — first check that the account does not already exist.`,
    ],
    faqs: [
      {
        q: `Which group should I put the account in?`,
        a: `What you have / are to receive = asset; what you have to pay = liability; earnings = income; spending = expense; members' capital/reserves = capital.`,
      },
      {
        q: `Can the type be changed after the account is created?`,
        a: `No. "Edit Account" changes only the name, parent group, the group mark and the opening balance. An account that has entries or an opening cannot be made a group either.`,
      },
      {
        q: `What if I want to delete an account?`,
        a: `The system's ready-made accounts cannot be deleted ("Cannot delete system account"). Before deleting a group, its sub-accounts have to be deleted.`,
      },
    ],
    troubleshooting: [
      {
        problem: `"Please fill required fields" appeared.`,
        fix: `Fill in both "Name (English)" and "Account Type".`,
      },
      {
        problem: `"Account name already exists" appeared.`,
        fix: `An account with this name already exists (capital and small letters are treated the same). Use the existing account or give a different name.`,
      },
      {
        problem: `In a voucher, "... is a group account — direct entries are not allowed" appeared.`,
        fix: `You ticked "This is a Group" on the account. Create a ledger account inside it and make the entry on that, or (if there is no account inside it) edit it and remove the group tick.`,
      },
      {
        problem: `"Ledger Heads" does not show in the menu at all.`,
        fix: `This page is available only to the admin / accountant role. Ask the admin to create the account or change your role.`,
      },
      {
        problem: `"FY Locked", "No internet — entry paused" or "Account not saved" appeared.`,
        fix: `The account was not created (it will not appear in the list). Get the year unlocked, or create it again after the internet / "Reload" is fixed.`,
      },
    ],
    deepLinkLabel: `Create a new account in SahakarLekha`,
  },

  'view-trial-balance': {
    metaTitle: `How to View the Trial Balance — Cooperative Society | SahakarLekha`,
    metaDescription: `Open the Trial Balance, pick the "as on" date, check total Dr = total Cr — and download the PDF. Where to look first if it doesn't tally.`,
    title: `How to View the Trial Balance`,
    estTime: `2 min`,
    tldr: `Open the Trial Balance → pick the "As on Date" → every account's Dr/Cr balance is shown; at the bottom Total Debit should equal Total Credit. Clicking an account name opens its ledger; download with "PDF".`,
    steps: [
      `Open **"Trial Balance"** in the "Reports" part of the menu.`,
      `In "As on Date", pick the date up to which you want the accounts — the last date of the financial year is filled in to start with.`,
      `At the top, a green strip "Trial Balance is Balanced" or a red strip "Trial Balance is NOT Balanced!" (with the difference) will appear.`,
      `The table has two sections — "Section I — Liabilities & Income" and "Section II — Assets & Expenditure". For every account it shows the opening balance, debit (Dr), credit (Cr) and closing balance.`,
      `Click an account's name — that account's ledger opens, where every entry is shown.`,
      `Look at "Total Debit", "Total Credit" and "Difference" at the bottom — the difference should be zero.`,
      `Use **"PDF"** to download a copy with the society's name and signature spaces for the Accountant / Secretary-Manager / President; use **"Print"** to print directly. **"Excel"** / **"CSV"** are shown to users who have export permission.`,
    ],
    commonMistakes: [`Panicking when Dr=Cr doesn't tally — it is usually a difference in the Opening Balance; check there first.`],
    faqs: [
      {
        q: `Why is the Trial Balance important?`,
        a: `It quickly shows whether all entries are balanced (Dr=Cr) — an essential check before preparing the balance sheet.`,
      },
      {
        q: `Why can't I see the Excel / CSV buttons?`,
        a: `They are shown only to roles that have export permission. "PDF" and "Print" are available to everyone.`,
      },
    ],
    troubleshooting: [
      {
        problem: `The red strip "Trial Balance is NOT Balanced!" is showing.`,
        fix: `Most differences come from the opening — look at "Difference" on the "Opening Balances" page and make Total Debit = Total Credit. If an opening is sitting on a group account, move it to a ledger account.`,
      },
      {
        problem: `Under an account it says "⚠ Entries on a group account — make it a ledger in Ledger Heads".`,
        fix: `That account carries the "group" mark but has entries. Edit it in Ledger Heads and remove the group tick.`,
      },
      {
        problem: `A voucher is not included in the Trial Balance.`,
        fix: `Check: the voucher's date is not after the "As on Date"; the voucher has not been cancelled; or it is not still pending for approval (get it approved on the "Voucher Approval" page).`,
      },
      {
        problem: `The red banner "Data did not fully load — entry is paused" is showing at the top.`,
        fix: `The figures on screen may be incomplete — do not rely on the Trial Balance in this state. Click "Reload", then look again.`,
      },
    ],
    deepLinkLabel: `View the Trial Balance in SahakarLekha`,
  },

  'cash-book': {
    metaTitle: `How to View the Cash Book — Cooperative Society | SahakarLekha`,
    metaDescription: `See every cash receipt and payment with the running balance. The Cash Book is built from vouchers automatically — no need to fill it by hand.`,
    title: `How to View the Cash Book`,
    estTime: `2 min`,
    tldr: `Open the Cash Book page → pick a date range → every cash receipt and payment and the running balance are shown. It is built automatically from receipt/payment vouchers.`,
    steps: [
      `Open the **"Cash Book"** page from the menu.`,
      `The cards at the top show "Total Receipts", "Total Payments" and "Closing" balance for the chosen period.`,
      `For a particular period, fill in "From Date" and "To Date" and click **"Apply Filter"**; to remove the filter, click **"Clear"**.`,
      `In the "Cash Book Details" table the first row is "Opening" (opening balance), then every cash entry — date, voucher no., particulars, receipt (credit side), payment (debit side) and the running balance alongside.`,
      `The Cash Book is built automatically from vouchers that use the cash account — as soon as a cash entry is made from the Vouchers page, a member's receipt or anywhere else, it shows here.`,
      `To make a small cash entry right here, click **"New Entry"** → in "New Cash Entry" fill in date, type (Receipt / Payment), "Other Account", amount and narration and click **"Save"**. This also creates a voucher.`,
      `For a report, use the **"PDF"**, **"Print"**, **"Excel"** or **"CSV"** buttons.`,
    ],
    commonMistakes: [`Trying to reconcile the Cash Book by hand — if something looks wrong, look for it in the voucher entries, not here.`],
    faqs: [
      {
        q: `Difference between the Cash Book and the Bank Book?`,
        a: `The Cash Book shows only cash (the Cash account); the Bank Book shows receipts and payments of the bank account.`,
      },
      {
        q: `How do I correct a wrong entry in the Cash Book?`,
        a: `The Cash Book cannot be edited directly. Open that voucher in the "List" on the "Vouchers" page and edit or cancel it — the Cash Book will correct itself.`,
      },
    ],
    troubleshooting: [
      {
        problem: `"Please fill all fields" appeared in "New Entry".`,
        fix: `Choose the "Other Account" and enter an amount greater than zero.`,
      },
      {
        problem: `"Entry NOT saved" appeared.`,
        fix: `The message just above it gives the real reason — "Not permitted" (role), "FY is Audit-Locked", "Plan expired" or "No internet — entry paused". Fix that reason and try again.`,
      },
      {
        problem: `The "Opening" balance is wrong.`,
        fix: `Check the cash account's amount and side (debit) on the "Opening Balances" page. If a single branch is selected, the opening may show 0 — the opening is treated as belonging to the Head Office.`,
      },
      {
        problem: `An entry is not showing in the Cash Book.`,
        fix: `Check: a date filter is not applied (click "Clear"); if the entry was through the bank it will show in the Bank Book; the voucher has not been cancelled; or it is not still pending for approval.`,
      },
    ],
    deepLinkLabel: `View the Cash Book in SahakarLekha`,
  },

  'bank-reconciliation': {
    metaTitle: `How to Do a Bank Reconciliation (BRS) — Cooperative Society | SahakarLekha`,
    metaDescription: `Match the bank statement with the books — spot uncleared cheques, bank charges and missed entries, and tally the bank balance in minutes.`,
    title: `How to Do a Bank Reconciliation`,
    estTime: `6 min`,
    tldr: `Open the Bank Reconciliation page → choose the bank account and date → match with the statement; spot uncleared cheques and bank charges so that the book balance and bank balance agree.`,
    steps: [
      `Open **"Bank Reconciliation"** from the menu — the page is titled "Bank Reconciliation Statement".`,
      `At the top, choose the **"Bank Account"** and in **"As of Date"** enter the date up to which you want to reconcile.`,
      `Enter the last balance of the passbook/bank statement in **"Passbook / Statement Balance (₹)"**.`,
      `If you want, choose the statement file in **"Import Bank Statement (CSV / Excel)"** (columns: Date, Description, Debit, Credit, Balance) — vouchers that match are cleared automatically.`,
      `Below, in the **"Deposits in Transit — not yet credited in statement"** and **"Outstanding Cheques — not yet presented to bank"** lists, tick the **"Clear"** checkbox next to each entry that has already appeared in the passbook.`,
      `In **"Unmatched statement lines"**, for a line like bank charges/interest choose the **"Contra account"** and click **"Post"** — a voucher is created and that line clears automatically.`,
      `When "Difference" in the **"Reconciliation Statement"** is zero, "Reconciled" appears. Then click **"Save reconciliation (sign-off)"** and, if needed, take out the **"BRS statement (PDF)"**.`,
    ],
    commonMistakes: [`Forgetting to enter bank charges/interest in the books — this is the most common difference.`],
    faqs: [
      {
        q: `Why doesn't the balance tally?`,
        a: `Usually because of uncleared cheques or bank charges — identify both and adjust.`,
      },
      {
        q: `Where will I find a saved BRS later?`,
        a: `On the same page, in the "Saved reconciliations (audit log)" list — you can take out the PDF again from there.`,
      },
    ],
    troubleshooting: [
      {
        problem: `While saving, the message "Enter the statement balance first" or "Select a bank account" appeared.`,
        fix: `Choose the bank account at the top and enter the passbook balance, then click "Save reconciliation (sign-off)" again.`,
      },
      {
        problem: `On clicking "Post", "Pick a contra account" or "Entry NOT posted" appeared.`,
        fix: `First choose that line's "Contra account" (such as bank charges). If "Entry NOT posted" still appears, read the other message above it — the reason will be one of "Not permitted" (role), "FY Locked" or "Plan expired".`,
      },
      {
        problem: `A "FY Locked" message appeared and nothing can be saved or ticked.`,
        fix: `The financial year is audit-locked, so changes are blocked. The admin must unlock the year you want to reconcile; only then can changes be made.`,
      },
      {
        problem: `A red strip "You are offline — entry is paused" or "Data did not fully load — entry is paused" appeared at the top.`,
        fix: `Check the internet or click **"Reload"**. Until then the figures on screen may be incomplete — do not rely on them.`,
      },
      {
        problem: `The difference still does not become zero.`,
        fix: `Check that no cheque/deposit was marked "Clear" by mistake (you can bring it back by unticking the checkbox in the "Cleared Transactions" list), and that no passbook entry is missing from the books.`,
      },
    ],
    deepLinkLabel: `Do a BRS in SahakarLekha`,
  },

  'loan-entry': {
    metaTitle: `How to Make a Loan Entry — Member Loans, Cooperative Society | SahakarLekha`,
    metaDescription: `Record a new loan — member, amount, interest rate and date. The disbursement voucher is created automatically so the loan shows as an asset in the balance sheet.`,
    title: `How to Make a Loan Entry`,
    estTime: `4 min`,
    tldr: `Loan Register → "New Loan" → fill in member, amount, interest rate, disbursement date and due date → "Save". The disbursement voucher is created automatically; recoveries are recorded with the "Repay" button on that loan's row.`,
    steps: [
      `Open the **"Loan Register"** page from the menu.`,
      `Click **"New Loan"** at the top right — the "Add New Loan" form opens.`,
      `Choose the **"Member *"**, and fill in the **"Loan Type"** (Short-term / Medium-term / Long-term) and **"Interest Rate (% p.a.)"**.`,
      `Fill in **"Amount (₹) *"**, **"Disbursement Date *"** and **"Due Date *"** — all three are required. If you want, also write the "Purpose" and "Security / Collateral".`,
      `Click **"Save"** — the loan is added to the Loan Register and the disbursement payment voucher (Dr: Loans & Advances, Cr: Cash) is created automatically.`,
      `If the loan was given from the bank, change Cash to the bank account in the disbursement voucher that was created.`,
      `When a recovery comes in, click **"Repay"** on that loan's row, fill in the total amount and "Of which interest (optional)", choose cash/bank and click **"Save & Post"** — the receipt voucher is created automatically.`,
      `To calculate interest, use the **"Loan Interest"** page.`,
    ],
    commonMistakes: [`Treating a loan as an expense — a loan is an **asset** (it has to come back), not an expense.`],
    faqs: [
      {
        q: `Why does "This loan cannot be deleted" appear when deleting a loan?`,
        a: `Repayments are recorded on that loan. First cancel those repayment receipts from the "Vouchers" page, then delete the loan — so the books keep tallying.`,
      },
      {
        q: `Do I need to create a separate voucher for a repayment?`,
        a: `No. When you record it with the "Repay" button on the loan's row, the receipt voucher is created automatically.`,
      },
    ],
    troubleshooting: [
      {
        problem: `The message "Please fill required fields" appeared.`,
        fix: `Fill in all three — member, amount and due date; without them the loan is not saved.`,
      },
      {
        problem: `"Repaid amount cannot exceed the loan amount" or, in a repayment, "Principal exceeds outstanding" appeared.`,
        fix: `Make the repaid amount less than the loan. In a repayment, write the amount above the outstanding in "Of which interest" or reduce the total repayment.`,
      },
      {
        problem: `A "FY Locked" or "Not permitted" message appeared.`,
        fix: `The financial year is audit-locked or your role is not permitted to make entries — ask the admin to check the lock/role. Note that in this case the loan has not been saved, even if some other message appears — check the list.`,
      },
      {
        problem: `The message "Loan saved, voucher skipped" appeared.`,
        fix: `The "Loans & Advances" account was not found in the chart of accounts, so the disbursement voucher was not created. Add that account and create the disbursement voucher by hand, otherwise this loan will not show in the Trial Balance.`,
      },
      {
        problem: `"Loan not saved" (not saved to the cloud) or "Repayment NOT recorded" appeared.`,
        fix: `The entry was not saved to the cloud and nothing changed in the loan. Check the internet and add it again.`,
      },
    ],
    deepLinkLabel: `Record a Loan in SahakarLekha`,
  },

  'user-permissions': {
    metaTitle: `How to Give User Permissions — Role-Based Access | SahakarLekha`,
    metaDescription: `Give a new user a role (admin/accountant/viewer/auditor) so who can do what stays clear — and reduce the risk of mistakes and tampering.`,
    title: `How to Give User Permissions`,
    estTime: `3 min`,
    tldr: `User Management (admin/Secretary only) → "New User" or edit an existing user → choose name, email, role (16 roles, in 5 groups) and, if needed, branch → "Save". The role decides who can do what.`,
    prerequisites: [`This is only for a user with the admin role`],
    steps: [
      `Open **"User Management"** (User Management) from the menu — this page is shown only to the Admin / Secretary.`,
      `To add a new user, click **"New User"**; to change an existing user, click the edit (pencil) icon on their row.`,
      `Fill in **"Full Name *"**, **"Email *"** and, for a new user, **"Password *"** (at least 6 characters).`,
      `Choose the **"Role"** — the list is in groups: Administration (Admin, Secretary, Manager), Accounts & Cash (Accountant, Cashier), Operations (Store Keeper, Sales Operator, Data Entry Operator etc.), Governance (Chairman, Board Member), Audit & Read-only (CA / Auditor, Internal Auditor, External CA, Viewer).`,
      `If the society has branches, choose a branch in **"Branch restriction"** — the user can then see/enter data only for that branch; for everyone keep "All branches (no restriction)".`,
      `Keep the **"Active"** switch on and click **"Save"** — the message "User added" / "User updated" will appear.`,
      `To take someone off the work, turn off their "Active" switch in the list instead of deleting the user.`,
    ],
    commonMistakes: [`Making everyone admin — give viewer/accountant roles to reduce the risk of mistakes and tampering.`],
    faqs: [
      {
        q: `What can the Auditor role do?`,
        a: `It can only view reports and data, not change them — safe access for audit.`,
      },
      {
        q: `What if a user forgot their password?`,
        a: `Edit their row, enter a new password in "New Password (blank = no change)" and save — the next login will be with the new password.`,
      },
      {
        q: `What can the CA / Auditor role do?`,
        a: `It is in the "Audit & Read-only" group — for viewing data and reports, not for changing entries.`,
      },
    ],
    troubleshooting: [
      {
        problem: `The page says "Admin or Secretary access required".`,
        fix: `Your role is not permitted to create users. Get this done by the society's admin or Secretary.`,
      },
      {
        problem: `"Email already exists", "Valid email required" or "Min 6 characters" appeared.`,
        fix: `Every user's email must be different and in the correct format; keep the password at least 6 characters long.`,
      },
      {
        problem: `The message "Your plan allows up to ... users" appeared.`,
        fix: `Your plan's users are used up. Deactivate an old user or upgrade the plan.`,
      },
      {
        problem: `"Admin" does not show in the role list at all.`,
        fix: `Non-admin persons such as the Secretary cannot give the admin role — only the main admin can give it.`,
      },
      {
        problem: `After a user's email was changed, they cannot log in.`,
        fix: `If the message "Email was not changed" appeared, the email was never changed — log in with the old email. If you change your own email, the app logs you out; log in again with the new email.`,
      },
    ],
    deepLinkLabel: `Give User Permissions in SahakarLekha`,
  },

  'audit-report': {
    metaTitle: `How to Generate an Audit Report/Certificate — Cooperative Society | SahakarLekha`,
    metaDescription: `Generate the audit certificate — financial figures fill in automatically; enter the auditor details and download the PDF. State-wise audit schedules too.`,
    title: `How to Generate an Audit Report`,
    estTime: `5 min`,
    tldr: `Open the Audit Certificate page → financial figures fill in automatically → enter the auditor's details, audit class and remarks → "Download PDF" at the same time (this page does not save the details). Schedules come from the separate "Audit Schedules" page.`,
    prerequisites: [`First complete the year-end closing and FY lock`],
    steps: [
      `Open the **"Audit Certificate"** page from the menu — the society's name and the current financial year show at the top.`,
      `On the right, in **"Financial Summary"**, total income, total expenditure, net surplus/deficit, share capital and active members come **filled in automatically**.`,
      `**"Cash Balance (Cash Book)"** and **"Bank Balance"** also fill in automatically — if needed, you can verify and correct them.`,
      `On the left, fill in **"Auditor Details"**: "Audit From Date", "Audit To Date", "Auditor Name", "Registration / License No.", "Address", "Date of Audit Certificate" and **"Audit Classification (A/B/C/D)"**.`,
      `Write the remarks in **"Auditor's Observations / Remarks"**. This year's objections recorded in the "Audit Register" are added to the report automatically.`,
      `Below, read and check the **"Certificate Text (Preview)"**.`,
      `Click **"Download PDF"** (there are CSV/Excel buttons too). For schedules, take out the PDF/Excel from the separate **"Audit Schedules"** page.`,
    ],
    commonMistakes: [`Generating the report without closing the year — first do the year-end and FY lock so the figures stay fixed.`],
    faqs: [
      {
        q: `Do I have to fill in the figures myself?`,
        a: `The app fills in the main financial figures automatically; you only have to fill in the auditor details.`,
      },
      {
        q: `Do audit objections have to be written separately?`,
        a: `Objections recorded for this year in the "Audit Register" come into the certificate automatically; the strip at the top tells you how many will be included.`,
      },
    ],
    troubleshooting: [
      {
        problem: `After refreshing the page, the auditor's name/remarks I filled in disappeared.`,
        fix: `This page does not save the auditor details — fill in everything and "Download PDF" at the same time, and keep the PDF safe.`,
      },
      {
        problem: `The income/expenditure or surplus figures look wrong.`,
        fix: `These figures come straight from the books — first check the Trial Balance and the Income & Expenditure account, fix missing or wrong entries, then open this page again.`,
      },
      {
        problem: `A red strip "Data did not fully load — entry is paused" appeared at the top.`,
        fix: `In this state the figures on screen may be incomplete — click "Reload" and take out the PDF only after it has fully loaded.`,
      },
      {
        problem: `"Audit Certificate" does not show in the menu at all.`,
        fix: `This page is shown to roles such as admin and accountant. Ask the admin to check your role.`,
      },
    ],
    deepLinkLabel: `Generate an Audit Report in SahakarLekha`,
  },

  'record-purchase': {
    metaTitle: `How to Record a Purchase — Cooperative Society | SahakarLekha`,
    metaDescription: `Record a purchase of goods — supplier, items, rate and (if needed) GST/TDS. The voucher and stock update automatically as soon as you enter it.`,
    title: `How to Record a Purchase`,
    estTime: `4 min`,
    tldr: `Purchases page → in "New Purchase" choose the date and supplier → fill in item, quantity and rate → choose Cash / Bank / Credit → "Save Purchase". The voucher and stock are created automatically; returns go through the Debit Note page.`,
    prerequisites: [`The supplier is already created`, `The item (stock item) is created`],
    steps: [
      `Open **"Purchases"** from the menu (page: "Purchase Management") — the **"New Purchase"** tab will be open.`,
      `Enter the **"Date"** and choose the **"Supplier"**. If it is not in the list, choose **"+ Add new supplier…"** at the very top of the list — fill in name, mobile, GSTIN; it is selected as soon as it is created. If you want, also fill in the supplier's **"Bill / Invoice No."** and **"Bill Date"**.`,
      `Under **"Items"**, on each line **"Select item"**, then fill in **"Qty"** and **"Rate (₹)"** — the amount is calculated automatically. For another line click **"Add Row"**; if the item is not in the list, use **"+ Add new item…"** at the very top of the list (or the line's "+" button) — choosing its **sales account** and **purchase account** is required, so the bill is not held up.`,
      `In **"Amount & Tax Summary"**, enter a discount before GST in **"Trade Discount (₹) — before GST"** and a discount received on the bill after GST in **"Cash Discount (₹) — after GST"** (the cash discount goes to "Discount Received" income; GST/ITC do not change). Fill in CGST/SGST/IGST % and TDS/TCS only when they apply on the bill. **"Round off"** fills automatically to the whole rupee — you can change it by up to ±₹0.99.`,
      `In **"Payment Mode"**, choose **"Cash"**, **"Bank"** or **"Credit"**. If you choose bank, also choose the **"Bank Account"**; write a "Note (optional)" if you want.`,
      `Click **"Save Purchase"** — the purchase number is shown with "Purchase saved successfully". The voucher and stock update automatically.`,
      `To view, PDF, change or delete an old purchase, open the **"Purchase List"** tab. To return goods, record the return from the **"Debit Note (Purchase Return)"** page instead of deleting the purchase.`,
    ],
    commonMistakes: [
      `Also creating a separate manual voucher — this causes a double entry; the purchase creates the voucher itself.`,
      `Filling in the tax fields even when GST does not apply — this shows wrong tax in reports.`,
    ],
    faqs: [
      {
        q: `The supplier is not in the list, what should I do?`,
        a: `First go to the Suppliers page and add a new supplier, then record the purchase.`,
      },
      {
        q: `If I delete a purchase, will the stock go back down?`,
        a: `Yes — deleting a purchase reverses both its voucher and its stock.`,
      },
      {
        q: `What happens to stock when a purchase is changed?`,
        a: `When you edit from the "Purchase List", the old entry is replaced and the stock is re-adjusted automatically.`,
      },
    ],
    troubleshooting: [
      {
        problem: `The message "Please select a supplier" or "Please add at least one item" appeared.`,
        fix: `Choose the supplier and fill in an item with a quantity on at least one line. If the supplier list is empty ("No suppliers — add first"), first add one from the Suppliers page.`,
      },
      {
        problem: `"Purchase not posted" — with "assign a purchase account (group) to these items first" written alongside.`,
        fix: `Set a purchase account (Purchase A/c) on those items in Inventory, then save the purchase again.`,
      },
      {
        problem: `The message "HSN/SAC code required" appeared.`,
        fix: `When GST % is filled in, every item needs an HSN/SAC code. Enter the code on that item in Inventory, or if there is no GST on the bill, keep GST % blank (0).`,
      },
      {
        problem: `The message "⚠️ Bill number already exists" appeared.`,
        fix: `This is only a warning — the purchase was still saved. Check in the "Purchase List" whether the same bill was posted twice; if so, delete the extra one.`,
      },
      {
        problem: `"FY Locked", "🔒 Period Locked", "Not permitted" or a red strip "You are offline — entry is paused" appeared.`,
        fix: `In these cases the purchase is not saved. If the financial year/period is locked, ask the admin to unlock it; get role permission from the admin; and make the entry again once the internet/data has fully loaded ("Reload").`,
      },
      {
        problem: `While deleting a purchase, "Delete the return first" appeared.`,
        fix: `There is an active Debit Note (purchase return) on that bill. First delete it from the returns page, then the purchase can be deleted.`,
      },
    ],
    deepLinkLabel: `Record a Purchase in SahakarLekha`,
  },

  'record-sale': {
    metaTitle: `How to Record a Sale — Cooperative Society | SahakarLekha`,
    metaDescription: `Record a sale of goods — customer, items, rate. The app itself stops sales above stock; the voucher and stock update automatically.`,
    title: `How to Record a Sale`,
    estTime: `4 min`,
    tldr: `Sales page → in "New Sale" choose the customer (or "💵 Cash Customer") → fill in item, quantity and rate → choose Cash / Bank / Credit → "Save Sale". Stock and voucher update automatically; a sale above stock is blocked. Returns go through the Credit Note page.`,
    prerequisites: [`Stock is available for the item`],
    steps: [
      `Open **"Sales"** from the menu (page: "Sale Management") — the **"New Sale"** tab will be open.`,
      `Enter the **"Date"** and choose the **"Customer"**. For a cash sale, **"💵 Cash Customer"** is at the very top of the list; for a new credit customer choose **"+ Add new customer…"** in the list — it is selected as soon as it is created.`,
      `Under **"Items"**, on each line **"Select item"**, then fill in **"Qty"** and **"Rate (₹)"**. For another line click **"Add Row"**. If the item is not found, use **"+ Add new item…"** in the list — create it by choosing the sales and purchase accounts.`,
      `If needed, enter a **"Trade Discount (₹)"** (it is deducted before GST). Fill in CGST/SGST/IGST % only when GST applies on the sale. **"Round off (to the rupee)"** stays on automatically and fills the amount itself — you can change it by up to ±₹0.99 or turn it off.`,
      `In **"Payment Mode"**, choose **"Cash"**, **"Bank"** or **"Credit"** — for bank also choose the **"Bank Account"**. For a credit sale choose the real customer, not "Cash Customer".`,
      `Click **"Save Sale"** — a sale number is generated, the voucher is created and stock goes down automatically. If the quantity is more than the stock, the app will block it.`,
      `From the **"Sale List"** tab, view sales, take out the "Invoice PDF", change or delete them. If the customer returns goods, record the return from the **"Credit Note (Sales Return)"** page; collect credit dues from the **"Receive Payment"** page.`,
    ],
    commonMistakes: [
      `Trying to sell without stock — first record stock through a purchase/adjustment.`,
      `Recording a credit sale as cash — the customer's outstanding will then show wrong.`,
    ],
    faqs: [
      {
        q: `Why can't I sell more than the stock?`,
        a: `The app blocks negative stock so reports stay correct. First increase the stock, then sell.`,
      },
      {
        q: `How do I collect the money for a credit sale later?`,
        a: `"Vouchers" page → "Receive from Customer" to record the recovery bill-wise.`,
      },
      {
        q: `How is stock checked when editing a sale?`,
        a: `In edit, the old sale's quantity is treated as available again, so the app does not block a correct change — it blocks only a real shortage.`,
      },
    ],
    troubleshooting: [
      {
        problem: `The message "Cannot sell more than available stock" appeared.`,
        fix: `The message lists the available and sale quantity for each item. Reduce the quantity, or first record the purchase/stock, then make the sale.`,
      },
      {
        problem: `"Please select a customer" or "Please add at least one item" appeared.`,
        fix: `Choose the customer (or "💵 Cash Customer") and fill in an item and quantity on at least one line.`,
      },
      {
        problem: `"Sale not posted" — with "assign a sales account (group) to these items first" written alongside.`,
        fix: `Set a sales account (Sales A/c) on those items in Inventory, then save the sale again.`,
      },
      {
        problem: `The message "HSN/SAC code required" appeared.`,
        fix: `If GST % is filled in, every item needs an HSN/SAC code — enter it in Inventory, or if there is no GST keep GST % at zero.`,
      },
      {
        problem: `"FY Locked", "🔒 Period Locked", "Not permitted" or a red strip "You are offline — entry is paused" appeared.`,
        fix: `In these cases the sale is not saved. Ask the admin to unlock, get role permission, or make the entry again once the internet/data has fully loaded ("Reload").`,
      },
      {
        problem: `While deleting a sale, "Delete the return first" appeared.`,
        fix: `There is an active Credit Note (sales return) on that bill — first delete it from the returns page, then the sale can be deleted.`,
      },
    ],
    deepLinkLabel: `Record a Sale in SahakarLekha`,
  },
};

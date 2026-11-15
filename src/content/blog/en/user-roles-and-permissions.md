# User roles and permissions: how to give safe access

In a society, more than one person uses the software — the secretary, the accountant, the cashier, the data-entry staff. Giving everyone the right to do everything is not safe — it raises the risk of both mistakes and misuse. This is where **roles** and **permissions** come in. This article explains them in simple language, with practical examples.

## What is a role

A role is a named group of access rights (such as Admin, Accountant, Data-entry) that is given to each user — it decides what that user can see and do. With roles, you do not need to set separate rights for every person — just give them the right role, and their rights are set automatically.

## What is a permission

A permission is the right to do one specific task — such as creating a voucher, viewing a report, giving approval, or deleting. Several permissions together make up a role. In other words, the role is the "post", and the permissions are the "powers" that come with that post.

| Role | Typical access (example) |
| --- | --- |
| Admin | Everything |
| Accountant | Entries, reports, reconciliation |
| Data-entry | Voucher entry only |

> ⚠️ Making everyone Admin for convenience ends all control. Give each role only as much access as it needs (least-privilege).

## Least-privilege — the minimum necessary rights

The most basic principle of security is **least-privilege** — give each person only as much right as their work needs, not one bit more. The reason is simple: the fewer people who hold sensitive rights (delete, change, approve), the lower the risk — whether by mistake or on purpose. Why would a data-entry worker need the right to delete reports or approve transactions? They don't — so don't give it. This is not distrust of anyone, it is protection for everyone — fewer rights also mean a lighter burden of responsibility.

## Common roles in a cooperative society

Each society can create roles to suit its needs, but usually these are the ones:

- **Admin/Secretary:** full management — all modules, settings, user management. This is the most powerful role, so give it to very few people.
- **Accountant:** voucher entry, reports, bank reconciliation — but probably not user management or major settings.
- **Cashier:** only the cash module — receipts/payments, cash book; kept away from the rest.
- **Data entry:** only entering vouchers/data, no deleting or approving.
- **Auditor (view-only):** can see everything but cannot change anything — ideal for audit.

This way everyone can do their own work, but no one has more rights than they need.

## Stronger with maker-checker

Keep sensitive tasks (such as deleting and approval) limited, and add **voucher approval (maker-checker)** — one person makes the entry, another checks it. This stops both mistakes and misuse, and makes the audit trail stronger.

> 🔍 Auditors give weight to role-based access and separation of duties.

The maker-checker principle is simple but powerful — no large or sensitive transaction should be completed by one person alone. One person makes it (maker), another checks and approves it (checker). This way one person's mistake comes to the other's notice, and the room for misuse by any single person shrinks. This control is especially useful for large payments, voucher corrections and deletions. (See: [Internal control in a society](/blog/internal-control-in-cooperatives).)

## Segregation of duties

Another important principle is **segregation of duties** — that is, one person should not do all the steps of a transaction alone. For example, the person who handles cash should not also write its book alone and verify it alone. In the same way, the person who makes a voucher should not approve it. Roles and permissions are the tool for putting this segregation of duties into practice. Even in a small society with few people, splitting key tasks between at least two people adds a big layer of security.

## Risks without proper roles

If everyone is given the same rights (or Admin), several risks arise:

- **Risk of mistakes:** someone may delete or change important data without meaning to.
- **Risk of misuse:** when many people hold sensitive rights, wrongdoing becomes easy.
- **Lack of accountability:** when everyone can change everything, finding out "who did it" is hard.
- **Audit objection:** auditors take a lack of segregation of duties seriously.

So proper roles are not just a convenience — they are a need for security and accountability.

## Role-permission matrix — a sample

Seeing which role has which rights in one table is the clearest way (this is only an example — adjust it for your society):

| Task | Admin/Secretary | Accountant | Cashier | Data entry | Auditor |
| --- | --- | --- | --- | --- | --- |
| Create voucher | ✅ | ✅ | Cash only | ✅ | ❌ |
| Approve voucher | ✅ | ❌ | ❌ | ❌ | ❌ |
| View reports | ✅ | ✅ | Limited | ❌ | ✅ |
| Cash module | ✅ | ✅ | ✅ | ❌ | View |
| Delete | Limited | ❌ | ❌ | ❌ | ❌ |
| User management | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change settings | ✅ | ❌ | ❌ | ❌ | ❌ |

This matrix makes it clear that the most sensitive rights (approval, deletion, user management, settings) are only with the Admin, and the auditor can see everything but change nothing. This balance gives both security and smooth work.

## Roles in a small society

In a small society, one or two people often handle everything, so it may seem roles are not needed. But even there, a few simple steps make a big difference: split key tasks between at least two people (for example, one handles cash, the other checks the books); take a second person's consent on large payments/deletions; and keep a separate login for each person. This way the "two eyes are better than one" principle works even without a complex setup. Keep full Admin rights with just one trusted person (the secretary), and give the rest limited roles — even for a small society this is a big layer of security.

## How to set up roles in a digital system

In good cooperative software, role management is easy: go to user management, create a login for each person, give them a suitable role (such as accountant/cashier/entry), and if needed fine-tune the permissions. Turn on maker-checker for sensitive rights (approval/delete). When staff change, deactivate the old login and create a new one. All this takes just a few minutes, and once set correctly it gives security and clear control for years. (For help, see: [How to give user permissions](/help/user-permissions).)

## How to decide roles — steps

1. **List the tasks:** which tasks happen in the society (entry, approval, reports, cash, settings).
2. **Match people to their tasks:** see what each person actually does.
3. **Create roles:** roles based on tasks (Admin/accountant/cashier/entry/auditor).
4. **Apply least-privilege:** give each role only the permissions it needs.
5. **Limit sensitive rights:** deleting/approval to very few people.
6. **Review from time to time:** keep roles updated as needs change.

## When staff change — removing access

The most overlooked security mistake is not removing the old access of an employee/office-bearer who has left. A login that stays active for someone no longer in the society is a big risk. So as soon as someone leaves a role, remove or deactivate their access at once, and give those rights to the new person. In the same way, every person should have a separate login — a shared login ends accountability (no one can tell who did what). (See: [Data security and backup](/blog/data-security-and-backup).)

## Roles and the audit trail

A big benefit of role-based access is the **audit trail** — when every person has a separate login and fixed rights, the system can record who created or changed which entry, and when. This transparency prevents wrongdoing and makes it easy to reach the root of any problem. On the other hand, with shared logins or the same rights for all, this trail becomes useless. So roles are not just access control, they are also the basis of accountability. (See: [Voucher narration and documents](/blog/voucher-narration-and-documents).)

## An example

Suppose a society has a secretary, an accountant and a data-entry worker. The right setup would be: the secretary gets Admin (everything, but as the approver in maker-checker); the accountant gets entry + reports + reconciliation; the data-entry worker gets only the right to enter vouchers (no deleting/approval). When the data-entry worker creates a voucher, it goes to the secretary for approval (maker-checker). When the worker leaves, their access is removed at once. With this simple setup everyone does their own work, no one can cause a big problem alone, and every change is on record.

## Common mistakes

- **Making everyone Admin** → control is lost; adopt least-privilege.
- **Shared logins** → accountability is lost; a separate login for each person.
- **Giving sensitive rights to everyone** → keep deleting/approval very limited.
- **Not removing access when staff leave** → big risk; remove it at once.
- **Not using maker-checker** → keep two-level checking on big tasks.
- **Not reviewing roles** → update them from time to time.

## Frequently asked questions

**What is the difference between a role and a permission?** — A role is a group of permissions (like a post); a permission is the right to do one specific task.
**Should we make everyone Admin?** — No; adopt least-privilege — only as much access as needed.
**Should everyone get delete rights?** — No; keep sensitive permissions like deleting/approval very limited.
**What is least-privilege?** — Giving each person only as much right as their work needs — the backbone of security.
**What is maker-checker?** — One person makes the entry, another checks and approves it — this stops both mistakes and misuse.
**Why is segregation of duties needed?** — So that one person does not do all the steps of a transaction alone; both risk and suspicion go down.
**What to do when staff leave?** — Remove/deactivate their access at once, and give the rights to the new person.
**Why not a shared login?** — With it you cannot tell "who did what"; keep a separate login for each person.
**Does a small society also need roles?** — Yes; at least split key tasks between two people and keep separate logins — this is a big layer of security.
**How hard is it to set up roles?** — It isn't; in good software, creating a login for each person and giving a suitable role takes just a few minutes.

## Three things to remember
- 🧩 Role = a group of permissions; permission = the right to do one task.
- 🔐 Least-privilege — only as much access as needed; a separate login for each person.
- ✅ Sensitive rights limited + maker-checker; remove access when staff leave.

## In the end
Proper roles and permissions keep data safe and control clear — and make audit easier. This is not a complex system; just remember three principles — least-privilege (only as much right as needed), segregation of duties (one task not in one pair of hands), and maker-checker with separate logins. In a society that follows them, everyone does their work without hindrance, no one can cause a big problem alone, and every change is on record — this is the foundation of safe, transparent and trustworthy management.

Remember one thing — roles and permissions are not a sign of distrust in anyone, they are protection for the whole team. When everyone's rights are clear and limited, no one makes a big mistake unknowingly, no one is suspected without reason, and the record of every task stays clean. This clarity is the mark of a healthy, trustworthy and audit-ready society — and setting it up takes just a few minutes.

> ✅ Safe, role-based access — [register on SahakarLekha](/register).

**Further reading:** [Data security and backup](/blog/data-security-and-backup) · [Internal control in a society](/blog/internal-control-in-cooperatives) · [Voucher narration and documents](/blog/voucher-narration-and-documents) · [Audit preparation](/blog/audit-preparation-checklist)

**Related terms:** [User role](/glossary/user-role) · [User permission](/glossary/user-permission) · [Voucher approval](/glossary/voucher-approval) · [least-privilege](/glossary/least-privilege) · [Maker-Checker](/glossary/maker-checker)

**Help page:** [How to give user permissions](/help/user-permissions)

> 📘 Source: active Knowledge Items (KI-000310/311/065) — Evidence Level A (educational).

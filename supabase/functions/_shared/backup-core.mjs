// src/lib/export/entities/core.ts
var c = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var money = (key, header, headerHi, over = {}) => c(key, header, headerHi, { type: "currency", ...over });
var internal = (key, header, headerHi, over = {}) => c(key, header, headerHi, { defaultVisible: false, ...over });
var society = {
  key: "society",
  table: "society_settings",
  domain: "core",
  label: "Society Settings",
  labelHi: "\u0938\u092E\u093F\u0924\u093F \u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938",
  minRole: "admin",
  scope: "society",
  nature: "master",
  dependsOn: [],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c("id", "ID", "\u0906\u0908\u0921\u0940"),
    c("name", "Society Name", "\u0938\u092E\u093F\u0924\u093F \u0915\u093E \u0928\u093E\u092E"),
    c("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    c("registrationNo", "Registration No.", "\u092A\u0902\u091C\u0940\u0915\u0930\u0923 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c("societyType", "Society Type", "\u0938\u092E\u093F\u0924\u093F \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c("financialYear", "Financial Year", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937"),
    c("financialYearStart", "FY Start", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937 \u092A\u094D\u0930\u093E\u0930\u0902\u092D", { type: "date" }),
    c("previousFinancialYear", "Previous FY", "\u092A\u093F\u091B\u0932\u093E \u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937"),
    c("address", "Address", "\u092A\u0924\u093E", { piiClass: "contact" }),
    c("district", "District", "\u091C\u093C\u093F\u0932\u093E"),
    c("state", "State", "\u0930\u093E\u091C\u094D\u092F"),
    c("pinCode", "PIN Code", "\u092A\u093F\u0928 \u0915\u094B\u0921"),
    c("phone", "Phone", "\u092B\u093C\u094B\u0928", { piiClass: "contact" }),
    c("email", "Email", "\u0908\u092E\u0947\u0932", { piiClass: "contact" }),
    internal("previousYearBalances", "Previous Year Balances", "\u092A\u093F\u091B\u0932\u0947 \u0935\u0930\u094D\u0937 \u0915\u0947 \u0936\u0947\u0937", { type: "json" }),
    internal("boardType", "Board Type", "\u092C\u094B\u0930\u094D\u0921 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    internal("boardMembers", "Board Members", "\u092C\u094B\u0930\u094D\u0921 \u0938\u0926\u0938\u094D\u092F", { type: "json", piiClass: "contact" }),
    internal("signatories", "Signatories", "\u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930\u0915\u0930\u094D\u0924\u093E", { type: "json", piiClass: "contact" }),
    internal("approvalRequired", "Approval Required", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u0906\u0935\u0936\u094D\u092F\u0915", { type: "boolean" }),
    internal("approvalThresholdAmount", "Approval Threshold", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u0938\u0940\u092E\u093E", { type: "currency" }),
    internal("approvalVoucherTypes", "Approval Voucher Types", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u0935\u093E\u0909\u091A\u0930 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "json" }),
    internal("is_locked", "FY Locked", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937 \u0932\u0949\u0915", { type: "boolean" }),
    internal("periodLockDate", "Period Lock Date", "\u0905\u0935\u0927\u093F \u0932\u0949\u0915 \u0924\u093F\u0925\u093F", { type: "date" }),
    internal("periodLockBy", "Period Locked By", "\u0905\u0935\u0927\u093F \u0932\u0949\u0915 \u0926\u094D\u0935\u093E\u0930\u093E"),
    internal("fyUnlockRequestedAt", "FY Unlock Requested At", "\u0905\u0928\u0932\u0949\u0915 \u0905\u0928\u0941\u0930\u094B\u0927 \u0938\u092E\u092F", { type: "date" }),
    internal("fyUnlockRequestedBy", "FY Unlock Requested By", "\u0905\u0928\u0932\u0949\u0915 \u0905\u0928\u0941\u0930\u094B\u0927 \u0926\u094D\u0935\u093E\u0930\u093E"),
    internal("storageLossNormPct", "Storage Loss Norm %", "\u092D\u0902\u0921\u093E\u0930\u0923 \u0939\u093E\u0928\u093F \u092E\u093E\u0928\u0915 %", { type: "number" }),
    internal("maxSharePremiumPercent", "Max Share Premium %", "\u0905\u0927\u093F\u0915\u0924\u092E \u0936\u0947\u092F\u0930 \u092A\u094D\u0930\u0940\u092E\u093F\u092F\u092E %", { type: "number" }),
    internal("notificationChannels", "Notification Channels", "\u0938\u0942\u091A\u0928\u093E \u091A\u0948\u0928\u0932", { type: "json" }),
    internal("plan", "Plan", "\u092F\u094B\u091C\u0928\u093E", { type: "enum" }),
    internal("plan_expires_at", "Plan Expires", "\u092F\u094B\u091C\u0928\u093E \u0938\u092E\u093E\u092A\u094D\u0924\u093F", { type: "date" }),
    internal("trial_ends_at", "Trial Ends", "\u091F\u094D\u0930\u093E\u092F\u0932 \u0938\u092E\u093E\u092A\u094D\u0924\u093F", { type: "date" }),
    internal("subscription_notes", "Subscription Notes", "\u0938\u0926\u0938\u094D\u092F\u0924\u093E \u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    internal("created_at", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var account = {
  key: "account",
  table: "accounts",
  domain: "core",
  label: "Chart of Accounts",
  labelHi: "\u0916\u093E\u0924\u093E \u0936\u0940\u0930\u094D\u0937\u0915",
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c("id", "Account Code", "\u0916\u093E\u0924\u093E \u0915\u094B\u0921"),
    c("name", "Account Name", "\u0916\u093E\u0924\u093E \u0928\u093E\u092E"),
    c("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    c("type", "Type", "\u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c("subtype", "Sub-type", "\u0909\u092A-\u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    money("openingBalance", "Opening Balance", "\u0913\u092A\u0928\u093F\u0902\u0917 \u092C\u0948\u0932\u0947\u0902\u0938"),
    c("openingBalanceType", "Dr / Cr", "\u0928\u093E\u092E\u0947 / \u091C\u092E\u093E", { type: "enum" }),
    c("parentId", "Parent Group", "\u092E\u0942\u0932 \u0938\u092E\u0942\u0939"),
    c("isGroup", "Is Group", "\u0938\u092E\u0942\u0939 \u0939\u0948", { type: "boolean" }),
    internal("isSystem", "System Account", "\u0938\u093F\u0938\u094D\u091F\u092E \u0916\u093E\u0924\u093E", { type: "boolean" })
  ]
};
var voucher = {
  key: "voucher",
  table: "vouchers",
  domain: "core",
  label: "Vouchers",
  labelHi: "\u0935\u093E\u0909\u091A\u0930",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "account", "member"],
  naturalKey: ["voucherNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c("voucherNo", "Voucher No.", "\u0935\u093E\u0909\u091A\u0930 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c("type", "Voucher Type", "\u0935\u093E\u0909\u091A\u0930 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    money("amount", "Amount", "\u0930\u093E\u0936\u093F"),
    c("debitAccountId", "Debit Account", "\u0928\u093E\u092E\u0947 \u0916\u093E\u0924\u093E"),
    c("creditAccountId", "Credit Account", "\u091C\u092E\u093E \u0916\u093E\u0924\u093E"),
    c("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    internal("lines", "Voucher Lines", "\u0935\u093E\u0909\u091A\u0930 \u092A\u0902\u0915\u094D\u0924\u093F\u092F\u093E\u0901", { type: "json" }),
    internal("billAllocations", "Bill Allocations", "\u092C\u093F\u0932 \u0906\u0935\u0902\u091F\u0928", { type: "json" }),
    internal("refType", "Reference Type", "\u0938\u0902\u0926\u0930\u094D\u092D \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    internal("refId", "Reference ID", "\u0938\u0902\u0926\u0930\u094D\u092D \u0906\u0908\u0921\u0940"),
    internal("origin", "Origin", "\u0938\u094D\u0930\u094B\u0924", { type: "enum" }),
    internal("groupId", "Group ID", "\u0938\u092E\u0942\u0939 \u0906\u0908\u0921\u0940"),
    internal("branchId", "Branch", "\u0936\u093E\u0916\u093E"),
    internal("workOrderId", "Work Order", "\u0915\u093E\u0930\u094D\u092F \u0906\u0926\u0947\u0936"),
    internal("costCentreId", "Cost Centre", "\u0932\u093E\u0917\u0924 \u0915\u0947\u0902\u0926\u094D\u0930"),
    c("isDeleted", "Cancelled", "\u0930\u0926\u094D\u0926", { type: "boolean", defaultVisible: false }),
    internal("deletedAt", "Cancelled At", "\u0930\u0926\u094D\u0926 \u0938\u092E\u092F", { type: "date" }),
    internal("deletedBy", "Cancelled By", "\u0930\u0926\u094D\u0926 \u0926\u094D\u0935\u093E\u0930\u093E"),
    internal("deletedReason", "Cancellation Reason", "\u0930\u0926\u094D\u0926 \u0915\u093E\u0930\u0923"),
    internal("reversalOf", "Reversal Of", "\u092A\u094D\u0930\u0924\u093F\u0935\u0930\u094D\u0924\u0928 \u0915\u093E"),
    internal("reversedBy", "Reversed By", "\u092A\u094D\u0930\u0924\u093F\u0935\u0930\u094D\u0924\u093F\u0924 \u0926\u094D\u0935\u093E\u0930\u093E"),
    internal("approvalStatus", "Approval Status", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal("approvedBy", "Approved By", "\u0905\u0928\u0941\u092E\u094B\u0926\u0915"),
    internal("approvedAt", "Approved At", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u0938\u092E\u092F", { type: "date" }),
    internal("approvalRemarks", "Approval Remarks", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    internal("isCleared", "Bank Cleared", "\u092C\u0948\u0902\u0915 \u0915\u094D\u0932\u093F\u092F\u0930", { type: "boolean" }),
    internal("clearedDate", "Cleared Date", "\u0915\u094D\u0932\u093F\u092F\u0930 \u0924\u093F\u0925\u093F", { type: "date" }),
    internal("editHistory", "Edit History", "\u0938\u0902\u092A\u093E\u0926\u0928 \u0907\u0924\u093F\u0939\u093E\u0938", { type: "json" }),
    internal("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal("createdBy", "Created By", "\u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E")
  ]
};
var voucherEntry = {
  key: "voucher_entry",
  table: "voucher_entries",
  domain: "core",
  label: "Voucher Entries (derived)",
  labelHi: "\u0935\u093E\u0909\u091A\u0930 \u092A\u094D\u0930\u0935\u093F\u0937\u094D\u091F\u093F\u092F\u093E\u0901 (\u0935\u094D\u092F\u0941\u0924\u094D\u092A\u0928\u094D\u0928)",
  minRole: "accountant",
  scope: "society",
  nature: "derived",
  dependsOn: ["voucher", "account"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "replay",
  columns: [
    c("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    c("accountId", "Account", "\u0916\u093E\u0924\u093E"),
    money("dr", "Debit", "\u0928\u093E\u092E\u0947"),
    money("cr", "Credit", "\u091C\u092E\u093E"),
    c("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    internal("costCentreId", "Cost Centre", "\u0932\u093E\u0917\u0924 \u0915\u0947\u0902\u0926\u094D\u0930"),
    internal("workOrderId", "Work Order", "\u0915\u093E\u0930\u094D\u092F \u0906\u0926\u0947\u0936")
  ]
};
var societyActivities = {
  key: "society_activity",
  table: "society_activities",
  domain: "core",
  label: "Society Activities",
  labelHi: "\u0938\u092E\u093F\u0924\u093F \u0917\u0924\u093F\u0935\u093F\u0927\u093F\u092F\u093E\u0901",
  minRole: "admin",
  scope: "society",
  nature: "master",
  dependsOn: [],
  naturalKey: ["activity"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c("activity", "Activity", "\u0917\u0924\u093F\u0935\u093F\u0927\u093F", { type: "enum" }),
    c("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal("jurisdiction", "Jurisdiction", "\u0915\u094D\u0937\u0947\u0924\u094D\u0930\u093E\u0927\u093F\u0915\u093E\u0930"),
    internal("enabled_at", "Enabled At", "\u0938\u0915\u094D\u0930\u093F\u092F", { type: "date" }),
    internal("disabled_at", "Disabled At", "\u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F", { type: "date" }),
    internal("config", "Config", "\u0915\u0949\u0928\u094D\u092B\u093C\u093F\u0917", { type: "json" }),
    internal("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E", { type: "boolean" })
  ]
};
var CORE_ENTITIES = [society, account, voucher, voucherEntry, societyActivities];

// src/lib/export/entities/member.ts
var c2 = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var money2 = (key, header, headerHi, over = {}) => c2(key, header, headerHi, { type: "currency", ...over });
var internal2 = (key, header, headerHi, over = {}) => c2(key, header, headerHi, { defaultVisible: false, ...over });
var member = {
  key: "member",
  table: "members",
  domain: "member",
  label: "Members",
  labelHi: "\u0938\u0926\u0938\u094D\u092F",
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["memberId"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c2("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c2("memberId", "Member ID", "\u0938\u0926\u0938\u094D\u092F \u0906\u0908\u0921\u0940"),
    c2("name", "Name", "\u0928\u093E\u092E"),
    c2("fatherName", "Father / Husband Name", "\u092A\u093F\u0924\u093E / \u092A\u0924\u093F \u0915\u093E \u0928\u093E\u092E"),
    c2("memberType", "Member Type", "\u0938\u0926\u0938\u094D\u092F \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c2("joinDate", "Join Date", "\u0938\u0926\u0938\u094D\u092F\u0924\u093E \u0924\u093F\u0925\u093F", { type: "date" }),
    c2("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    // Contact & identity — masked in a Redacted export.
    c2("address", "Address", "\u092A\u0924\u093E", { piiClass: "contact" }),
    c2("phone", "Phone", "\u092B\u093C\u094B\u0928", { piiClass: "contact" }),
    c2("pan", "PAN", "\u092A\u0948\u0928", { piiClass: "identity" }),
    c2("aadhaar", "Aadhaar", "\u0906\u0927\u093E\u0930", { piiClass: "identity", defaultVisible: false }),
    // Share capital.
    money2("shareCapital", "Share Capital", "\u0905\u0902\u0936\u092A\u0942\u0901\u091C\u0940"),
    money2("admissionFee", "Admission Fee", "\u092A\u094D\u0930\u0935\u0947\u0936 \u0936\u0941\u0932\u094D\u0915"),
    c2("shareCertNo", "Share Certificate No.", "\u0905\u0902\u0936 \u092A\u094D\u0930\u092E\u093E\u0923\u092A\u0924\u094D\u0930 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c2("shareCount", "Shares Held", "\u0905\u0902\u0936\u094B\u0902 \u0915\u0940 \u0938\u0902\u0916\u094D\u092F\u093E", { type: "number" }),
    money2("shareFaceValue", "Face Value", "\u0905\u0902\u0915\u093F\u0924 \u092E\u0942\u0932\u094D\u092F"),
    internal2("shareCertStatus", "Certificate Status", "\u092A\u094D\u0930\u092E\u093E\u0923\u092A\u0924\u094D\u0930 \u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal2("shareCertIssuedAt", "Certificate Issued At", "\u092A\u094D\u0930\u092E\u093E\u0923\u092A\u0924\u094D\u0930 \u091C\u093E\u0930\u0940 \u0938\u092E\u092F", { type: "date" }),
    internal2("shareCertReason", "Certificate Reason", "\u092A\u094D\u0930\u092E\u093E\u0923\u092A\u0924\u094D\u0930 \u0915\u093E\u0930\u0923"),
    // Nomination (the Nomination Register report reads these).
    c2("nomineeName", "Nominee Name", "\u0928\u093E\u092E\u093F\u0924\u0940 \u0915\u093E \u0928\u093E\u092E", { piiClass: "contact" }),
    c2("nomineeRelation", "Nominee Relation", "\u0928\u093E\u092E\u093F\u0924\u0940 \u0938\u0902\u092C\u0902\u0927"),
    c2("nomineePhone", "Nominee Phone", "\u0928\u093E\u092E\u093F\u0924\u0940 \u092B\u093C\u094B\u0928", { piiClass: "contact" }),
    internal2("nominees", "Nominees (multi)", "\u0928\u093E\u092E\u093F\u0924\u0940 (\u092C\u0939\u0941)", { type: "json", piiClass: "contact" }),
    internal2("kycStatus", "KYC Status", "\u0915\u0947\u0935\u093E\u0908\u0938\u0940 \u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal2("creditLimit", "Credit Limit", "\u090B\u0923 \u0938\u0940\u092E\u093E", { type: "currency" }),
    internal2("branchId", "Branch", "\u0936\u093E\u0916\u093E"),
    internal2("statusReason", "Status Reason", "\u0938\u094D\u0925\u093F\u0924\u093F \u0915\u093E\u0930\u0923"),
    internal2("statusChangedAt", "Status Changed At", "\u0938\u094D\u0925\u093F\u0924\u093F \u092A\u0930\u093F\u0935\u0930\u094D\u0924\u0928 \u0938\u092E\u092F", { type: "date" }),
    c2("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal2("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var MEMBER_ENTITIES = [member];

// src/lib/export/entities/inventory.ts
var c3 = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var money3 = (key, header, headerHi, over = {}) => c3(key, header, headerHi, { type: "currency", ...over });
var num = (key, header, headerHi, over = {}) => c3(key, header, headerHi, { type: "number", ...over });
var internal3 = (key, header, headerHi, over = {}) => c3(key, header, headerHi, { defaultVisible: false, ...over });
var branch = {
  key: "branch",
  table: "branches",
  domain: "inventory",
  label: "Branches",
  labelHi: "\u0936\u093E\u0916\u093E\u090F\u0901",
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c3("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c3("name", "Branch Name", "\u0936\u093E\u0916\u093E \u0928\u093E\u092E"),
    c3("code", "Branch Code", "\u0936\u093E\u0916\u093E \u0915\u094B\u0921"),
    c3("isHeadOffice", "Head Office", "\u092A\u094D\u0930\u0927\u093E\u0928 \u0915\u093E\u0930\u094D\u092F\u093E\u0932\u092F", { type: "boolean" }),
    c3("address", "Address", "\u092A\u0924\u093E", { piiClass: "contact" }),
    c3("isActive", "Active", "\u0938\u0915\u094D\u0930\u093F\u092F", { type: "boolean" }),
    internal3("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var godown = {
  key: "godown",
  table: "godowns",
  domain: "inventory",
  label: "Godowns",
  labelHi: "\u0917\u094B\u0926\u093E\u092E",
  capability: "warehousing",
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "branch"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c3("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c3("name", "Godown Name", "\u0917\u094B\u0926\u093E\u092E \u0928\u093E\u092E"),
    c3("code", "Godown Code", "\u0917\u094B\u0926\u093E\u092E \u0915\u094B\u0921"),
    c3("branchId", "Branch", "\u0936\u093E\u0916\u093E"),
    c3("address", "Address", "\u092A\u0924\u093E", { piiClass: "contact" }),
    num("capacityMT", "Capacity (MT)", "\u0915\u094D\u0937\u092E\u0924\u093E (\u092E\u0940.\u091F\u0928)"),
    c3("isActive", "Active", "\u0938\u0915\u094D\u0930\u093F\u092F", { type: "boolean" }),
    internal3("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var stockItem = {
  key: "stock_item",
  table: "stock_items",
  domain: "inventory",
  label: "Stock Items",
  labelHi: "\u0938\u094D\u091F\u0949\u0915 \u0906\u0907\u091F\u092E",
  capability: "inventory_sales",
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "account"],
  naturalKey: ["itemCode"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c3("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c3("itemCode", "Item Code", "\u0906\u0907\u091F\u092E \u0915\u094B\u0921"),
    c3("name", "Item Name", "\u0906\u0907\u091F\u092E \u0928\u093E\u092E"),
    c3("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    c3("stockGroup", "Stock Group", "\u0938\u094D\u091F\u0949\u0915 \u0938\u092E\u0942\u0939"),
    c3("unit", "Unit", "\u0907\u0915\u093E\u0908"),
    num("openingStock", "Opening Stock", "\u092A\u094D\u0930\u093E\u0930\u0902\u092D\u093F\u0915 \u0938\u094D\u091F\u0949\u0915"),
    // CACHE — canonical value is openingStock + sum(movements). See RULE 2 above.
    internal3("currentStock", "Current Stock (cached)", "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0938\u094D\u091F\u0949\u0915 (\u0915\u0948\u0936\u094D\u0921)", { type: "number" }),
    money3("purchaseRate", "Purchase Rate", "\u0915\u094D\u0930\u092F \u0926\u0930"),
    money3("saleRate", "Sale Rate", "\u0935\u093F\u0915\u094D\u0930\u092F \u0926\u0930"),
    c3("isActive", "Active", "\u0938\u0915\u094D\u0930\u093F\u092F", { type: "boolean" }),
    // RULE 4: per-item ledger routing. Default 4101 / 5101 when unset.
    internal3("salesAccountId", "Sales Account", "\u0935\u093F\u0915\u094D\u0930\u092F \u0916\u093E\u0924\u093E"),
    internal3("purchaseAccountId", "Purchase Account", "\u0915\u094D\u0930\u092F \u0916\u093E\u0924\u093E")
  ]
};
var stockMovement = {
  key: "stock_movement",
  table: "stock_movements",
  domain: "inventory",
  label: "Stock Movements",
  labelHi: "\u0938\u094D\u091F\u0949\u0915 \u0938\u0902\u091A\u0932\u0928",
  capability: "inventory_sales",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "stock_item", "godown"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c3("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c3("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c3("itemId", "Item", "\u0906\u0907\u091F\u092E"),
    c3("type", "Movement Type", "\u0938\u0902\u091A\u0932\u0928 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    num("qty", "Quantity", "\u092E\u093E\u0924\u094D\u0930\u093E"),
    money3("rate", "Rate", "\u0926\u0930"),
    money3("amount", "Amount", "\u0930\u093E\u0936\u093F"),
    c3("referenceNo", "Reference No.", "\u0938\u0902\u0926\u0930\u094D\u092D \u0938\u0902\u0916\u094D\u092F\u093E"),
    c3("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    internal3("godownId", "Godown", "\u0917\u094B\u0926\u093E\u092E"),
    internal3("batchNo", "Batch No.", "\u092C\u0948\u091A \u0938\u0902\u0916\u094D\u092F\u093E"),
    internal3("expiryDate", "Expiry Date", "\u0938\u092E\u093E\u092A\u094D\u0924\u093F \u0924\u093F\u0925\u093F", { type: "date" }),
    internal3("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var INVENTORY_ENTITIES = [branch, godown, stockItem, stockMovement];

// src/lib/export/entities/trade.ts
var c4 = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var money4 = (key, header, headerHi, over = {}) => c4(key, header, headerHi, { type: "currency", ...over });
var num2 = (key, header, headerHi, over = {}) => c4(key, header, headerHi, { type: "number", ...over });
var internal4 = (key, header, headerHi, over = {}) => c4(key, header, headerHi, { defaultVisible: false, ...over });
var taxColumns = () => [
  money4("totalAmount", "Total Amount", "\u0915\u0941\u0932 \u0930\u093E\u0936\u093F"),
  money4("discount", "Discount", "\u091B\u0942\u091F"),
  money4("netAmount", "Net Amount", "\u0936\u0941\u0926\u094D\u0927 \u0930\u093E\u0936\u093F"),
  internal4("cgstPct", "CGST %", "\u0938\u0940\u091C\u0940\u090F\u0938\u091F\u0940 %", { type: "number" }),
  internal4("sgstPct", "SGST %", "\u090F\u0938\u091C\u0940\u090F\u0938\u091F\u0940 %", { type: "number" }),
  internal4("igstPct", "IGST %", "\u0906\u0908\u091C\u0940\u090F\u0938\u091F\u0940 %", { type: "number" }),
  money4("cgstAmount", "CGST", "\u0938\u0940\u091C\u0940\u090F\u0938\u091F\u0940"),
  money4("sgstAmount", "SGST", "\u090F\u0938\u091C\u0940\u090F\u0938\u091F\u0940"),
  money4("igstAmount", "IGST", "\u0906\u0908\u091C\u0940\u090F\u0938\u091F\u0940"),
  internal4("tdsPct", "TDS %", "\u091F\u0940\u0921\u0940\u090F\u0938 %", { type: "number" }),
  money4("tdsAmount", "TDS", "\u091F\u0940\u0921\u0940\u090F\u0938"),
  money4("taxAmount", "Total Tax", "\u0915\u0941\u0932 \u0915\u0930"),
  money4("grandTotal", "Grand Total", "\u092E\u0939\u093E\u092F\u094B\u0917")
];
var partyColumns = (codeKey, codeHeader, codeHeaderHi) => [
  c4("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
  c4(codeKey, codeHeader, codeHeaderHi),
  c4("name", "Name", "\u0928\u093E\u092E"),
  c4("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
  internal4("legalName", "Legal Name", "\u0935\u0948\u0927\u093E\u0928\u093F\u0915 \u0928\u093E\u092E"),
  internal4("tradeName", "Trade Name", "\u0935\u094D\u092F\u093E\u092A\u093E\u0930\u093F\u0915 \u0928\u093E\u092E"),
  internal4("mailingName", "Mailing Name", "\u0921\u093E\u0915 \u0928\u093E\u092E"),
  c4("address", "Address", "\u092A\u0924\u093E", { piiClass: "contact" }),
  internal4("addressLine1", "Address Line 1", "\u092A\u0924\u093E \u092A\u0902\u0915\u094D\u0924\u093F 1", { piiClass: "contact" }),
  internal4("addressLine2", "Address Line 2", "\u092A\u0924\u093E \u092A\u0902\u0915\u094D\u0924\u093F 2", { piiClass: "contact" }),
  c4("city", "City", "\u0936\u0939\u0930"),
  c4("state", "State", "\u0930\u093E\u091C\u094D\u092F"),
  internal4("country", "Country", "\u0926\u0947\u0936"),
  internal4("pincode", "PIN Code", "\u092A\u093F\u0928 \u0915\u094B\u0921"),
  c4("phone", "Phone", "\u092B\u093C\u094B\u0928", { piiClass: "contact" }),
  internal4("mobile", "Mobile", "\u092E\u094B\u092C\u093E\u0907\u0932", { piiClass: "contact" }),
  internal4("landline", "Landline", "\u0932\u0948\u0902\u0921\u0932\u093E\u0907\u0928", { piiClass: "contact" }),
  c4("email", "Email", "\u0908\u092E\u0947\u0932", { piiClass: "contact" }),
  internal4("website", "Website", "\u0935\u0947\u092C\u0938\u093E\u0907\u091F"),
  internal4("contactPerson", "Contact Person", "\u0938\u0902\u092A\u0930\u094D\u0915 \u0935\u094D\u092F\u0915\u094D\u0924\u093F", { piiClass: "contact" }),
  internal4("contactDesignation", "Designation", "\u092A\u0926\u0928\u093E\u092E"),
  c4("gstin", "GSTIN", "\u091C\u0940\u090F\u0938\u091F\u0940\u0906\u0908\u090F\u0928", { piiClass: "identity" }),
  c4("pan", "PAN", "\u092A\u0948\u0928", { piiClass: "identity" }),
  internal4("registrationType", "GST Registration Type", "\u091C\u0940\u090F\u0938\u091F\u0940 \u092A\u0902\u091C\u0940\u0915\u0930\u0923 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
  internal4("placeOfSupply", "Place of Supply", "\u0906\u092A\u0942\u0930\u094D\u0924\u093F \u0938\u094D\u0925\u093E\u0928"),
  // Payments dataset — this is why these two entities require `accountant`.
  internal4("bankName", "Bank Name", "\u092C\u0948\u0902\u0915 \u0928\u093E\u092E", { piiClass: "financial" }),
  internal4("accountNo", "Bank Account No.", "\u092C\u0948\u0902\u0915 \u0916\u093E\u0924\u093E \u0938\u0902\u0916\u094D\u092F\u093E", { piiClass: "financial" }),
  internal4("ifsc", "IFSC", "\u0906\u0908\u090F\u092B\u093C\u090F\u0938\u0938\u0940", { piiClass: "financial" }),
  internal4("branch", "Bank Branch", "\u092C\u0948\u0902\u0915 \u0936\u093E\u0916\u093E", { piiClass: "financial" }),
  // NOTE: `beneficiaryName` exists on suppliers ONLY — declared on that entity, not here.
  internal4("upiId", "UPI ID", "\u092F\u0942\u092A\u0940\u0906\u0908 \u0906\u0908\u0921\u0940", { piiClass: "financial" }),
  internal4("accountId", "Ledger Account", "\u092C\u0939\u0940 \u0916\u093E\u0924\u093E"),
  money4("openingBalance", "Opening Balance", "\u0913\u092A\u0928\u093F\u0902\u0917 \u092C\u0948\u0932\u0947\u0902\u0938"),
  internal4("openingBalanceType", "Dr / Cr", "\u0928\u093E\u092E\u0947 / \u091C\u092E\u093E", { type: "enum" }),
  internal4("creditDays", "Credit Days", "\u0909\u0927\u093E\u0930 \u0926\u093F\u0928", { type: "number" }),
  internal4("creditLimit", "Credit Limit", "\u0909\u0927\u093E\u0930 \u0938\u0940\u092E\u093E", { type: "currency" }),
  internal4("discountPercent", "Discount %", "\u091B\u0942\u091F %", { type: "number" }),
  internal4("tdsApplicable", "TDS Applicable", "\u091F\u0940\u0921\u0940\u090F\u0938 \u0932\u093E\u0917\u0942", { type: "boolean" }),
  internal4("tcsApplicable", "TCS Applicable", "\u091F\u0940\u0938\u0940\u090F\u0938 \u0932\u093E\u0917\u0942", { type: "boolean" }),
  internal4("notes", "Notes", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
  c4("isActive", "Active", "\u0938\u0915\u094D\u0930\u093F\u092F", { type: "boolean" }),
  internal4("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
];
var supplier = {
  key: "supplier",
  table: "suppliers",
  domain: "trade",
  label: "Suppliers",
  labelHi: "\u0906\u092A\u0942\u0930\u094D\u0924\u093F\u0915\u0930\u094D\u0924\u093E",
  minRole: "accountant",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "account"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    ...partyColumns("supplierCode", "Supplier Code", "\u0906\u092A\u0942\u0930\u094D\u0924\u093F\u0915\u0930\u094D\u0924\u093E \u0915\u094B\u0921"),
    // Supplier-only bank column (customers have no beneficiaryName in the schema).
    internal4("beneficiaryName", "Beneficiary Name", "\u0932\u093E\u092D\u093E\u0930\u094D\u0925\u0940 \u0928\u093E\u092E", { piiClass: "financial" }),
    internal4("supplierType", "Supplier Type", "\u0906\u092A\u0942\u0930\u094D\u0924\u093F\u0915\u0930\u094D\u0924\u093E \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    internal4("tdsSection", "TDS Section", "\u091F\u0940\u0921\u0940\u090F\u0938 \u0927\u093E\u0930\u093E"),
    internal4("salesRep", "Sales Rep", "\u0935\u093F\u0915\u094D\u0930\u092F \u092A\u094D\u0930\u0924\u093F\u0928\u093F\u0927\u093F"),
    internal4("gstNo", "GST No. (legacy)", "\u091C\u0940\u090F\u0938\u091F\u0940 \u0938\u0902\u0916\u094D\u092F\u093E (\u092A\u0941\u0930\u093E\u0928\u093E)", { piiClass: "identity" })
  ]
};
var customer = {
  key: "customer",
  table: "customers",
  domain: "trade",
  label: "Customers",
  labelHi: "\u0917\u094D\u0930\u093E\u0939\u0915",
  minRole: "accountant",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "account"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    ...partyColumns("customerCode", "Customer Code", "\u0917\u094D\u0930\u093E\u0939\u0915 \u0915\u094B\u0921"),
    internal4("customerType", "Customer Type", "\u0917\u094D\u0930\u093E\u0939\u0915 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    internal4("gstNo", "GST No. (legacy)", "\u091C\u0940\u090F\u0938\u091F\u0940 \u0938\u0902\u0916\u094D\u092F\u093E (\u092A\u0941\u0930\u093E\u0928\u093E)", { piiClass: "identity" })
  ]
};
var sale = {
  key: "sale",
  table: "sales",
  domain: "trade",
  label: "Sales",
  labelHi: "\u092C\u093F\u0915\u094D\u0930\u0940",
  capability: "inventory_sales",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "customer", "member", "voucher"],
  naturalKey: ["saleNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c4("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c4("saleNo", "Sale No.", "\u092C\u093F\u0915\u094D\u0930\u0940 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c4("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c4("customerName", "Customer", "\u0917\u094D\u0930\u093E\u0939\u0915"),
    c4("customerPhone", "Customer Phone", "\u0917\u094D\u0930\u093E\u0939\u0915 \u092B\u093C\u094B\u0928", { piiClass: "contact" }),
    internal4("customerId", "Customer Ref", "\u0917\u094D\u0930\u093E\u0939\u0915 \u0938\u0902\u0926\u0930\u094D\u092D"),
    internal4("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    internal4("items", "Line Items", "\u092A\u0902\u0915\u094D\u0924\u093F \u0906\u0907\u091F\u092E", { type: "json" }),
    ...taxColumns(),
    c4("paymentMode", "Payment Mode", "\u092D\u0941\u0917\u0924\u093E\u0928 \u092E\u093E\u0927\u094D\u092F\u092E", { type: "enum" }),
    c4("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    internal4("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    internal4("gstVoucherIds", "GST Vouchers", "\u091C\u0940\u090F\u0938\u091F\u0940 \u0935\u093E\u0909\u091A\u0930", { type: "json" }),
    internal4("branchId", "Branch", "\u0936\u093E\u0916\u093E"),
    c4("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal4("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal4("createdBy", "Created By", "\u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E")
  ]
};
var purchase = {
  key: "purchase",
  table: "purchases",
  domain: "trade",
  label: "Purchases",
  labelHi: "\u0916\u0930\u0940\u0926",
  capability: "inventory_sales",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "supplier", "voucher"],
  naturalKey: ["purchaseNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c4("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c4("purchaseNo", "Purchase No.", "\u0916\u0930\u0940\u0926 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c4("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c4("supplierName", "Supplier", "\u0906\u092A\u0942\u0930\u094D\u0924\u093F\u0915\u0930\u094D\u0924\u093E"),
    c4("supplierPhone", "Supplier Phone", "\u0906\u092A\u0942\u0930\u094D\u0924\u093F\u0915\u0930\u094D\u0924\u093E \u092B\u093C\u094B\u0928", { piiClass: "contact" }),
    internal4("supplierId", "Supplier Ref", "\u0906\u092A\u0942\u0930\u094D\u0924\u093F\u0915\u0930\u094D\u0924\u093E \u0938\u0902\u0926\u0930\u094D\u092D"),
    internal4("items", "Line Items", "\u092A\u0902\u0915\u094D\u0924\u093F \u0906\u0907\u091F\u092E", { type: "json" }),
    ...taxColumns(),
    internal4("rcmApplicable", "RCM Applicable", "\u0906\u0930\u0938\u0940\u090F\u092E \u0932\u093E\u0917\u0942", { type: "boolean" }),
    c4("paymentMode", "Payment Mode", "\u092D\u0941\u0917\u0924\u093E\u0928 \u092E\u093E\u0927\u094D\u092F\u092E", { type: "enum" }),
    c4("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    internal4("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    internal4("taxVoucherIds", "Tax Vouchers", "\u0915\u0930 \u0935\u093E\u0909\u091A\u0930", { type: "json" }),
    internal4("branchId", "Branch", "\u0936\u093E\u0916\u093E"),
    c4("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal4("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal4("createdBy", "Created By", "\u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E")
  ]
};
var returnTaxColumns = () => [
  money4("netAmount", "Net Amount", "\u0936\u0941\u0926\u094D\u0927 \u0930\u093E\u0936\u093F"),
  money4("cgstAmount", "CGST", "\u0938\u0940\u091C\u0940\u090F\u0938\u091F\u0940"),
  money4("sgstAmount", "SGST", "\u090F\u0938\u091C\u0940\u090F\u0938\u091F\u0940"),
  money4("igstAmount", "IGST", "\u0906\u0908\u091C\u0940\u090F\u0938\u091F\u0940"),
  money4("taxAmount", "Total Tax", "\u0915\u0941\u0932 \u0915\u0930"),
  money4("grandTotal", "Grand Total", "\u092E\u0939\u093E\u092F\u094B\u0917"),
  c4("refundMode", "Refund Mode", "\u0935\u093E\u092A\u0938\u0940 \u092E\u093E\u0927\u094D\u092F\u092E", { type: "enum" }),
  internal4("bankAccountId", "Bank Account", "\u092C\u0948\u0902\u0915 \u0916\u093E\u0924\u093E"),
  internal4("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
  c4("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
  internal4("createdBy", "Created By", "\u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E"),
  internal4("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
];
var salesReturn = {
  key: "sales_return",
  table: "sales_returns",
  domain: "trade",
  label: "Sales Returns",
  labelHi: "\u092C\u093F\u0915\u094D\u0930\u0940 \u0935\u093E\u092A\u0938\u0940",
  capability: "inventory_sales",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "sale", "voucher"],
  naturalKey: ["returnNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c4("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c4("returnNo", "Return No.", "\u0935\u093E\u092A\u0938\u0940 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c4("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    internal4("originalSaleId", "Original Sale", "\u092E\u0942\u0932 \u092C\u093F\u0915\u094D\u0930\u0940"),
    c4("saleNo", "Sale No.", "\u092C\u093F\u0915\u094D\u0930\u0940 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c4("customerName", "Customer", "\u0917\u094D\u0930\u093E\u0939\u0915"),
    internal4("customerId", "Customer Ref", "\u0917\u094D\u0930\u093E\u0939\u0915 \u0938\u0902\u0926\u0930\u094D\u092D"),
    internal4("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    internal4("items", "Line Items", "\u092A\u0902\u0915\u094D\u0924\u093F \u0906\u0907\u091F\u092E", { type: "json" }),
    ...returnTaxColumns()
  ]
};
var purchaseReturn = {
  key: "purchase_return",
  table: "purchase_returns",
  domain: "trade",
  label: "Purchase Returns",
  labelHi: "\u0916\u0930\u0940\u0926 \u0935\u093E\u092A\u0938\u0940",
  capability: "inventory_sales",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "purchase", "voucher"],
  naturalKey: ["returnNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c4("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c4("returnNo", "Return No.", "\u0935\u093E\u092A\u0938\u0940 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c4("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    internal4("originalPurchaseId", "Original Purchase", "\u092E\u0942\u0932 \u0916\u0930\u0940\u0926"),
    c4("purchaseNo", "Purchase No.", "\u0916\u0930\u0940\u0926 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c4("supplierName", "Supplier", "\u0906\u092A\u0942\u0930\u094D\u0924\u093F\u0915\u0930\u094D\u0924\u093E"),
    internal4("supplierId", "Supplier Ref", "\u0906\u092A\u0942\u0930\u094D\u0924\u093F\u0915\u0930\u094D\u0924\u093E \u0938\u0902\u0926\u0930\u094D\u092D"),
    internal4("items", "Line Items", "\u092A\u0902\u0915\u094D\u0924\u093F \u0906\u0907\u091F\u092E", { type: "json" }),
    ...returnTaxColumns()
  ]
};
var hsn = {
  key: "hsn",
  table: "hsn_master",
  domain: "trade",
  label: "HSN / SAC Master",
  labelHi: "\u090F\u091A\u090F\u0938\u090F\u0928 / \u090F\u0938\u090F\u0938\u0940 \u092E\u093E\u0938\u094D\u091F\u0930",
  capability: "gst",
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["code"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c4("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c4("code", "HSN / SAC Code", "\u090F\u091A\u090F\u0938\u090F\u0928 / \u090F\u0938\u090F\u0938\u0940 \u0915\u094B\u0921"),
    c4("description", "Description", "\u0935\u093F\u0935\u0930\u0923"),
    c4("type", "Type", "\u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    num2("gstRate", "GST Rate %", "\u091C\u0940\u090F\u0938\u091F\u0940 \u0926\u0930 %"),
    num2("cess", "Cess %", "\u0909\u092A\u0915\u0930 %"),
    internal4("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var TRADE_ENTITIES = [
  supplier,
  customer,
  sale,
  purchase,
  salesReturn,
  purchaseReturn,
  hsn
];

// src/lib/export/entities/lending.ts
var c5 = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var money5 = (key, header, headerHi, over = {}) => c5(key, header, headerHi, { type: "currency", ...over });
var num3 = (key, header, headerHi, over = {}) => c5(key, header, headerHi, { type: "number", ...over });
var internal5 = (key, header, headerHi, over = {}) => c5(key, header, headerHi, { defaultVisible: false, ...over });
var loan = {
  key: "loan",
  table: "loans",
  domain: "lending",
  label: "Loans",
  labelHi: "\u090B\u0923",
  capability: "lending",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "member"],
  naturalKey: ["loanNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c5("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c5("loanNo", "Loan No.", "\u090B\u0923 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c5("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    c5("loanType", "Loan Type", "\u090B\u0923 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c5("purpose", "Purpose", "\u0909\u0926\u094D\u0926\u0947\u0936\u094D\u092F"),
    money5("amount", "Loan Amount", "\u090B\u0923 \u0930\u093E\u0936\u093F"),
    num3("interestRate", "Interest Rate %", "\u092C\u094D\u092F\u093E\u091C \u0926\u0930 %"),
    c5("disbursementDate", "Disbursement Date", "\u0935\u093F\u0924\u0930\u0923 \u0924\u093F\u0925\u093F", { type: "date" }),
    c5("dueDate", "Due Date", "\u0926\u0947\u092F \u0924\u093F\u0925\u093F", { type: "date" }),
    // Running total — reconcile against repayment vouchers, not this column.
    internal5("repaidAmount", "Repaid (cached)", "\u091A\u0941\u0915\u093E\u092F\u093E \u0917\u092F\u093E (\u0915\u0948\u0936\u094D\u0921)", { type: "currency" }),
    c5("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c5("security", "Security", "\u092A\u094D\u0930\u0924\u093F\u092D\u0942\u0924\u093F"),
    c5("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal5("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var kccLoan = {
  key: "kcc_loan",
  table: "kcc_loans",
  domain: "lending",
  label: "KCC Loans",
  labelHi: "\u0915\u0947\u0938\u0940\u0938\u0940 \u090B\u0923",
  capability: "lending",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "member", "voucher"],
  naturalKey: ["loanNo"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c5("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c5("loanNo", "Loan No.", "\u090B\u0923 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c5("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    c5("memberName", "Member Name", "\u0938\u0926\u0938\u094D\u092F \u0928\u093E\u092E"),
    c5("cropName", "Crop", "\u092B\u0938\u0932"),
    c5("cropSeason", "Season", "\u092E\u094C\u0938\u092E", { type: "enum" }),
    num3("landAreaHectares", "Land Area (Ha)", "\u092D\u0942\u092E\u093F \u0915\u094D\u0937\u0947\u0924\u094D\u0930 (\u0939\u0948.)"),
    money5("sanctionedAmount", "Sanctioned", "\u0938\u094D\u0935\u0940\u0915\u0943\u0924 \u0930\u093E\u0936\u093F"),
    money5("drawnAmount", "Drawn", "\u0906\u0939\u0930\u093F\u0924 \u0930\u093E\u0936\u093F"),
    internal5("repaidAmount", "Repaid (cached)", "\u091A\u0941\u0915\u093E\u092F\u093E \u0917\u092F\u093E (\u0915\u0948\u0936\u094D\u0921)", { type: "currency" }),
    internal5("outstandingAmount", "Outstanding (cached)", "\u092C\u0915\u093E\u092F\u093E (\u0915\u0948\u0936\u094D\u0921)", { type: "currency" }),
    num3("interestRate", "Interest Rate %", "\u092C\u094D\u092F\u093E\u091C \u0926\u0930 %"),
    c5("disbursementDate", "Disbursement Date", "\u0935\u093F\u0924\u0930\u0923 \u0924\u093F\u0925\u093F", { type: "date" }),
    c5("dueDate", "Due Date", "\u0926\u0947\u092F \u0924\u093F\u0925\u093F", { type: "date" }),
    c5("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c5("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    internal5("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    internal5("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal5("createdBy", "Created By", "\u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E")
  ]
};
var depositAccount = {
  key: "deposit_account",
  table: "deposit_accounts",
  domain: "lending",
  label: "Deposit Accounts",
  labelHi: "\u091C\u092E\u093E \u0916\u093E\u0924\u0947",
  capability: "lending",
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "member"],
  naturalKey: ["accountNo"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c5("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c5("accountNo", "Account No.", "\u0916\u093E\u0924\u093E \u0938\u0902\u0916\u094D\u092F\u093E"),
    c5("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    c5("depositType", "Deposit Type", "\u091C\u092E\u093E \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c5("openDate", "Open Date", "\u0916\u094B\u0932\u0928\u0947 \u0915\u0940 \u0924\u093F\u0925\u093F", { type: "date" }),
    // Running total — the canonical balance is the sum of deposit_transactions.
    internal5("balance", "Balance (cached)", "\u0936\u0947\u0937 (\u0915\u0948\u0936\u094D\u0921)", { type: "currency" }),
    num3("interestRate", "Interest Rate %", "\u092C\u094D\u092F\u093E\u091C \u0926\u0930 %"),
    c5("maturityDate", "Maturity Date", "\u092A\u0930\u093F\u092A\u0915\u094D\u0935\u0924\u093E \u0924\u093F\u0925\u093F", { type: "date" }),
    money5("installmentAmount", "Installment", "\u0915\u093F\u0938\u094D\u0924 \u0930\u093E\u0936\u093F"),
    c5("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal5("agent", "Agent", "\u0905\u092D\u093F\u0915\u0930\u094D\u0924\u093E"),
    internal5("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var depositTransaction = {
  key: "deposit_transaction",
  table: "deposit_transactions",
  domain: "lending",
  label: "Deposit Transactions",
  labelHi: "\u091C\u092E\u093E \u0932\u0947\u0928-\u0926\u0947\u0928",
  capability: "lending",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "deposit_account", "voucher"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c5("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c5("depositAccountId", "Deposit Account", "\u091C\u092E\u093E \u0916\u093E\u0924\u093E"),
    c5("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c5("txnType", "Transaction Type", "\u0932\u0947\u0928-\u0926\u0947\u0928 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    money5("amount", "Amount", "\u0930\u093E\u0936\u093F"),
    c5("mode", "Mode", "\u092E\u093E\u0927\u094D\u092F\u092E", { type: "enum" }),
    internal5("balanceAfter", "Balance After", "\u0936\u0947\u0937 \u0909\u092A\u0930\u093E\u0902\u0924", { type: "currency" }),
    internal5("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    internal5("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var LENDING_ENTITIES = [loan, kccLoan, depositAccount, depositTransaction];

// src/lib/export/entities/payroll.ts
var c6 = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var money6 = (key, header, headerHi, over = {}) => c6(key, header, headerHi, { type: "currency", ...over });
var num4 = (key, header, headerHi, over = {}) => c6(key, header, headerHi, { type: "number", ...over });
var internal6 = (key, header, headerHi, over = {}) => c6(key, header, headerHi, { defaultVisible: false, ...over });
var employee = {
  key: "employee",
  table: "employees",
  domain: "payroll",
  label: "Employees",
  labelHi: "\u0915\u0930\u094D\u092E\u091A\u093E\u0930\u0940",
  minRole: "accountant",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["empNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c6("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c6("empNo", "Employee No.", "\u0915\u0930\u094D\u092E\u091A\u093E\u0930\u0940 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c6("name", "Name", "\u0928\u093E\u092E"),
    c6("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    c6("designation", "Designation", "\u092A\u0926\u0928\u093E\u092E"),
    c6("joinDate", "Join Date", "\u0928\u093F\u092F\u0941\u0915\u094D\u0924\u093F \u0924\u093F\u0925\u093F", { type: "date" }),
    money6("basicSalary", "Basic Salary", "\u092E\u0942\u0932 \u0935\u0947\u0924\u0928"),
    c6("phone", "Phone", "\u092B\u093C\u094B\u0928", { piiClass: "contact" }),
    c6("pan", "PAN", "\u092A\u0948\u0928", { piiClass: "identity" }),
    internal6("bankAccount", "Bank Account", "\u092C\u0948\u0902\u0915 \u0916\u093E\u0924\u093E", { piiClass: "financial" }),
    internal6("uan", "UAN", "\u092F\u0942\u090F\u090F\u0928", { piiClass: "identity" }),
    internal6("esiNo", "ESI Number", "\u0908\u090F\u0938\u0906\u0908 \u0938\u0902\u0916\u094D\u092F\u093E", { piiClass: "identity" }),
    internal6("pfApplicable", "PF Applicable", "\u092A\u0940\u090F\u092B \u0932\u093E\u0917\u0942", { type: "boolean" }),
    internal6("esiApplicable", "ESI Applicable", "\u0908\u090F\u0938\u0906\u0908 \u0932\u093E\u0917\u0942", { type: "boolean" }),
    c6("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c6("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false })
  ]
};
var salaryRecord = {
  key: "salary_record",
  table: "salary_records",
  domain: "payroll",
  label: "Salary Records",
  labelHi: "\u0935\u0947\u0924\u0928 \u0930\u093F\u0915\u0949\u0930\u094D\u0921",
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "employee", "voucher"],
  naturalKey: ["slipNo"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c6("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c6("slipNo", "Slip No.", "\u092A\u0930\u094D\u091A\u0940 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c6("employeeId", "Employee", "\u0915\u0930\u094D\u092E\u091A\u093E\u0930\u0940"),
    c6("month", "Month", "\u092E\u093E\u0939"),
    money6("basicSalary", "Basic Salary", "\u092E\u0942\u0932 \u0935\u0947\u0924\u0928"),
    money6("allowances", "Allowances", "\u092D\u0924\u094D\u0924\u0947"),
    internal6("daAllowance", "DA", "\u092E\u0939\u0902\u0917\u093E\u0908 \u092D\u0924\u094D\u0924\u093E", { type: "currency" }),
    internal6("hraAllowance", "HRA", "\u092E\u0915\u093E\u0928 \u0915\u093F\u0930\u093E\u092F\u093E \u092D\u0924\u094D\u0924\u093E", { type: "currency" }),
    internal6("taAllowance", "TA", "\u092F\u093E\u0924\u094D\u0930\u093E \u092D\u0924\u094D\u0924\u093E", { type: "currency" }),
    internal6("otherAllowances", "Other Allowances", "\u0905\u0928\u094D\u092F \u092D\u0924\u094D\u0924\u0947", { type: "currency" }),
    money6("deductions", "Deductions", "\u0915\u091F\u094C\u0924\u093F\u092F\u093E\u0901"),
    internal6("pfDeduction", "PF Deduction", "\u092A\u0940\u090F\u092B \u0915\u091F\u094C\u0924\u0940", { type: "currency" }),
    internal6("pfEmployee", "PF (Employee)", "\u092A\u0940\u090F\u092B (\u0915\u0930\u094D\u092E\u091A\u093E\u0930\u0940)", { type: "currency" }),
    internal6("pfEmployer", "PF (Employer)", "\u092A\u0940\u090F\u092B (\u0928\u093F\u092F\u094B\u0915\u094D\u0924\u093E)", { type: "currency" }),
    internal6("esiEmployee", "ESI (Employee)", "\u0908\u090F\u0938\u0906\u0908 (\u0915\u0930\u094D\u092E\u091A\u093E\u0930\u0940)", { type: "currency" }),
    internal6("esiEmployer", "ESI (Employer)", "\u0908\u090F\u0938\u0906\u0908 (\u0928\u093F\u092F\u094B\u0915\u094D\u0924\u093E)", { type: "currency" }),
    internal6("pt", "Professional Tax", "\u0935\u094D\u092F\u0935\u0938\u093E\u092F \u0915\u0930", { type: "currency" }),
    internal6("tds", "TDS", "\u091F\u0940\u0921\u0940\u090F\u0938", { type: "currency" }),
    internal6("taxDeduction", "Tax Deduction", "\u0915\u0930 \u0915\u091F\u094C\u0924\u0940", { type: "currency" }),
    internal6("otherDeductions", "Other Deductions", "\u0905\u0928\u094D\u092F \u0915\u091F\u094C\u0924\u093F\u092F\u093E\u0901", { type: "currency" }),
    money6("netSalary", "Net Salary", "\u0936\u0941\u0926\u094D\u0927 \u0935\u0947\u0924\u0928"),
    c6("paymentMode", "Payment Mode", "\u092D\u0941\u0917\u0924\u093E\u0928 \u092E\u093E\u0927\u094D\u092F\u092E", { type: "enum" }),
    c6("isPaid", "Paid", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0939\u0941\u0906", { type: "boolean" }),
    c6("paidDate", "Paid Date", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0924\u093F\u0925\u093F", { type: "date" }),
    c6("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    internal6("voucherId", "Payment Voucher", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0935\u093E\u0909\u091A\u0930"),
    internal6("accrualVoucherId", "Accrual Voucher", "\u0909\u092A\u093E\u0930\u094D\u091C\u0928 \u0935\u093E\u0909\u091A\u0930"),
    internal6("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal6("createdBy", "Created By", "\u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E")
  ]
};
var worker = {
  key: "worker",
  table: "workers",
  domain: "payroll",
  label: "Workers",
  labelHi: "\u0936\u094D\u0930\u092E\u093F\u0915",
  capability: "labour",
  minRole: "accountant",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "member"],
  naturalKey: ["workerCode"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c6("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c6("workerCode", "Worker Code", "\u0936\u094D\u0930\u092E\u093F\u0915 \u0915\u094B\u0921"),
    c6("name", "Name", "\u0928\u093E\u092E"),
    internal6("fatherHusbandName", "Father / Husband Name", "\u092A\u093F\u0924\u093E / \u092A\u0924\u093F \u0915\u093E \u0928\u093E\u092E"),
    c6("workerType", "Worker Type", "\u0936\u094D\u0930\u092E\u093F\u0915 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c6("category", "Category", "\u0936\u094D\u0930\u0947\u0923\u0940", { type: "enum" }),
    internal6("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    internal6("gender", "Gender", "\u0932\u093F\u0902\u0917", { type: "enum" }),
    internal6("dateOfBirth", "Date of Birth", "\u091C\u0928\u094D\u092E \u0924\u093F\u0925\u093F", { type: "date", piiClass: "identity" }),
    c6("phone", "Phone", "\u092B\u093C\u094B\u0928", { piiClass: "contact" }),
    internal6("permanentAddress", "Permanent Address", "\u0938\u094D\u0925\u093E\u092F\u0940 \u092A\u0924\u093E", { piiClass: "contact" }),
    c6("pan", "PAN", "\u092A\u0948\u0928", { piiClass: "identity" }),
    internal6("aadhaar", "Aadhaar", "\u0906\u0927\u093E\u0930", { piiClass: "identity" }),
    internal6("idProofType", "ID Proof Type", "\u092A\u0939\u091A\u093E\u0928 \u092A\u094D\u0930\u092E\u093E\u0923 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    internal6("idProofNo", "ID Proof No.", "\u092A\u0939\u091A\u093E\u0928 \u092A\u094D\u0930\u092E\u093E\u0923 \u0938\u0902\u0916\u094D\u092F\u093E", { piiClass: "identity" }),
    internal6("uan", "UAN", "\u092F\u0942\u090F\u090F\u0928", { piiClass: "identity" }),
    internal6("esiIp", "ESI IP Number", "\u0908\u090F\u0938\u0906\u0908 \u0906\u0908\u092A\u0940 \u0938\u0902\u0916\u094D\u092F\u093E", { piiClass: "identity" }),
    internal6("bankAccountNo", "Bank Account No.", "\u092C\u0948\u0902\u0915 \u0916\u093E\u0924\u093E \u0938\u0902\u0916\u094D\u092F\u093E", { piiClass: "financial" }),
    internal6("ifsc", "IFSC", "\u0906\u0908\u090F\u092B\u093C\u090F\u0938\u0938\u0940", { piiClass: "financial" }),
    money6("defaultDailyWage", "Default Daily Wage", "\u092E\u093E\u0928\u0915 \u0926\u0948\u0928\u093F\u0915 \u092E\u091C\u093C\u0926\u0942\u0930\u0940"),
    internal6("joiningDate", "Joining Date", "\u0928\u093F\u092F\u0941\u0915\u094D\u0924\u093F \u0924\u093F\u0925\u093F", { type: "date" }),
    c6("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c6("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal6("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var department = {
  key: "department",
  table: "departments",
  domain: "payroll",
  label: "Departments",
  labelHi: "\u0935\u093F\u092D\u093E\u0917",
  capability: "labour",
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "account"],
  naturalKey: ["departmentCode"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c6("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c6("departmentCode", "Department Code", "\u0935\u093F\u092D\u093E\u0917 \u0915\u094B\u0921"),
    c6("name", "Department Name", "\u0935\u093F\u092D\u093E\u0917 \u0928\u093E\u092E"),
    c6("departmentType", "Department Type", "\u0935\u093F\u092D\u093E\u0917 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    internal6("accountId", "Ledger Account", "\u092C\u0939\u0940 \u0916\u093E\u0924\u093E"),
    c6("contactPerson", "Contact Person", "\u0938\u0902\u092A\u0930\u094D\u0915 \u0935\u094D\u092F\u0915\u094D\u0924\u093F", { piiClass: "contact" }),
    c6("phone", "Phone", "\u092B\u093C\u094B\u0928", { piiClass: "contact" }),
    c6("address", "Address", "\u092A\u0924\u093E", { piiClass: "contact" }),
    c6("gstin", "GSTIN", "\u091C\u0940\u090F\u0938\u091F\u0940\u0906\u0908\u090F\u0928", { piiClass: "identity" }),
    internal6("tdsApplicable", "TDS Applicable", "\u091F\u0940\u0921\u0940\u090F\u0938 \u0932\u093E\u0917\u0942", { type: "boolean" }),
    money6("openingBalance", "Opening Balance", "\u0913\u092A\u0928\u093F\u0902\u0917 \u092C\u0948\u0932\u0947\u0902\u0938"),
    c6("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c6("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal6("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var workOrder = {
  key: "work_order",
  table: "work_orders",
  domain: "payroll",
  label: "Work Orders",
  labelHi: "\u0915\u093E\u0930\u094D\u092F \u0906\u0926\u0947\u0936",
  capability: "labour",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "department"],
  naturalKey: ["workOrderNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c6("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c6("workOrderNo", "Work Order No.", "\u0915\u093E\u0930\u094D\u092F \u0906\u0926\u0947\u0936 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c6("clientName", "Client", "\u0917\u094D\u0930\u093E\u0939\u0915"),
    internal6("departmentId", "Department", "\u0935\u093F\u092D\u093E\u0917"),
    c6("description", "Description", "\u0935\u093F\u0935\u0930\u0923"),
    money6("contractValue", "Contract Value", "\u0905\u0928\u0941\u092C\u0902\u0927 \u092E\u0942\u0932\u094D\u092F"),
    c6("startDate", "Start Date", "\u092A\u094D\u0930\u093E\u0930\u0902\u092D \u0924\u093F\u0925\u093F", { type: "date" }),
    c6("endDate", "End Date", "\u0938\u092E\u093E\u092A\u094D\u0924\u093F \u0924\u093F\u0925\u093F", { type: "date" }),
    c6("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c6("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal6("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var departmentBill = {
  key: "department_bill",
  table: "department_bills",
  domain: "payroll",
  label: "Department Bills",
  labelHi: "\u0935\u093F\u092D\u093E\u0917 \u092C\u093F\u0932",
  capability: "labour",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "department", "work_order", "voucher"],
  naturalKey: ["billNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c6("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c6("billNo", "Bill No.", "\u092C\u093F\u0932 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c6("departmentId", "Department", "\u0935\u093F\u092D\u093E\u0917"),
    internal6("workOrderId", "Work Order", "\u0915\u093E\u0930\u094D\u092F \u0906\u0926\u0947\u0936"),
    c6("billType", "Bill Type", "\u092C\u093F\u0932 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c6("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    money6("amount", "Amount", "\u0930\u093E\u0936\u093F"),
    money6("paidAmount", "Paid Amount", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0930\u093E\u0936\u093F"),
    c6("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c6("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    internal6("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    c6("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal6("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var workerAdvance = {
  key: "worker_advance",
  table: "worker_advances",
  domain: "payroll",
  label: "Worker Advances",
  labelHi: "\u0936\u094D\u0930\u092E\u093F\u0915 \u0905\u0917\u094D\u0930\u093F\u092E",
  capability: "labour",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "worker", "voucher"],
  naturalKey: ["advanceNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c6("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c6("advanceNo", "Advance No.", "\u0905\u0917\u094D\u0930\u093F\u092E \u0938\u0902\u0916\u094D\u092F\u093E"),
    c6("workerId", "Worker", "\u0936\u094D\u0930\u092E\u093F\u0915"),
    c6("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    money6("amount", "Advance Amount", "\u0905\u0917\u094D\u0930\u093F\u092E \u0930\u093E\u0936\u093F"),
    money6("recovered", "Recovered", "\u0935\u0938\u0942\u0932"),
    c6("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c6("mode", "Mode", "\u092E\u093E\u0927\u094D\u092F\u092E", { type: "enum" }),
    c6("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    internal6("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    c6("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal6("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var musterEntry = {
  key: "muster_entry",
  table: "muster_entries",
  domain: "payroll",
  label: "Muster Roll",
  labelHi: "\u0939\u093E\u091C\u093F\u0930\u0940 \u0930\u091C\u093F\u0938\u094D\u091F\u0930",
  capability: "labour",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "work_order", "member", "voucher"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c6("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c6("workOrderId", "Work Order", "\u0915\u093E\u0930\u094D\u092F \u0906\u0926\u0947\u0936"),
    c6("period", "Period", "\u0905\u0935\u0927\u093F"),
    c6("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    num4("daysWorked", "Days Worked", "\u0915\u093E\u0930\u094D\u092F \u0926\u093F\u0935\u0938"),
    money6("dailyWage", "Daily Wage", "\u0926\u0948\u0928\u093F\u0915 \u092E\u091C\u093C\u0926\u0942\u0930\u0940"),
    internal6("workBasis", "Work Basis", "\u0915\u093E\u0930\u094D\u092F \u0906\u0927\u093E\u0930", { type: "enum" }),
    internal6("accrued", "Accrued", "\u0909\u092A\u093E\u0930\u094D\u091C\u093F\u0924", { type: "boolean" }),
    internal6("paid", "Paid", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0939\u0941\u0906", { type: "boolean" }),
    internal6("paidAmount", "Paid Amount", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0930\u093E\u0936\u093F", { type: "currency" }),
    internal6("accrualVoucherId", "Accrual Voucher", "\u0909\u092A\u093E\u0930\u094D\u091C\u0928 \u0935\u093E\u0909\u091A\u0930"),
    internal6("paymentVoucherId", "Payment Voucher", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0935\u093E\u0909\u091A\u0930"),
    c6("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal6("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var pfEsiRun = {
  key: "pf_esi_run",
  table: "pf_esi_runs",
  domain: "payroll",
  label: "PF / ESI Runs",
  labelHi: "\u092A\u0940\u090F\u092B / \u0908\u090F\u0938\u0906\u0908 \u0930\u0928",
  capability: "pf_esi",
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "voucher"],
  naturalKey: ["period"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c6("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c6("period", "Period", "\u0905\u0935\u0927\u093F"),
    money6("grossWages", "Gross Wages", "\u0938\u0915\u0932 \u092E\u091C\u093C\u0926\u0942\u0930\u0940"),
    money6("epfEmployee", "EPF (Employee)", "\u0908\u092A\u0940\u090F\u092B (\u0915\u0930\u094D\u092E\u091A\u093E\u0930\u0940)"),
    money6("epfEmployer", "EPF (Employer)", "\u0908\u092A\u0940\u090F\u092B (\u0928\u093F\u092F\u094B\u0915\u094D\u0924\u093E)"),
    internal6("epfAdminEdli", "EPF Admin + EDLI", "\u0908\u092A\u0940\u090F\u092B \u092A\u094D\u0930\u0936\u093E\u0938\u0928 + \u0908\u0921\u0940\u090F\u0932\u0906\u0908", { type: "currency" }),
    money6("esiEmployee", "ESI (Employee)", "\u0908\u090F\u0938\u0906\u0908 (\u0915\u0930\u094D\u092E\u091A\u093E\u0930\u0940)"),
    money6("esiEmployer", "ESI (Employer)", "\u0908\u090F\u0938\u0906\u0908 (\u0928\u093F\u092F\u094B\u0915\u094D\u0924\u093E)"),
    c6("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal6("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    internal6("depositVoucherId", "Deposit Voucher", "\u091C\u092E\u093E \u0935\u093E\u0909\u091A\u0930"),
    c6("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal6("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var PAYROLL_ENTITIES = [
  employee,
  salaryRecord,
  worker,
  department,
  workOrder,
  departmentBill,
  workerAdvance,
  musterEntry,
  pfEsiRun
];

// src/lib/export/entities/procurement.ts
var c7 = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var internal7 = (key, header, headerHi, over = {}) => c7(key, header, headerHi, { defaultVisible: false, ...over });
var CAP = "procurement_msp";
var farmer = {
  key: "procurement_farmer",
  table: "procurement_farmers",
  domain: "procurement",
  label: "Farmers",
  labelHi: "\u0915\u093F\u0938\u093E\u0928",
  capability: CAP,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["farmerCode"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c7("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c7("farmerCode", "Farmer Code", "\u0915\u093F\u0938\u093E\u0928 \u0915\u094B\u0921"),
    c7("farmerName", "Farmer Name", "\u0915\u093F\u0938\u093E\u0928 \u0915\u093E \u0928\u093E\u092E"),
    c7("fatherName", "Father Name", "\u092A\u093F\u0924\u093E \u0915\u093E \u0928\u093E\u092E"),
    c7("mobile", "Mobile", "\u092E\u094B\u092C\u093E\u0907\u0932", { piiClass: "contact" }),
    internal7("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal7("updatedAt", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928 \u0938\u092E\u092F", { type: "date" })
  ]
};
var lot = {
  key: "procurement_lot",
  table: "procurement_lots",
  domain: "procurement",
  label: "Procurement Lots",
  labelHi: "\u0916\u0930\u0940\u0926 \u0932\u0949\u091F",
  capability: CAP,
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "procurement_farmer"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c7("id", "Lot ID", "\u0932\u0949\u091F \u0906\u0908\u0921\u0940"),
    c7("farmerId", "Farmer", "\u0915\u093F\u0938\u093E\u0928"),
    c7("centreId", "Centre", "\u0915\u0947\u0902\u0926\u094D\u0930"),
    c7("seasonId", "Season", "\u092E\u094C\u0938\u092E"),
    c7("cropId", "Crop", "\u092B\u0938\u0932"),
    c7("varietyId", "Variety", "\u0915\u093F\u0938\u094D\u092E"),
    internal7("arhtiyaId", "Arhtiya", "\u0906\u0922\u093C\u0924\u093F\u092F\u093E"),
    internal7("quantity", "Quantity", "\u092E\u093E\u0924\u094D\u0930\u093E", { type: "json" }),
    internal7("mspRate", "MSP Rate", "\u090F\u092E\u090F\u0938\u092A\u0940 \u0926\u0930", { type: "json" }),
    c7("operationalStatus", "Operational Status", "\u092A\u0930\u093F\u091A\u093E\u0932\u0928 \u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c7("financialStatus", "Financial Status", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c7("reconciliationStatus", "Reconciliation Status", "\u0938\u092E\u093E\u0927\u093E\u0928 \u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal7("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal7("updatedAt", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928 \u0938\u092E\u092F", { type: "date" })
  ]
};
var event = {
  key: "procurement_event",
  table: "procurement_events",
  domain: "procurement",
  label: "Procurement Events",
  labelHi: "\u0916\u0930\u0940\u0926 \u0918\u091F\u0928\u093E\u090F\u0901",
  capability: CAP,
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c7("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c7("name", "Event Name", "\u0918\u091F\u0928\u093E \u0928\u093E\u092E"),
    c7("correlationId", "Correlation ID", "\u0938\u0939\u0938\u0902\u092C\u0902\u0927 \u0906\u0908\u0921\u0940"),
    c7("occurredAt", "Occurred At", "\u0918\u091F\u093F\u0924 \u0938\u092E\u092F", { type: "date" }),
    internal7("recordedAt", "Recorded At", "\u0926\u0930\u094D\u091C \u0938\u092E\u092F", { type: "date" }),
    c7("actor", "Actor", "\u0915\u0930\u094D\u0924\u093E"),
    internal7("payload", "Payload", "\u092A\u0947\u0932\u094B\u0921", { type: "json" })
  ]
};
var qualityTest = {
  key: "procurement_quality_test",
  table: "procurement_quality_tests",
  domain: "procurement",
  label: "Quality Tests",
  labelHi: "\u0917\u0941\u0923\u0935\u0924\u094D\u0924\u093E \u092A\u0930\u0940\u0915\u094D\u0937\u0923",
  capability: CAP,
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "procurement_lot"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c7("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c7("lotId", "Lot", "\u0932\u0949\u091F"),
    c7("result", "Result", "\u092A\u0930\u093F\u0923\u093E\u092E", { type: "enum" }),
    c7("inspectedBy", "Inspected By", "\u0928\u093F\u0930\u0940\u0915\u094D\u0937\u0915"),
    internal7("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal7("updatedAt", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928 \u0938\u092E\u092F", { type: "date" })
  ]
};
var moistureRecord = {
  key: "procurement_moisture_record",
  table: "procurement_moisture_records",
  domain: "procurement",
  label: "Moisture Records",
  labelHi: "\u0928\u092E\u0940 \u0930\u093F\u0915\u0949\u0930\u094D\u0921",
  capability: CAP,
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "procurement_lot"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c7("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c7("lotId", "Lot", "\u0932\u0949\u091F"),
    c7("moisture", "Moisture", "\u0928\u092E\u0940", { type: "json" }),
    internal7("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal7("updatedAt", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928 \u0938\u092E\u092F", { type: "date" })
  ]
};
var jform = {
  key: "procurement_jform",
  table: "procurement_jforms",
  domain: "procurement",
  label: "J-Forms",
  labelHi: "\u091C\u0947-\u092B\u0949\u0930\u094D\u092E",
  capability: CAP,
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "procurement_lot"],
  naturalKey: ["documentNo"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c7("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c7("documentNo", "J-Form No.", "\u091C\u0947-\u092B\u0949\u0930\u094D\u092E \u0938\u0902\u0916\u094D\u092F\u093E"),
    c7("lotId", "Lot", "\u0932\u0949\u091F"),
    internal7("gross", "Gross", "\u0938\u0915\u0932", { type: "json" }),
    internal7("deductions", "Deductions", "\u0915\u091F\u094C\u0924\u093F\u092F\u093E\u0901", { type: "json" }),
    internal7("net", "Net", "\u0936\u0941\u0926\u094D\u0927", { type: "json" }),
    internal7("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal7("updatedAt", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928 \u0938\u092E\u092F", { type: "date" })
  ]
};
var financialIntent = {
  key: "procurement_financial_intent",
  table: "procurement_financial_intents",
  domain: "procurement",
  label: "Financial Intents",
  labelHi: "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0906\u0936\u092F",
  capability: CAP,
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "procurement_lot", "procurement_jform"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c7("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c7("lotId", "Lot", "\u0932\u0949\u091F"),
    c7("jformId", "J-Form", "\u091C\u0947-\u092B\u0949\u0930\u094D\u092E"),
    c7("intentType", "Intent Type", "\u0906\u0936\u092F \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    internal7("amount", "Amount", "\u0930\u093E\u0936\u093F", { type: "json" }),
    internal7("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal7("updatedAt", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928 \u0938\u092E\u092F", { type: "date" })
  ]
};
var postingRequest = {
  key: "procurement_posting_request",
  table: "procurement_posting_requests",
  domain: "procurement",
  label: "Posting Requests",
  labelHi: "\u092A\u094B\u0938\u094D\u091F\u093F\u0902\u0917 \u0905\u0928\u0941\u0930\u094B\u0927",
  capability: CAP,
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "procurement_financial_intent"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c7("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c7("lotId", "Lot", "\u0932\u0949\u091F"),
    c7("jformId", "J-Form", "\u091C\u0947-\u092B\u0949\u0930\u094D\u092E"),
    c7("financialIntentId", "Financial Intent", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0906\u0936\u092F"),
    c7("requestType", "Request Type", "\u0905\u0928\u0941\u0930\u094B\u0927 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    internal7("amount", "Amount", "\u0930\u093E\u0936\u093F", { type: "json" }),
    internal7("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal7("updatedAt", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928 \u0938\u092E\u092F", { type: "date" })
  ]
};
var postingRuleResult = {
  key: "procurement_posting_rule_result",
  table: "procurement_posting_rule_results",
  domain: "procurement",
  label: "Posting Rule Results",
  labelHi: "\u092A\u094B\u0938\u094D\u091F\u093F\u0902\u0917 \u0928\u093F\u092F\u092E \u092A\u0930\u093F\u0923\u093E\u092E",
  capability: CAP,
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "procurement_posting_request"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c7("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c7("postingRequestId", "Posting Request", "\u092A\u094B\u0938\u094D\u091F\u093F\u0902\u0917 \u0905\u0928\u0941\u0930\u094B\u0927"),
    c7("lotId", "Lot", "\u0932\u0949\u091F"),
    c7("jformId", "J-Form", "\u091C\u0947-\u092B\u0949\u0930\u094D\u092E"),
    c7("financialIntentId", "Financial Intent", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0906\u0936\u092F"),
    c7("requestType", "Request Type", "\u0905\u0928\u0941\u0930\u094B\u0927 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    // Which rule profile produced `legs`. This is exactly why the row cannot be replayed.
    c7("profile", "Rule Profile", "\u0928\u093F\u092F\u092E \u092A\u094D\u0930\u094B\u092B\u093C\u093E\u0907\u0932"),
    internal7("legs", "Ledger Legs", "\u092C\u0939\u0940 \u092A\u0902\u0915\u094D\u0924\u093F\u092F\u093E\u0901", { type: "json" }),
    internal7("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal7("updatedAt", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928 \u0938\u092E\u092F", { type: "date" })
  ]
};
var settlement = {
  key: "procurement_settlement",
  table: "procurement_settlements",
  domain: "procurement",
  label: "Farmer Settlements",
  labelHi: "\u0915\u093F\u0938\u093E\u0928 \u092D\u0941\u0917\u0924\u093E\u0928",
  capability: CAP,
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "procurement_jform", "voucher"],
  naturalKey: ["settlementNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c7("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c7("settlementNo", "Settlement No.", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c7("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal7("gross", "Gross", "\u0938\u0915\u0932", { type: "json" }),
    internal7("deductionLines", "Deduction Lines", "\u0915\u091F\u094C\u0924\u0940 \u092A\u0902\u0915\u094D\u0924\u093F\u092F\u093E\u0901", { type: "json" }),
    internal7("netPayable", "Net Payable", "\u0936\u0941\u0926\u094D\u0927 \u0926\u0947\u092F", { type: "json" }),
    internal7("amountPaid", "Amount Paid", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0930\u093E\u0936\u093F", { type: "json" }),
    // The SSOT trace links: engine voucher, then the settlement voucher.
    c7("engineVoucherId", "Engine Voucher", "\u0907\u0902\u091C\u0928 \u0935\u093E\u0909\u091A\u0930"),
    c7("settlementVoucherId", "Settlement Voucher", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0935\u093E\u0909\u091A\u0930"),
    internal7("approvedBy", "Approved By", "\u0905\u0928\u0941\u092E\u094B\u0926\u0915"),
    internal7("approvedAt", "Approved At", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u0938\u092E\u092F", { type: "date" }),
    internal7("createdBy", "Created By", "\u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E"),
    c7("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal7("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal7("updatedAt", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928 \u0938\u092E\u092F", { type: "date" })
  ]
};
var jformCounter = {
  key: "procurement_jform_counter",
  table: "procurement_jform_counters",
  domain: "procurement",
  label: "J-Form Counter",
  labelHi: "\u091C\u0947-\u092B\u0949\u0930\u094D\u092E \u0915\u093E\u0909\u0902\u091F\u0930",
  capability: CAP,
  minRole: "admin",
  scope: "society",
  nature: "system",
  dependsOn: ["society"],
  naturalKey: ["society_id"],
  formats: ["json"],
  backupPolicy: "full",
  columns: [
    c7("society_id", "Society", "\u0938\u092E\u093F\u0924\u093F"),
    c7("last_no", "Last Issued No.", "\u0905\u0902\u0924\u093F\u092E \u091C\u093E\u0930\u0940 \u0938\u0902\u0916\u094D\u092F\u093E", { type: "number" })
  ]
};
var settlementCounter = {
  key: "procurement_settlement_counter",
  table: "procurement_settlement_counters",
  domain: "procurement",
  label: "Settlement Counter",
  labelHi: "\u092D\u0941\u0917\u0924\u093E\u0928 \u0915\u093E\u0909\u0902\u091F\u0930",
  capability: CAP,
  minRole: "admin",
  scope: "society",
  nature: "system",
  dependsOn: ["society"],
  naturalKey: ["society_id"],
  formats: ["json"],
  backupPolicy: "full",
  columns: [
    c7("society_id", "Society", "\u0938\u092E\u093F\u0924\u093F"),
    c7("last_no", "Last Issued No.", "\u0905\u0902\u0924\u093F\u092E \u091C\u093E\u0930\u0940 \u0938\u0902\u0916\u094D\u092F\u093E", { type: "number" })
  ]
};
var PROCUREMENT_ENTITIES = [
  farmer,
  lot,
  event,
  qualityTest,
  moistureRecord,
  jform,
  financialIntent,
  postingRequest,
  postingRuleResult,
  settlement,
  jformCounter,
  settlementCounter
];

// src/lib/export/entities/dairy.ts
var c8 = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var money7 = (key, header, headerHi, over = {}) => c8(key, header, headerHi, { type: "currency", ...over });
var num5 = (key, header, headerHi, over = {}) => c8(key, header, headerHi, { type: "number", ...over });
var internal8 = (key, header, headerHi, over = {}) => c8(key, header, headerHi, { defaultVisible: false, ...over });
var CAP2 = "dairy_collection";
var rateChart = {
  key: "dairy_rate_chart",
  table: "dairy_rate_charts",
  domain: "dairy",
  label: "Rate Charts",
  labelHi: "\u0926\u0930 \u091A\u093E\u0930\u094D\u091F",
  capability: CAP2,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c8("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c8("name", "Chart Name", "\u091A\u093E\u0930\u094D\u091F \u0928\u093E\u092E"),
    c8("basis", "Basis", "\u0906\u0927\u093E\u0930", { type: "enum" }),
    c8("effectiveFrom", "Effective From", "\u092A\u094D\u0930\u092D\u093E\u0935\u0940 \u0924\u093F\u0925\u093F", { type: "date" }),
    c8("season", "Season", "\u092E\u094C\u0938\u092E", { type: "enum" }),
    internal8("fatBands", "Fat Bands", "\u0935\u0938\u093E \u092C\u0948\u0902\u0921", { type: "json" }),
    internal8("snfBands", "SNF Bands", "\u090F\u0938\u090F\u0928\u090F\u092B \u092C\u0948\u0902\u0921", { type: "json" }),
    internal8("matrix", "Rate Matrix", "\u0926\u0930 \u092E\u0948\u091F\u094D\u0930\u093F\u0915\u094D\u0938", { type: "json" }),
    c8("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal8("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var milkEntry = {
  key: "milk_entry",
  table: "milk_entries",
  domain: "dairy",
  label: "Milk Collection",
  labelHi: "\u0926\u0942\u0927 \u0938\u0902\u0917\u094D\u0930\u0939",
  capability: CAP2,
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "member", "dairy_rate_chart"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c8("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c8("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c8("shift", "Shift", "\u092A\u093E\u0932\u0940", { type: "enum" }),
    c8("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    c8("memberName", "Member Name", "\u0938\u0926\u0938\u094D\u092F \u0928\u093E\u092E"),
    num5("qty", "Quantity (L)", "\u092E\u093E\u0924\u094D\u0930\u093E (\u0932\u0940.)"),
    num5("fat", "Fat %", "\u0935\u0938\u093E %"),
    num5("snf", "SNF %", "\u090F\u0938\u090F\u0928\u090F\u092B %"),
    internal8("clr", "CLR", "\u0938\u0940\u090F\u0932\u0906\u0930", { type: "number" }),
    internal8("water", "Water %", "\u092A\u093E\u0928\u0940 %", { type: "number" }),
    internal8("qualityDecision", "Quality Decision", "\u0917\u0941\u0923\u0935\u0924\u094D\u0924\u093E \u0928\u093F\u0930\u094D\u0923\u092F", { type: "enum" }),
    money7("rate", "Rate", "\u0926\u0930"),
    money7("amount", "Amount", "\u0930\u093E\u0936\u093F"),
    internal8("rateChartId", "Rate Chart", "\u0926\u0930 \u091A\u093E\u0930\u094D\u091F"),
    internal8("centreId", "Centre", "\u0915\u0947\u0902\u0926\u094D\u0930"),
    internal8("source", "Source", "\u0938\u094D\u0930\u094B\u0924", { type: "enum" }),
    internal8("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var settlement2 = {
  key: "dairy_settlement",
  table: "dairy_settlements",
  domain: "dairy",
  label: "Farmer Settlements (Dairy)",
  labelHi: "\u0915\u093F\u0938\u093E\u0928 \u092D\u0941\u0917\u0924\u093E\u0928 (\u0921\u0947\u092F\u0930\u0940)",
  capability: CAP2,
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "member", "voucher"],
  naturalKey: ["settlementNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c8("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c8("settlementNo", "Settlement No.", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c8("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    c8("memberName", "Member Name", "\u0938\u0926\u0938\u094D\u092F \u0928\u093E\u092E"),
    c8("from", "From", "\u0938\u0947", { type: "date" }),
    c8("to", "To", "\u0924\u0915", { type: "date" }),
    money7("gross", "Gross", "\u0938\u0915\u0932"),
    internal8("deductionLines", "Deduction Lines", "\u0915\u091F\u094C\u0924\u0940 \u092A\u0902\u0915\u094D\u0924\u093F\u092F\u093E\u0901", { type: "json" }),
    money7("netPayable", "Net Payable", "\u0936\u0941\u0926\u094D\u0927 \u0926\u0947\u092F"),
    internal8("amountPaid", "Amount Paid (cached)", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0930\u093E\u0936\u093F (\u0915\u0948\u0936\u094D\u0921)", { type: "currency" }),
    c8("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal8("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    internal8("approvedBy", "Approved By", "\u0905\u0928\u0941\u092E\u094B\u0926\u0915"),
    internal8("approvedAt", "Approved At", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u0938\u092E\u092F", { type: "date" }),
    c8("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal8("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var dispatch = {
  key: "dairy_dispatch",
  table: "dairy_dispatches",
  domain: "dairy",
  label: "Milk Dispatch",
  labelHi: "\u0926\u0942\u0927 \u092A\u094D\u0930\u0947\u0937\u0923",
  capability: CAP2,
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "voucher"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c8("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c8("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c8("shift", "Shift", "\u092A\u093E\u0932\u0940", { type: "enum" }),
    c8("unionName", "Union", "\u0938\u0902\u0918"),
    num5("qty", "Quantity (L)", "\u092E\u093E\u0924\u094D\u0930\u093E (\u0932\u0940.)"),
    num5("fat", "Fat %", "\u0935\u0938\u093E %"),
    num5("snf", "SNF %", "\u090F\u0938\u090F\u0928\u090F\u092B %"),
    money7("rate", "Rate", "\u0926\u0930"),
    money7("amount", "Amount", "\u0930\u093E\u0936\u093F"),
    num5("shortage", "Shortage", "\u0915\u092E\u0940"),
    c8("vehicleNo", "Vehicle No.", "\u0935\u093E\u0939\u0928 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c8("remarks", "Remarks", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    internal8("amountReceived", "Amount Received (cached)", "\u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0930\u093E\u0936\u093F (\u0915\u0948\u0936\u094D\u0921)", { type: "currency" }),
    internal8("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    c8("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal8("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var inputIssue = {
  key: "dairy_input_issue",
  table: "dairy_input_issues",
  domain: "dairy",
  label: "Dairy Input Issues",
  labelHi: "\u0921\u0947\u092F\u0930\u0940 \u0907\u0928\u092A\u0941\u091F \u0935\u093F\u0924\u0930\u0923",
  capability: CAP2,
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "member", "account", "voucher"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c8("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c8("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c8("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    c8("memberName", "Member Name", "\u0938\u0926\u0938\u094D\u092F \u0928\u093E\u092E"),
    c8("inputType", "Input Type", "\u0907\u0928\u092A\u0941\u091F \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c8("itemName", "Item", "\u0935\u0938\u094D\u0924\u0941"),
    num5("qty", "Quantity", "\u092E\u093E\u0924\u094D\u0930\u093E"),
    money7("amount", "Amount", "\u0930\u093E\u0936\u093F"),
    c8("remarks", "Remarks", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    internal8("incomeAccountId", "Income Account", "\u0906\u092F \u0916\u093E\u0924\u093E"),
    internal8("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    c8("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal8("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var distribution = {
  key: "dairy_distribution",
  table: "dairy_distributions",
  domain: "dairy",
  label: "Dairy Distributions",
  labelHi: "\u0921\u0947\u092F\u0930\u0940 \u0935\u093F\u0924\u0930\u0923",
  capability: CAP2,
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "voucher"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c8("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c8("kind", "Kind", "\u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c8("from", "From", "\u0938\u0947", { type: "date" }),
    c8("to", "To", "\u0924\u0915", { type: "date" }),
    c8("fyLabel", "Financial Year", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937"),
    c8("basis", "Basis", "\u0906\u0927\u093E\u0930", { type: "enum" }),
    num5("rate", "Rate", "\u0926\u0930"),
    c8("resolutionNo", "Resolution No.", "\u0938\u0902\u0915\u0932\u094D\u092A \u0938\u0902\u0916\u094D\u092F\u093E"),
    c8("resolutionDate", "Resolution Date", "\u0938\u0902\u0915\u0932\u094D\u092A \u0924\u093F\u0925\u093F", { type: "date" }),
    internal8("lines", "Distribution Lines", "\u0935\u093F\u0924\u0930\u0923 \u092A\u0902\u0915\u094D\u0924\u093F\u092F\u093E\u0901", { type: "json" }),
    money7("total", "Total", "\u0915\u0941\u0932"),
    internal8("amountPaid", "Amount Paid (cached)", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0930\u093E\u0936\u093F (\u0915\u0948\u0936\u094D\u0921)", { type: "currency" }),
    c8("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal8("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    internal8("approvedBy", "Approved By", "\u0905\u0928\u0941\u092E\u094B\u0926\u0915"),
    internal8("approvedAt", "Approved At", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u0938\u092E\u092F", { type: "date" }),
    c8("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal8("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var DAIRY_ENTITIES = [
  rateChart,
  milkEntry,
  settlement2,
  dispatch,
  inputIssue,
  distribution
];

// src/lib/export/entities/housing.ts
var c9 = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var money8 = (key, header, headerHi, over = {}) => c9(key, header, headerHi, { type: "currency", ...over });
var num6 = (key, header, headerHi, over = {}) => c9(key, header, headerHi, { type: "number", ...over });
var internal9 = (key, header, headerHi, over = {}) => c9(key, header, headerHi, { defaultVisible: false, ...over });
var CAP3 = "housing";
var trailer = () => [
  c9("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
  internal9("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
];
var building = {
  key: "housing_building",
  table: "housing_buildings",
  domain: "housing",
  label: "Buildings",
  labelHi: "\u092D\u0935\u0928",
  capability: CAP3,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c9("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c9("name", "Building Name", "\u092D\u0935\u0928 \u0928\u093E\u092E"),
    c9("address", "Address", "\u092A\u0924\u093E", { piiClass: "contact" }),
    num6("floors", "Floors", "\u092E\u0902\u091C\u093C\u093F\u0932\u0947\u0902"),
    num6("totalUnits", "Total Units", "\u0915\u0941\u0932 \u0907\u0915\u093E\u0907\u092F\u093E\u0901"),
    c9("remarks", "Remarks", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    ...trailer()
  ]
};
var flat = {
  key: "housing_flat",
  table: "housing_flats",
  domain: "housing",
  label: "Flats",
  labelHi: "\u092B\u094D\u0932\u0948\u091F",
  capability: CAP3,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "member", "housing_building", "account"],
  naturalKey: ["flatNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c9("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c9("flatNo", "Flat No.", "\u092B\u094D\u0932\u0948\u091F \u0938\u0902\u0916\u094D\u092F\u093E"),
    c9("blockNo", "Block No.", "\u092C\u094D\u0932\u0949\u0915 \u0938\u0902\u0916\u094D\u092F\u093E"),
    internal9("buildingId", "Building", "\u092D\u0935\u0928"),
    internal9("floor", "Floor", "\u092E\u0902\u091C\u093C\u093F\u0932", { type: "number" }),
    internal9("unitType", "Unit Type", "\u0907\u0915\u093E\u0908 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c9("memberId", "Owner (Member)", "\u0938\u094D\u0935\u093E\u092E\u0940 (\u0938\u0926\u0938\u094D\u092F)"),
    internal9("associateMemberId", "Associate Member", "\u0938\u0939-\u0938\u0926\u0938\u094D\u092F"),
    c9("ownerType", "Owner Type", "\u0938\u094D\u0935\u093E\u092E\u093F\u0924\u094D\u0935 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    internal9("occupancy", "Occupancy", "\u0905\u0927\u093F\u092D\u094B\u0917", { type: "enum" }),
    num6("area", "Area", "\u0915\u094D\u0937\u0947\u0924\u094D\u0930\u092B\u0932"),
    money8("monthlyMaintenance", "Monthly Maintenance", "\u092E\u093E\u0938\u093F\u0915 \u0930\u0916\u0930\u0916\u093E\u0935"),
    c9("registrationDate", "Registration Date", "\u092A\u0902\u091C\u0940\u0915\u0930\u0923 \u0924\u093F\u0925\u093F", { type: "date" }),
    // Share block — printed on the Share & Nomination Register.
    c9("shareCertNo", "Share Certificate No.", "\u0905\u0902\u0936 \u092A\u094D\u0930\u092E\u093E\u0923\u092A\u0924\u094D\u0930 \u0938\u0902\u0916\u094D\u092F\u093E"),
    num6("shareCount", "Shares Held", "\u0905\u0902\u0936\u094B\u0902 \u0915\u0940 \u0938\u0902\u0916\u094D\u092F\u093E"),
    money8("shareFaceValue", "Face Value", "\u0905\u0902\u0915\u093F\u0924 \u092E\u0942\u0932\u094D\u092F"),
    // Nomination block — flat-level, separate from the member register.
    c9("nomineeName", "Nominee Name", "\u0928\u093E\u092E\u093F\u0924\u0940 \u0915\u093E \u0928\u093E\u092E", { piiClass: "contact" }),
    c9("nomineeRelation", "Nominee Relation", "\u0928\u093E\u092E\u093F\u0924\u0940 \u0938\u0902\u092C\u0902\u0927"),
    c9("nomineePhone", "Nominee Phone", "\u0928\u093E\u092E\u093F\u0924\u0940 \u092B\u093C\u094B\u0928", { piiClass: "contact" }),
    internal9("chargeOverrides", "Charge Overrides", "\u0936\u0941\u0932\u094D\u0915 \u0905\u092A\u0935\u093E\u0926", { type: "json" }),
    internal9("receivableAccountId", "Receivable Account", "\u092A\u094D\u0930\u093E\u092A\u094D\u092F \u0916\u093E\u0924\u093E"),
    ...trailer()
  ]
};
var chargeHead = {
  key: "housing_charge_head",
  table: "housing_charge_heads",
  domain: "housing",
  label: "Charge Heads",
  labelHi: "\u0936\u0941\u0932\u094D\u0915 \u0936\u0940\u0930\u094D\u0937\u0915",
  capability: CAP3,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "account"],
  naturalKey: ["code"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c9("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c9("code", "Code", "\u0915\u094B\u0921"),
    c9("nameEn", "Name (English)", "\u0928\u093E\u092E (\u0905\u0902\u0917\u094D\u0930\u0947\u091C\u093C\u0940)"),
    c9("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    internal9("kind", "Kind", "\u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c9("basis", "Basis", "\u0906\u0927\u093E\u0930", { type: "enum" }),
    num6("rate", "Rate", "\u0926\u0930"),
    c9("isFund", "Is Fund", "\u0928\u093F\u0927\u093F \u0939\u0948", { type: "boolean" }),
    internal9("gstable", "GST Applicable", "\u091C\u0940\u090F\u0938\u091F\u0940 \u0932\u093E\u0917\u0942", { type: "boolean" }),
    internal9("accountId", "Ledger Account", "\u092C\u0939\u0940 \u0916\u093E\u0924\u093E"),
    internal9("order", "Display Order", "\u092A\u094D\u0930\u0926\u0930\u094D\u0936\u0928 \u0915\u094D\u0930\u092E", { type: "number" }),
    c9("isActive", "Active", "\u0938\u0915\u094D\u0930\u093F\u092F", { type: "boolean" }),
    ...trailer()
  ]
};
var maintenanceBill = {
  key: "maintenance_bill",
  table: "maintenance_bills",
  domain: "housing",
  label: "Maintenance Bills",
  labelHi: "\u0930\u0916\u0930\u0916\u093E\u0935 \u092C\u093F\u0932",
  capability: CAP3,
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "housing_flat", "member", "account", "voucher"],
  naturalKey: ["billNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c9("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c9("billNo", "Bill No.", "\u092C\u093F\u0932 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c9("flatId", "Flat", "\u092B\u094D\u0932\u0948\u091F"),
    c9("flatNo", "Flat No.", "\u092B\u094D\u0932\u0948\u091F \u0938\u0902\u0916\u094D\u092F\u093E"),
    c9("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    c9("period", "Period", "\u0905\u0935\u0927\u093F"),
    c9("date", "Bill Date", "\u092C\u093F\u0932 \u0924\u093F\u0925\u093F", { type: "date" }),
    money8("amount", "Amount", "\u0930\u093E\u0936\u093F"),
    internal9("paidAmount", "Paid Amount (cached)", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0930\u093E\u0936\u093F (\u0915\u0948\u0936\u094D\u0921)", { type: "currency" }),
    c9("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal9("lines", "Bill Lines", "\u092C\u093F\u0932 \u092A\u0902\u0915\u094D\u0924\u093F\u092F\u093E\u0901", { type: "json" }),
    internal9("receivableAccountId", "Receivable Account", "\u092A\u094D\u0930\u093E\u092A\u094D\u092F \u0916\u093E\u0924\u093E"),
    internal9("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    ...trailer()
  ]
};
var fundInvestment = {
  key: "housing_fund_investment",
  table: "housing_fund_investments",
  domain: "housing",
  label: "Fund Investments",
  labelHi: "\u0928\u093F\u0927\u093F \u0928\u093F\u0935\u0947\u0936",
  capability: CAP3,
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "account", "voucher"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c9("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c9("instrument", "Instrument", "\u0938\u093E\u0927\u0928", { type: "enum" }),
    c9("institution", "Institution", "\u0938\u0902\u0938\u094D\u0925\u093E"),
    money8("amount", "Amount", "\u0930\u093E\u0936\u093F"),
    c9("date", "Investment Date", "\u0928\u093F\u0935\u0947\u0936 \u0924\u093F\u0925\u093F", { type: "date" }),
    c9("maturityDate", "Maturity Date", "\u092A\u0930\u093F\u092A\u0915\u094D\u0935\u0924\u093E \u0924\u093F\u0925\u093F", { type: "date" }),
    num6("interestRate", "Interest Rate %", "\u092C\u094D\u092F\u093E\u091C \u0926\u0930 %"),
    c9("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal9("fundAccountId", "Fund Account", "\u0928\u093F\u0927\u093F \u0916\u093E\u0924\u093E"),
    internal9("investmentAccountId", "Investment Account", "\u0928\u093F\u0935\u0947\u0936 \u0916\u093E\u0924\u093E"),
    internal9("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    internal9("redemptionVoucherId", "Redemption Voucher", "\u092E\u094B\u091A\u0928 \u0935\u093E\u0909\u091A\u0930"),
    ...trailer()
  ]
};
var complaint = {
  key: "housing_complaint",
  table: "housing_complaints",
  domain: "housing",
  label: "Complaints",
  labelHi: "\u0936\u093F\u0915\u093E\u092F\u0924\u0947\u0902",
  capability: CAP3,
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "housing_flat", "member"],
  naturalKey: ["complaintNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c9("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c9("complaintNo", "Complaint No.", "\u0936\u093F\u0915\u093E\u092F\u0924 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c9("flatId", "Flat", "\u092B\u094D\u0932\u0948\u091F"),
    c9("flatNo", "Flat No.", "\u092B\u094D\u0932\u0948\u091F \u0938\u0902\u0916\u094D\u092F\u093E"),
    c9("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    c9("category", "Category", "\u0936\u094D\u0930\u0947\u0923\u0940", { type: "enum" }),
    c9("title", "Title", "\u0936\u0940\u0930\u094D\u0937\u0915"),
    c9("description", "Description", "\u0935\u093F\u0935\u0930\u0923"),
    c9("raisedDate", "Raised Date", "\u0926\u0930\u094D\u091C \u0924\u093F\u0925\u093F", { type: "date" }),
    c9("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c9("resolution", "Resolution", "\u0938\u092E\u093E\u0927\u093E\u0928"),
    c9("resolvedDate", "Resolved Date", "\u0938\u092E\u093E\u0927\u093E\u0928 \u0924\u093F\u0925\u093F", { type: "date" }),
    ...trailer()
  ]
};
var parking = {
  key: "housing_parking",
  table: "housing_parking",
  domain: "housing",
  label: "Parking Slots",
  labelHi: "\u092A\u093E\u0930\u094D\u0915\u093F\u0902\u0917 \u0938\u094D\u0932\u0949\u091F",
  capability: CAP3,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "housing_flat", "member"],
  naturalKey: ["slotNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c9("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c9("slotNo", "Slot No.", "\u0938\u094D\u0932\u0949\u091F \u0938\u0902\u0916\u094D\u092F\u093E"),
    c9("flatId", "Flat", "\u092B\u094D\u0932\u0948\u091F"),
    c9("flatNo", "Flat No.", "\u092B\u094D\u0932\u0948\u091F \u0938\u0902\u0916\u094D\u092F\u093E"),
    c9("memberId", "Member", "\u0938\u0926\u0938\u094D\u092F"),
    c9("vehicleType", "Vehicle Type", "\u0935\u093E\u0939\u0928 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c9("vehicleNo", "Vehicle No.", "\u0935\u093E\u0939\u0928 \u0938\u0902\u0916\u094D\u092F\u093E"),
    money8("monthlyCharge", "Monthly Charge", "\u092E\u093E\u0938\u093F\u0915 \u0936\u0941\u0932\u094D\u0915"),
    c9("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    ...trailer()
  ]
};
var transfer = {
  key: "housing_transfer",
  table: "housing_transfers",
  domain: "housing",
  label: "Flat Transfers",
  labelHi: "\u092B\u094D\u0932\u0948\u091F \u0939\u0938\u094D\u0924\u093E\u0902\u0924\u0930\u0923",
  capability: CAP3,
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "housing_flat", "member", "voucher"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c9("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c9("flatId", "Flat", "\u092B\u094D\u0932\u0948\u091F"),
    c9("flatNo", "Flat No.", "\u092B\u094D\u0932\u0948\u091F \u0938\u0902\u0916\u094D\u092F\u093E"),
    c9("fromMemberId", "From Member", "\u0939\u0938\u094D\u0924\u093E\u0902\u0924\u0930\u0915 \u0938\u0926\u0938\u094D\u092F"),
    c9("toMemberId", "To Member", "\u0939\u0938\u094D\u0924\u093E\u0902\u0924\u0930\u093F\u0924\u0940 \u0938\u0926\u0938\u094D\u092F"),
    internal9("transferType", "Transfer Type", "\u0939\u0938\u094D\u0924\u093E\u0902\u0924\u0930\u0923 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c9("date", "Transfer Date", "\u0939\u0938\u094D\u0924\u093E\u0902\u0924\u0930\u0923 \u0924\u093F\u0925\u093F", { type: "date" }),
    money8("transferFee", "Transfer Fee", "\u0939\u0938\u094D\u0924\u093E\u0902\u0924\u0930\u0923 \u0936\u0941\u0932\u094D\u0915"),
    money8("premium", "Premium", "\u092A\u094D\u0930\u0940\u092E\u093F\u092F\u092E"),
    c9("resolutionNo", "Resolution No.", "\u0938\u0902\u0915\u0932\u094D\u092A \u0938\u0902\u0916\u094D\u092F\u093E"),
    c9("resolutionDate", "Resolution Date", "\u0938\u0902\u0915\u0932\u094D\u092A \u0924\u093F\u0925\u093F", { type: "date" }),
    c9("remarks", "Remarks", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    internal9("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    ...trailer()
  ]
};
var insurance = {
  key: "housing_insurance",
  table: "housing_insurance",
  domain: "housing",
  label: "Insurance Policies",
  labelHi: "\u092C\u0940\u092E\u093E \u092A\u0949\u0932\u093F\u0938\u0940",
  capability: CAP3,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["policyNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c9("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c9("policyNo", "Policy No.", "\u092A\u0949\u0932\u093F\u0938\u0940 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c9("insurer", "Insurer", "\u092C\u0940\u092E\u093E\u0915\u0930\u094D\u0924\u093E"),
    c9("coverageType", "Coverage Type", "\u0915\u0935\u0930\u0947\u091C \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    money8("sumInsured", "Sum Insured", "\u092C\u0940\u092E\u093F\u0924 \u0930\u093E\u0936\u093F"),
    money8("premium", "Premium", "\u092A\u094D\u0930\u0940\u092E\u093F\u092F\u092E"),
    c9("startDate", "Start Date", "\u092A\u094D\u0930\u093E\u0930\u0902\u092D \u0924\u093F\u0925\u093F", { type: "date" }),
    c9("expiryDate", "Expiry Date", "\u0938\u092E\u093E\u092A\u094D\u0924\u093F \u0924\u093F\u0925\u093F", { type: "date" }),
    c9("remarks", "Remarks", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    ...trailer()
  ]
};
var amc = {
  key: "housing_amc",
  table: "housing_amc",
  domain: "housing",
  label: "AMC Contracts",
  labelHi: "\u090F\u090F\u092E\u0938\u0940 \u0905\u0928\u0941\u092C\u0902\u0927",
  capability: CAP3,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["contractNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c9("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c9("contractNo", "Contract No.", "\u0905\u0928\u0941\u092C\u0902\u0927 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c9("vendor", "Vendor", "\u0935\u093F\u0915\u094D\u0930\u0947\u0924\u093E"),
    c9("equipment", "Equipment", "\u0909\u092A\u0915\u0930\u0923"),
    money8("amount", "Amount", "\u0930\u093E\u0936\u093F"),
    c9("startDate", "Start Date", "\u092A\u094D\u0930\u093E\u0930\u0902\u092D \u0924\u093F\u0925\u093F", { type: "date" }),
    c9("expiryDate", "Expiry Date", "\u0938\u092E\u093E\u092A\u094D\u0924\u093F \u0924\u093F\u0925\u093F", { type: "date" }),
    c9("remarks", "Remarks", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    ...trailer()
  ]
};
var document = {
  key: "housing_document",
  table: "housing_documents",
  domain: "housing",
  label: "Legal Documents",
  labelHi: "\u0935\u0948\u0927\u093E\u0928\u093F\u0915 \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C",
  capability: CAP3,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c9("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c9("docType", "Document Type", "\u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c9("title", "Title", "\u0936\u0940\u0930\u094D\u0937\u0915"),
    c9("reference", "Reference", "\u0938\u0902\u0926\u0930\u094D\u092D"),
    c9("authority", "Authority", "\u092A\u094D\u0930\u093E\u0927\u093F\u0915\u0930\u0923"),
    c9("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c9("expiryDate", "Expiry Date", "\u0938\u092E\u093E\u092A\u094D\u0924\u093F \u0924\u093F\u0925\u093F", { type: "date" }),
    c9("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c9("remarks", "Remarks", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    ...trailer()
  ]
};
var HOUSING_ENTITIES = [
  building,
  flat,
  chargeHead,
  maintenanceBill,
  fundInvestment,
  complaint,
  parking,
  transfer,
  insurance,
  amc,
  document
];

// src/lib/export/entities/marketing.ts
var c10 = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var num7 = (key, header, headerHi, over = {}) => c10(key, header, headerHi, { type: "number", ...over });
var internal10 = (key, header, headerHi, over = {}) => c10(key, header, headerHi, { defaultVisible: false, ...over });
var CAP4 = "procurement_msp";
var stamps = () => [
  internal10("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
  internal10("updatedAt", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928 \u0938\u092E\u092F", { type: "date" })
];
var crop = {
  key: "procurement_crop",
  table: "procurement_crops",
  domain: "marketing",
  label: "Crops",
  labelHi: "\u092B\u0938\u0932\u0947\u0902",
  capability: CAP4,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["code"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c10("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c10("code", "Crop Code", "\u092B\u0938\u0932 \u0915\u094B\u0921"),
    c10("name", "Crop Name", "\u092B\u0938\u0932 \u0928\u093E\u092E"),
    c10("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    ...stamps()
  ]
};
var variety = {
  key: "procurement_variety",
  table: "procurement_varieties",
  domain: "marketing",
  label: "Varieties",
  labelHi: "\u0915\u093F\u0938\u094D\u092E\u0947\u0902",
  capability: CAP4,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "procurement_crop"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c10("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c10("cropId", "Crop", "\u092B\u0938\u0932"),
    c10("name", "Variety Name", "\u0915\u093F\u0938\u094D\u092E \u0928\u093E\u092E"),
    c10("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    ...stamps()
  ]
};
var season = {
  key: "procurement_season",
  table: "procurement_seasons",
  domain: "marketing",
  label: "Seasons",
  labelHi: "\u092E\u094C\u0938\u092E",
  capability: CAP4,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c10("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c10("name", "Season Name", "\u092E\u094C\u0938\u092E \u0928\u093E\u092E"),
    c10("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    c10("cropYear", "Crop Year", "\u092B\u0938\u0932 \u0935\u0930\u094D\u0937"),
    c10("startDate", "Start Date", "\u092A\u094D\u0930\u093E\u0930\u0902\u092D \u0924\u093F\u0925\u093F", { type: "date" }),
    c10("endDate", "End Date", "\u0938\u092E\u093E\u092A\u094D\u0924\u093F \u0924\u093F\u0925\u093F", { type: "date" }),
    ...stamps()
  ]
};
var agency = {
  key: "procurement_agency",
  table: "procurement_agencies",
  domain: "marketing",
  label: "Procurement Agencies",
  labelHi: "\u0916\u0930\u0940\u0926 \u090F\u091C\u0947\u0902\u0938\u093F\u092F\u093E\u0901",
  capability: CAP4,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["code"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c10("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c10("code", "Agency Code", "\u090F\u091C\u0947\u0902\u0938\u0940 \u0915\u094B\u0921"),
    c10("name", "Agency Name", "\u090F\u091C\u0947\u0902\u0938\u0940 \u0928\u093E\u092E"),
    c10("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    c10("kind", "Kind", "\u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    num7("commissionRate", "Commission Rate %", "\u0915\u092E\u0940\u0936\u0928 \u0926\u0930 %"),
    ...stamps()
  ]
};
var centre = {
  key: "procurement_centre",
  table: "procurement_centres",
  domain: "marketing",
  label: "Procurement Centres",
  labelHi: "\u0916\u0930\u0940\u0926 \u0915\u0947\u0902\u0926\u094D\u0930",
  capability: CAP4,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "procurement_agency"],
  naturalKey: ["code"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c10("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c10("code", "Centre Code", "\u0915\u0947\u0902\u0926\u094D\u0930 \u0915\u094B\u0921"),
    c10("name", "Centre Name", "\u0915\u0947\u0902\u0926\u094D\u0930 \u0928\u093E\u092E"),
    c10("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    c10("agencyId", "Agency", "\u090F\u091C\u0947\u0902\u0938\u0940"),
    ...stamps()
  ]
};
var mspRate = {
  key: "procurement_msp_rate",
  table: "procurement_msp_rates",
  domain: "marketing",
  label: "MSP Rates",
  labelHi: "\u090F\u092E\u090F\u0938\u092A\u0940 \u0926\u0930\u0947\u0902",
  capability: CAP4,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "procurement_crop", "procurement_season"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c10("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c10("cropId", "Crop", "\u092B\u0938\u0932"),
    c10("seasonId", "Season", "\u092E\u094C\u0938\u092E"),
    internal10("rate", "Rate", "\u0926\u0930", { type: "json" }),
    c10("effectiveFrom", "Effective From", "\u092A\u094D\u0930\u092D\u093E\u0935\u0940 \u0924\u093F\u0925\u093F", { type: "date" }),
    ...stamps()
  ]
};
var deductionRule = {
  key: "procurement_deduction_rule",
  table: "procurement_deduction_rules",
  domain: "marketing",
  label: "Deduction Rules",
  labelHi: "\u0915\u091F\u094C\u0924\u0940 \u0928\u093F\u092F\u092E",
  capability: CAP4,
  minRole: "accountant",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "account"],
  naturalKey: ["code"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c10("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c10("code", "Rule Code", "\u0928\u093F\u092F\u092E \u0915\u094B\u0921"),
    c10("name", "Rule Name", "\u0928\u093F\u092F\u092E \u0928\u093E\u092E"),
    c10("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    c10("basis", "Basis", "\u0906\u0927\u093E\u0930", { type: "enum" }),
    internal10("rate", "Rate", "\u0926\u0930", { type: "json" }),
    internal10("accountId", "Ledger Account", "\u092C\u0939\u0940 \u0916\u093E\u0924\u093E"),
    ...stamps()
  ]
};
var qualitySpec = {
  key: "procurement_quality_spec",
  table: "procurement_quality_specs",
  domain: "marketing",
  label: "Quality Specs",
  labelHi: "\u0917\u0941\u0923\u0935\u0924\u094D\u0924\u093E \u092E\u093E\u0928\u0915",
  capability: CAP4,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "procurement_crop", "procurement_season"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c10("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c10("cropId", "Crop", "\u092B\u0938\u0932"),
    c10("seasonId", "Season", "\u092E\u094C\u0938\u092E"),
    c10("parameter", "Parameter", "\u092E\u093E\u092A\u0926\u0902\u0921"),
    num7("maxLimit", "Max Limit", "\u0905\u0927\u093F\u0915\u0924\u092E \u0938\u0940\u092E\u093E"),
    ...stamps()
  ]
};
var bardanaType = {
  key: "procurement_bardana_type",
  table: "procurement_bardana_types",
  domain: "marketing",
  label: "Bardana Types",
  labelHi: "\u092C\u093E\u0930\u0926\u093E\u0928\u093E \u092A\u094D\u0930\u0915\u093E\u0930",
  capability: CAP4,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c10("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c10("name", "Bardana Name", "\u092C\u093E\u0930\u0926\u093E\u0928\u093E \u0928\u093E\u092E"),
    c10("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    num7("capacityKg", "Capacity (kg)", "\u0915\u094D\u0937\u092E\u0924\u093E (\u0915\u093F.\u0917\u094D\u0930\u093E.)"),
    ...stamps()
  ]
};
var transporter = {
  key: "marketing_transporter",
  table: "marketing_transporters",
  domain: "marketing",
  label: "Transporters",
  labelHi: "\u092A\u0930\u093F\u0935\u0939\u0928\u0915\u0930\u094D\u0924\u093E",
  capability: "transport",
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c10("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c10("name", "Transporter Name", "\u092A\u0930\u093F\u0935\u0939\u0928\u0915\u0930\u094D\u0924\u093E \u0928\u093E\u092E"),
    c10("nameHi", "Name (Hindi)", "\u0928\u093E\u092E (\u0939\u093F\u0928\u094D\u0926\u0940)"),
    c10("vehicleNo", "Vehicle No.", "\u0935\u093E\u0939\u0928 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c10("phone", "Phone", "\u092B\u093C\u094B\u0928", { piiClass: "contact" }),
    num7("ratePerQtl", "Rate per Quintal", "\u0926\u0930 \u092A\u094D\u0930\u0924\u093F \u0915\u094D\u0935\u093F\u0902\u091F\u0932"),
    ...stamps()
  ]
};
var MARKETING_ENTITIES = [
  crop,
  variety,
  season,
  agency,
  centre,
  mspRate,
  deductionRule,
  qualitySpec,
  bardanaType,
  transporter
];

// src/lib/export/entities/consumer.ts
var c11 = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var money9 = (key, header, headerHi, over = {}) => c11(key, header, headerHi, { type: "currency", ...over });
var num8 = (key, header, headerHi, over = {}) => c11(key, header, headerHi, { type: "number", ...over });
var internal11 = (key, header, headerHi, over = {}) => c11(key, header, headerHi, { defaultVisible: false, ...over });
var CAP5 = "pos_billing";
var priceList = {
  key: "consumer_price_list",
  table: "consumer_price_lists",
  domain: "consumer",
  label: "Price Lists",
  labelHi: "\u092E\u0942\u0932\u094D\u092F \u0938\u0942\u091A\u0940",
  capability: CAP5,
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "stock_item"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c11("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c11("itemId", "Item", "\u0906\u0907\u091F\u092E"),
    c11("tier", "Price Tier", "\u092E\u0942\u0932\u094D\u092F \u0936\u094D\u0930\u0947\u0923\u0940", { type: "enum" }),
    money9("price", "Price", "\u092E\u0942\u0932\u094D\u092F"),
    c11("effectiveFrom", "Effective From", "\u092A\u094D\u0930\u092D\u093E\u0935\u0940 \u0924\u093F\u0925\u093F", { type: "date" }),
    c11("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal11("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal11("updatedAt", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928 \u0938\u092E\u092F", { type: "date" })
  ]
};
var patronageRun = {
  key: "consumer_patronage_run",
  table: "consumer_patronage_runs",
  domain: "consumer",
  label: "Patronage Runs",
  labelHi: "\u0938\u0902\u0930\u0915\u094D\u0937\u0923 \u0935\u093F\u0924\u0930\u0923",
  capability: CAP5,
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "voucher"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c11("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    internal11("kind", "Kind", "\u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c11("fyLabel", "Financial Year", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937"),
    c11("from", "From", "\u0938\u0947", { type: "date" }),
    c11("to", "To", "\u0924\u0915", { type: "date" }),
    num8("ratePct", "Rate %", "\u0926\u0930 %"),
    c11("resolutionNo", "Resolution No.", "\u0938\u0902\u0915\u0932\u094D\u092A \u0938\u0902\u0916\u094D\u092F\u093E"),
    c11("resolutionDate", "Resolution Date", "\u0938\u0902\u0915\u0932\u094D\u092A \u0924\u093F\u0925\u093F", { type: "date" }),
    internal11("lines", "Distribution Lines", "\u0935\u093F\u0924\u0930\u0923 \u092A\u0902\u0915\u094D\u0924\u093F\u092F\u093E\u0901", { type: "json" }),
    money9("total", "Total", "\u0915\u0941\u0932"),
    internal11("amountPaid", "Amount Paid (cached)", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0930\u093E\u0936\u093F (\u0915\u0948\u0936\u094D\u0921)", { type: "currency" }),
    c11("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal11("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    internal11("approvedBy", "Approved By", "\u0905\u0928\u0941\u092E\u094B\u0926\u0915"),
    internal11("approvedAt", "Approved At", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u0938\u092E\u092F", { type: "date" }),
    c11("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal11("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var purchaseOrder = {
  key: "consumer_purchase_order",
  table: "consumer_purchase_orders",
  domain: "consumer",
  label: "Purchase Orders",
  labelHi: "\u0915\u094D\u0930\u092F \u0906\u0926\u0947\u0936",
  capability: CAP5,
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "supplier", "purchase"],
  naturalKey: ["poNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c11("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c11("poNo", "PO No.", "\u0915\u094D\u0930\u092F \u0906\u0926\u0947\u0936 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c11("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c11("supplierName", "Supplier", "\u0906\u092A\u0942\u0930\u094D\u0924\u093F\u0915\u0930\u094D\u0924\u093E"),
    c11("supplierPhone", "Supplier Phone", "\u0906\u092A\u0942\u0930\u094D\u0924\u093F\u0915\u0930\u094D\u0924\u093E \u092B\u093C\u094B\u0928", { piiClass: "contact" }),
    internal11("supplierId", "Supplier Ref", "\u0906\u092A\u0942\u0930\u094D\u0924\u093F\u0915\u0930\u094D\u0924\u093E \u0938\u0902\u0926\u0930\u094D\u092D"),
    c11("expectedDate", "Expected Date", "\u0905\u092A\u0947\u0915\u094D\u0937\u093F\u0924 \u0924\u093F\u0925\u093F", { type: "date" }),
    internal11("items", "Line Items", "\u092A\u0902\u0915\u094D\u0924\u093F \u0906\u0907\u091F\u092E", { type: "json" }),
    money9("total", "Total", "\u0915\u0941\u0932"),
    c11("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c11("resolutionNo", "Resolution No.", "\u0938\u0902\u0915\u0932\u094D\u092A \u0938\u0902\u0916\u094D\u092F\u093E"),
    internal11("approvedBy", "Approved By", "\u0905\u0928\u0941\u092E\u094B\u0926\u0915"),
    internal11("approvedAt", "Approved At", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u0938\u092E\u092F", { type: "date" }),
    internal11("receivedAt", "Received At", "\u092A\u094D\u0930\u093E\u092A\u094D\u0924\u093F \u0938\u092E\u092F", { type: "date" }),
    internal11("purchaseId", "Purchase", "\u0916\u0930\u0940\u0926"),
    c11("purchaseNo", "Purchase No.", "\u0916\u0930\u0940\u0926 \u0938\u0902\u0916\u094D\u092F\u093E"),
    internal11("varianceStatus", "Variance Status", "\u092D\u093F\u0928\u094D\u0928\u0924\u093E \u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal11("varianceReason", "Variance Reason", "\u092D\u093F\u0928\u094D\u0928\u0924\u093E \u0915\u093E\u0930\u0923"),
    internal11("varianceApprovedBy", "Variance Approved By", "\u092D\u093F\u0928\u094D\u0928\u0924\u093E \u0905\u0928\u0941\u092E\u094B\u0926\u0915"),
    c11("notes", "Notes", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    c11("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal11("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var CONSUMER_ENTITIES = [priceList, patronageRun, purchaseOrder];

// src/lib/export/entities/platform.ts
var c12 = (key, header, headerHi, over = {}) => ({ key, header, headerHi, type: "string", piiClass: "none", defaultVisible: true, ...over });
var money10 = (key, header, headerHi, over = {}) => c12(key, header, headerHi, { type: "currency", ...over });
var num9 = (key, header, headerHi, over = {}) => c12(key, header, headerHi, { type: "number", ...over });
var internal12 = (key, header, headerHi, over = {}) => c12(key, header, headerHi, { defaultVisible: false, ...over });
var asset = {
  key: "asset",
  table: "assets",
  domain: "core",
  label: "Fixed Assets",
  labelHi: "\u0938\u094D\u0925\u093E\u092F\u0940 \u0938\u0902\u092A\u0924\u094D\u0924\u093F",
  minRole: "viewer",
  scope: "society",
  nature: "master",
  dependsOn: ["society", "voucher"],
  naturalKey: ["assetNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("assetNo", "Asset No.", "\u0938\u0902\u092A\u0924\u094D\u0924\u093F \u0938\u0902\u0916\u094D\u092F\u093E"),
    c12("name", "Asset Name", "\u0938\u0902\u092A\u0924\u094D\u0924\u093F \u0928\u093E\u092E"),
    c12("category", "Category", "\u0936\u094D\u0930\u0947\u0923\u0940", { type: "enum" }),
    c12("purchaseDate", "Purchase Date", "\u0915\u094D\u0930\u092F \u0924\u093F\u0925\u093F", { type: "date" }),
    money10("cost", "Cost", "\u0932\u093E\u0917\u0924"),
    num9("depreciationRate", "Depreciation Rate %", "\u092E\u0942\u0932\u094D\u092F\u0939\u094D\u0930\u093E\u0938 \u0926\u0930 %"),
    c12("depreciationMethod", "Depreciation Method", "\u092E\u0942\u0932\u094D\u092F\u0939\u094D\u0930\u093E\u0938 \u0935\u093F\u0927\u093F", { type: "enum" }),
    num9("usefulLife", "Useful Life (years)", "\u0909\u092A\u092F\u094B\u0917\u0940 \u0906\u092F\u0941 (\u0935\u0930\u094D\u0937)"),
    money10("residualValue", "Residual Value", "\u0905\u0935\u0936\u093F\u0937\u094D\u091F \u092E\u0942\u0932\u094D\u092F"),
    c12("location", "Location", "\u0938\u094D\u0925\u093E\u0928"),
    c12("description", "Description", "\u0935\u093F\u0935\u0930\u0923"),
    c12("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c12("disposalDate", "Disposal Date", "\u0928\u093F\u092A\u091F\u093E\u0928 \u0924\u093F\u0925\u093F", { type: "date" }),
    money10("saleProceeds", "Sale Proceeds", "\u0935\u093F\u0915\u094D\u0930\u092F \u0906\u092F"),
    internal12("depreciationPostedFY", "Depreciation Posted FY", "\u092E\u0942\u0932\u094D\u092F\u0939\u094D\u0930\u093E\u0938 \u092A\u094B\u0938\u094D\u091F \u0935\u0930\u094D\u0937"),
    internal12("acquisitionVoucherId", "Acquisition Voucher", "\u0905\u0927\u093F\u0917\u094D\u0930\u0939\u0923 \u0935\u093E\u0909\u091A\u0930"),
    c12("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false })
  ]
};
var bankReconciliation = {
  key: "bank_reconciliation",
  table: "bank_reconciliations",
  domain: "compliance",
  label: "Bank Reconciliations",
  labelHi: "\u092C\u0948\u0902\u0915 \u0938\u092E\u093E\u0927\u093E\u0928",
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "account"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("bankAccountId", "Bank Account", "\u092C\u0948\u0902\u0915 \u0916\u093E\u0924\u093E"),
    c12("bankAccountName", "Bank Account Name", "\u092C\u0948\u0902\u0915 \u0916\u093E\u0924\u093E \u0928\u093E\u092E"),
    c12("asOfDate", "As On Date", "\u0924\u093F\u0925\u093F \u0924\u0915", { type: "date" }),
    money10("statementBalance", "Statement Balance", "\u0935\u093F\u0935\u0930\u0923 \u0936\u0947\u0937"),
    money10("bookBalance", "Book Balance", "\u092C\u0939\u0940 \u0936\u0947\u0937"),
    money10("unclearedDepositsTotal", "Uncleared Deposits", "\u0905\u0928\u0915\u094D\u0932\u093F\u092F\u0930 \u091C\u092E\u093E"),
    money10("unclearedPaymentsTotal", "Uncleared Payments", "\u0905\u0928\u0915\u094D\u0932\u093F\u092F\u0930 \u092D\u0941\u0917\u0924\u093E\u0928"),
    internal12("unclearedDepositIds", "Uncleared Deposit IDs", "\u0905\u0928\u0915\u094D\u0932\u093F\u092F\u0930 \u091C\u092E\u093E \u0906\u0908\u0921\u0940", { type: "json" }),
    internal12("unclearedPaymentIds", "Uncleared Payment IDs", "\u0905\u0928\u0915\u094D\u0932\u093F\u092F\u0930 \u092D\u0941\u0917\u0924\u093E\u0928 \u0906\u0908\u0921\u0940", { type: "json" }),
    money10("difference", "Difference", "\u0905\u0902\u0924\u0930"),
    c12("isReconciled", "Reconciled", "\u0938\u092E\u093E\u0927\u093E\u0928\u093F\u0924", { type: "boolean" }),
    internal12("reconciledBy", "Reconciled By", "\u0938\u092E\u093E\u0927\u093E\u0928\u0915\u0930\u094D\u0924\u093E"),
    internal12("reconciledAt", "Reconciled At", "\u0938\u092E\u093E\u0927\u093E\u0928 \u0938\u092E\u092F", { type: "date" }),
    c12("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false })
  ]
};
var tdsEntry = {
  key: "tds_entry",
  table: "tds_entries",
  domain: "compliance",
  label: "TDS Entries",
  labelHi: "\u091F\u0940\u0921\u0940\u090F\u0938 \u092A\u094D\u0930\u0935\u093F\u0937\u094D\u091F\u093F\u092F\u093E\u0901",
  capability: "tds",
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "voucher", "purchase", "tds_challan"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c12("deducteeName", "Deductee Name", "\u0915\u091F\u094C\u0924\u0940-\u0905\u0927\u0940\u0928 \u0915\u093E \u0928\u093E\u092E"),
    c12("deducteePan", "Deductee PAN", "\u0915\u091F\u094C\u0924\u0940-\u0905\u0927\u0940\u0928 \u092A\u0948\u0928", { piiClass: "identity" }),
    c12("deducteeType", "Deductee Type", "\u0915\u091F\u094C\u0924\u0940-\u0905\u0927\u0940\u0928 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c12("section", "TDS Section", "\u091F\u0940\u0921\u0940\u090F\u0938 \u0927\u093E\u0930\u093E"),
    c12("natureOfPayment", "Nature of Payment", "\u092D\u0941\u0917\u0924\u093E\u0928 \u0915\u0940 \u092A\u094D\u0930\u0915\u0943\u0924\u093F"),
    money10("grossAmount", "Gross Amount", "\u0938\u0915\u0932 \u0930\u093E\u0936\u093F"),
    num9("tdsRate", "TDS Rate %", "\u091F\u0940\u0921\u0940\u090F\u0938 \u0926\u0930 %"),
    money10("tdsAmount", "TDS Amount", "\u091F\u0940\u0921\u0940\u090F\u0938 \u0930\u093E\u0936\u093F"),
    c12("quarter", "Quarter", "\u0924\u093F\u092E\u093E\u0939\u0940"),
    c12("financialYear", "Financial Year", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937"),
    c12("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal12("challanId", "Challan", "\u091A\u093E\u0932\u093E\u0928"),
    internal12("voucherId", "Voucher", "\u0935\u093E\u0909\u091A\u0930"),
    internal12("purchaseId", "Purchase", "\u0916\u0930\u0940\u0926"),
    c12("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal12("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var tdsChallan = {
  key: "tds_challan",
  table: "tds_challans",
  domain: "compliance",
  label: "TDS Challans",
  labelHi: "\u091F\u0940\u0921\u0940\u090F\u0938 \u091A\u093E\u0932\u093E\u0928",
  capability: "tds",
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society"],
  naturalKey: ["id"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("bsrCode", "BSR Code", "\u092C\u0940\u090F\u0938\u0906\u0930 \u0915\u094B\u0921"),
    c12("challanDate", "Challan Date", "\u091A\u093E\u0932\u093E\u0928 \u0924\u093F\u0925\u093F", { type: "date" }),
    c12("challanSerial", "Challan Serial", "\u091A\u093E\u0932\u093E\u0928 \u0915\u094D\u0930\u092E\u093E\u0902\u0915"),
    money10("amount", "Amount", "\u0930\u093E\u0936\u093F"),
    c12("bankName", "Bank Name", "\u092C\u0948\u0902\u0915 \u0928\u093E\u092E"),
    c12("quarter", "Quarter", "\u0924\u093F\u092E\u093E\u0939\u0940"),
    c12("financialYear", "Financial Year", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937"),
    c12("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c12("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal12("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var tdsChallanLink = {
  key: "tds_challan_link",
  table: "tds_challan_links",
  domain: "compliance",
  label: "TDS Challan Links",
  labelHi: "\u091F\u0940\u0921\u0940\u090F\u0938 \u091A\u093E\u0932\u093E\u0928 \u0932\u093F\u0902\u0915",
  capability: "tds",
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "tds_entry", "tds_challan"],
  naturalKey: ["society_id", "entryId"],
  formats: ["csv", "json"],
  backupPolicy: "full",
  columns: [
    c12("society_id", "Society", "\u0938\u092E\u093F\u0924\u093F"),
    c12("entryId", "TDS Entry", "\u091F\u0940\u0921\u0940\u090F\u0938 \u092A\u094D\u0930\u0935\u093F\u0937\u094D\u091F\u093F"),
    c12("challanId", "Challan", "\u091A\u093E\u0932\u093E\u0928")
  ]
};
var ewayBill = {
  key: "eway_bill",
  table: "eway_bills",
  domain: "compliance",
  label: "e-Way Bills",
  labelHi: "\u0908-\u0935\u0947 \u092C\u093F\u0932",
  capability: "gst",
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society"],
  naturalKey: ["docNo"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("type", "Type", "\u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c12("docNo", "Document No.", "\u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0938\u0902\u0916\u094D\u092F\u093E"),
    c12("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c12("partyName", "Party Name", "\u092A\u0915\u094D\u0937\u0915\u093E\u0930 \u0928\u093E\u092E"),
    c12("partyGst", "Party GSTIN", "\u092A\u0915\u094D\u0937\u0915\u093E\u0930 \u091C\u0940\u090F\u0938\u091F\u0940\u0906\u0908\u090F\u0928", { piiClass: "identity" }),
    internal12("items", "Line Items", "\u092A\u0902\u0915\u094D\u0924\u093F \u0906\u0907\u091F\u092E", { type: "json" }),
    money10("totalTaxable", "Total Taxable", "\u0915\u0941\u0932 \u0915\u0930 \u092F\u094B\u0917\u094D\u092F"),
    money10("totalGst", "Total GST", "\u0915\u0941\u0932 \u091C\u0940\u090F\u0938\u091F\u0940"),
    money10("grandTotal", "Grand Total", "\u092E\u0939\u093E\u092F\u094B\u0917"),
    c12("transportMode", "Transport Mode", "\u092A\u0930\u093F\u0935\u0939\u0928 \u092E\u093E\u0927\u094D\u092F\u092E", { type: "enum" }),
    c12("vehicleNo", "Vehicle No.", "\u0935\u093E\u0939\u0928 \u0938\u0902\u0916\u094D\u092F\u093E"),
    num9("distance", "Distance (km)", "\u0926\u0942\u0930\u0940 (\u0915\u093F.\u092E\u0940.)"),
    c12("ewbNo", "EWB No.", "\u0908\u0921\u092C\u094D\u0932\u094D\u092F\u0942\u092C\u0940 \u0938\u0902\u0916\u094D\u092F\u093E"),
    internal12("transporterName", "Transporter Name", "\u092A\u0930\u093F\u0935\u0939\u0928\u0915\u0930\u094D\u0924\u093E \u0928\u093E\u092E"),
    internal12("transporterGstin", "Transporter GSTIN", "\u092A\u0930\u093F\u0935\u0939\u0928\u0915\u0930\u094D\u0924\u093E \u091C\u0940\u090F\u0938\u091F\u0940\u0906\u0908\u090F\u0928", { piiClass: "identity" }),
    internal12("transDocNo", "Transport Doc No.", "\u092A\u0930\u093F\u0935\u0939\u0928 \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0938\u0902\u0916\u094D\u092F\u093E"),
    internal12("transDocDate", "Transport Doc Date", "\u092A\u0930\u093F\u0935\u0939\u0928 \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0924\u093F\u0925\u093F", { type: "date" })
  ]
};
var complianceFiling = {
  key: "compliance_filing",
  table: "compliance_filings",
  domain: "compliance",
  label: "Compliance Filings",
  labelHi: "\u0905\u0928\u0941\u092A\u093E\u0932\u0928 \u092B\u093E\u0907\u0932\u093F\u0902\u0917",
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("itemId", "Compliance Item", "\u0905\u0928\u0941\u092A\u093E\u0932\u0928 \u092E\u0926"),
    c12("filedAt", "Filed At", "\u092B\u093E\u0907\u0932 \u0924\u093F\u0925\u093F", { type: "date" }),
    c12("filedBy", "Filed By", "\u092B\u093E\u0907\u0932\u0915\u0930\u094D\u0924\u093E"),
    c12("note", "Note", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940")
  ]
};
var recoverable = {
  key: "recoverable",
  table: "recoverables",
  domain: "compliance",
  label: "Recoverables Register",
  labelHi: "\u0935\u0938\u0942\u0932\u0940 \u0930\u091C\u093F\u0938\u094D\u091F\u0930",
  capability: "haryana_compliance",
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("partyName", "Party Name", "\u092A\u0915\u094D\u0937\u0915\u093E\u0930 \u0928\u093E\u092E"),
    c12("category", "Category", "\u0936\u094D\u0930\u0947\u0923\u0940", { type: "enum" }),
    c12("legalStage", "Legal Stage", "\u0915\u093E\u0928\u0942\u0928\u0940 \u091A\u0930\u0923", { type: "enum" }),
    money10("openingBalance", "Opening Balance", "\u092A\u094D\u0930\u093E\u0930\u0902\u092D\u093F\u0915 \u0936\u0947\u0937"),
    money10("additions", "Additions", "\u0935\u0943\u0926\u094D\u0927\u093F"),
    money10("recoveries", "Recoveries", "\u0935\u0938\u0942\u0932\u0940"),
    c12("fyStartDate", "FY Start Date", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937 \u092A\u094D\u0930\u093E\u0930\u0902\u092D", { type: "date" }),
    c12("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    internal12("isDeleted", "Deleted (unused \u2014 rows are hard-deleted)", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E (\u0905\u092A\u094D\u0930\u092F\u0941\u0915\u094D\u0924)", { type: "boolean" }),
    internal12("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var kachiAaratEntry = {
  key: "kachi_aarat_entry",
  table: "kachi_aarat_entries",
  domain: "compliance",
  label: "Kachi Aarat Register",
  labelHi: "\u0915\u091A\u094D\u091A\u0940 \u0906\u0922\u093C\u0924 \u0930\u091C\u093F\u0938\u094D\u091F\u0930",
  capability: "haryana_compliance",
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society"],
  naturalKey: ["id"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c12("fyStartDate", "FY Start Date", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937 \u092A\u094D\u0930\u093E\u0930\u0902\u092D", { type: "date" }),
    c12("crop", "Crop", "\u092B\u0938\u0932", { type: "enum" }),
    c12("partyName", "Farmer / Party", "\u0915\u093F\u0938\u093E\u0928 / \u092A\u0915\u094D\u0937\u0915\u093E\u0930"),
    money10("businessValue", "Business Value", "\u0935\u094D\u092F\u093E\u092A\u093E\u0930 \u092E\u0942\u0932\u094D\u092F"),
    money10("damiEarned", "Dami Earned", "\u0926\u093E\u092E\u0940 \u0906\u092F"),
    c12("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    internal12("isDeleted", "Deleted (unused \u2014 rows are hard-deleted)", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E (\u0905\u092A\u094D\u0930\u092F\u0941\u0915\u094D\u0924)", { type: "boolean" }),
    internal12("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var p7Entry = {
  key: "p7_entry",
  table: "p7_entries",
  domain: "compliance",
  label: "P-7 Annual Review Data",
  labelHi: "\u092A\u0940-7 \u0935\u093E\u0930\u094D\u0937\u093F\u0915 \u0938\u092E\u0940\u0915\u094D\u0937\u093E \u0921\u0947\u091F\u093E",
  capability: "haryana_compliance",
  minRole: "accountant",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society"],
  naturalKey: ["fyStartDate"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("fyStartDate", "FY Start Date", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937 \u092A\u094D\u0930\u093E\u0930\u0902\u092D", { type: "date" }),
    num9("rentedGodownCount", "Rented Godowns", "\u0915\u093F\u0930\u093E\u090F \u0915\u0947 \u0917\u094B\u0926\u093E\u092E"),
    num9("rentedCapacityMT", "Rented Capacity (MT)", "\u0915\u093F\u0930\u093E\u090F \u0915\u0940 \u0915\u094D\u0937\u092E\u0924\u093E (\u092E\u0940.\u091F\u0928)"),
    money10("godownRentPaid", "Godown Rent Paid", "\u0917\u094B\u0926\u093E\u092E \u0915\u093F\u0930\u093E\u092F\u093E \u092D\u0941\u0917\u0924\u093E\u0928"),
    num9("truckCount", "Trucks Operated", "\u0938\u0902\u091A\u093E\u0932\u093F\u0924 \u091F\u094D\u0930\u0915"),
    money10("transportChargesPaid", "Transport Charges Paid", "\u092A\u0930\u093F\u0935\u0939\u0928 \u0936\u0941\u0932\u094D\u0915 \u092D\u0941\u0917\u0924\u093E\u0928"),
    money10("sugarCattleFeedSales", "Sugar / Cattle Feed Sales", "\u091A\u0940\u0928\u0940 / \u092A\u0936\u0941 \u0906\u0939\u093E\u0930 \u092C\u093F\u0915\u094D\u0930\u0940"),
    money10("consumerProductSales", "Consumer Product Sales", "\u0909\u092A\u092D\u094B\u0915\u094D\u0924\u093E \u0909\u0924\u094D\u092A\u093E\u0926 \u092C\u093F\u0915\u094D\u0930\u0940"),
    c12("narration", "Narration", "\u0935\u093F\u0935\u0930\u0923"),
    internal12("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var budget = {
  key: "budget",
  table: "budgets",
  domain: "governance",
  label: "Budgets",
  labelHi: "\u092C\u091C\u091F",
  minRole: "accountant",
  scope: "society",
  nature: "master",
  dependsOn: ["society"],
  naturalKey: ["financialYear"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("financialYear", "Financial Year", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937"),
    internal12("heads", "Budget Heads", "\u092C\u091C\u091F \u0936\u0940\u0930\u094D\u0937\u0915", { type: "json" }),
    internal12("approvedBy", "Approved By", "\u0905\u0928\u0941\u092E\u094B\u0926\u0915"),
    internal12("approvedAt", "Approved At", "\u0905\u0928\u0941\u092E\u094B\u0926\u0928 \u0938\u092E\u092F", { type: "date" }),
    internal12("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal12("createdBy", "Created By", "\u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E")
  ]
};
var auditObjection = {
  key: "audit_objection",
  table: "audit_objections",
  domain: "governance",
  label: "Audit Objections",
  labelHi: "\u0911\u0921\u093F\u091F \u0906\u092A\u0924\u094D\u0924\u093F\u092F\u093E\u0901",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society"],
  naturalKey: ["objectionNo"],
  softDeleteField: "isDeleted",
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("objectionNo", "Objection No.", "\u0906\u092A\u0924\u094D\u0924\u093F \u0938\u0902\u0916\u094D\u092F\u093E"),
    c12("auditYear", "Audit Year", "\u0911\u0921\u093F\u091F \u0935\u0930\u094D\u0937"),
    c12("paraNo", "Para No.", "\u092A\u0948\u0930\u093E \u0938\u0902\u0916\u094D\u092F\u093E"),
    c12("category", "Category", "\u0936\u094D\u0930\u0947\u0923\u0940", { type: "enum" }),
    c12("objection", "Objection", "\u0906\u092A\u0924\u094D\u0924\u093F"),
    money10("amountInvolved", "Amount Involved", "\u0938\u0902\u0932\u0917\u094D\u0928 \u0930\u093E\u0936\u093F"),
    c12("dueDate", "Due Date", "\u0926\u0947\u092F \u0924\u093F\u0925\u093F", { type: "date" }),
    c12("actionTaken", "Action Taken", "\u0915\u0940 \u0917\u0908 \u0915\u093E\u0930\u094D\u0930\u0935\u093E\u0908"),
    c12("rectifiedDate", "Rectified Date", "\u0938\u0941\u0927\u093E\u0930 \u0924\u093F\u0925\u093F", { type: "date" }),
    c12("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    c12("remarks", "Remarks", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    c12("isDeleted", "Deleted", "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E", { type: "boolean", defaultVisible: false }),
    internal12("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var meeting = {
  key: "meeting",
  table: "meeting_register",
  domain: "governance",
  label: "Meeting Register",
  labelHi: "\u092C\u0948\u0920\u0915 \u0930\u091C\u093F\u0938\u094D\u091F\u0930",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society"],
  naturalKey: ["meetingNo"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("meetingNo", "Meeting No.", "\u092C\u0948\u0920\u0915 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c12("type", "Meeting Type", "\u092C\u0948\u0920\u0915 \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c12("date", "Date", "\u0926\u093F\u0928\u093E\u0902\u0915", { type: "date" }),
    c12("time", "Time", "\u0938\u092E\u092F"),
    c12("venue", "Venue", "\u0938\u094D\u0925\u093E\u0928"),
    c12("agenda", "Agenda", "\u0915\u093E\u0930\u094D\u092F\u0938\u0942\u091A\u0940"),
    c12("attendees", "Attendees", "\u0909\u092A\u0938\u094D\u0925\u093F\u0924"),
    c12("resolutions", "Resolutions", "\u0938\u0902\u0915\u0932\u094D\u092A"),
    c12("minutes", "Minutes", "\u0915\u093E\u0930\u094D\u092F\u0935\u0943\u0924\u094D\u0924"),
    c12("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal12("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" })
  ]
};
var election = {
  key: "election",
  table: "elections",
  domain: "governance",
  label: "Elections",
  labelHi: "\u091A\u0941\u0928\u093E\u0935",
  minRole: "viewer",
  scope: "society",
  nature: "transaction",
  dependsOn: ["society", "member"],
  naturalKey: ["electionNo"],
  formats: ["csv", "xlsx", "json"],
  backupPolicy: "full",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("electionNo", "Election No.", "\u091A\u0941\u0928\u093E\u0935 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c12("title", "Title", "\u0936\u0940\u0930\u094D\u0937\u0915"),
    c12("post", "Post", "\u092A\u0926"),
    c12("electionDate", "Election Date", "\u091A\u0941\u0928\u093E\u0935 \u0924\u093F\u0925\u093F", { type: "date" }),
    c12("nominationDeadline", "Nomination Deadline", "\u0928\u093E\u092E\u093E\u0902\u0915\u0928 \u0905\u0902\u0924\u093F\u092E \u0924\u093F\u0925\u093F", { type: "date" }),
    c12("status", "Status", "\u0938\u094D\u0925\u093F\u0924\u093F", { type: "enum" }),
    internal12("candidates", "Candidates", "\u0909\u092E\u094D\u092E\u0940\u0926\u0935\u093E\u0930", { type: "json" }),
    num9("totalVoters", "Total Voters", "\u0915\u0941\u0932 \u092E\u0924\u0926\u093E\u0924\u093E"),
    num9("votesCast", "Votes Cast", "\u0921\u093E\u0932\u0947 \u0917\u090F \u092E\u0924"),
    c12("winnerId", "Winner", "\u0935\u093F\u091C\u0947\u0924\u093E"),
    c12("remarks", "Remarks", "\u091F\u093F\u092A\u094D\u092A\u0923\u0940"),
    internal12("createdAt", "Created At", "\u0928\u093F\u0930\u094D\u092E\u093E\u0923 \u0938\u092E\u092F", { type: "date" }),
    internal12("createdBy", "Created By", "\u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E")
  ]
};
var auditLog = {
  key: "audit_log",
  table: "audit_log",
  domain: "evidence",
  label: "Audit Log",
  labelHi: "\u0911\u0921\u093F\u091F \u0932\u0949\u0917",
  minRole: "admin",
  scope: "society",
  nature: "evidence",
  dependsOn: ["society"],
  naturalKey: ["id"],
  formats: ["csv", "json"],
  backupPolicy: "sidecar",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("created_at", "When", "\u0915\u092C", { type: "date" }),
    c12("actor_name", "Actor", "\u0915\u0930\u094D\u0924\u093E"),
    c12("actor_email", "Actor Email", "\u0915\u0930\u094D\u0924\u093E \u0908\u092E\u0947\u0932", { piiClass: "contact" }),
    c12("actor_role", "Actor Role", "\u0915\u0930\u094D\u0924\u093E \u092D\u0942\u092E\u093F\u0915\u093E"),
    c12("entity_type", "Entity Type", "\u0907\u0915\u093E\u0908 \u092A\u094D\u0930\u0915\u093E\u0930"),
    c12("entity_id", "Entity ID", "\u0907\u0915\u093E\u0908 \u0906\u0908\u0921\u0940"),
    c12("action", "Action", "\u0915\u094D\u0930\u093F\u092F\u093E", { type: "enum" }),
    internal12("before", "Before", "\u092A\u0942\u0930\u094D\u0935", { type: "json" }),
    internal12("after", "After", "\u092A\u0936\u094D\u091A\u093E\u0924", { type: "json" }),
    c12("reason", "Reason", "\u0915\u093E\u0930\u0923"),
    internal12("source", "Source", "\u0938\u094D\u0930\u094B\u0924")
  ]
};
var guideCertificate = {
  key: "guide_certificate",
  table: "guide_certificates",
  domain: "evidence",
  label: "Guide Certificates",
  labelHi: "\u0917\u093E\u0907\u0921 \u092A\u094D\u0930\u092E\u093E\u0923\u092A\u0924\u094D\u0930",
  minRole: "admin",
  // GLOBAL, not society — this table has NO society_id column (cert_no PK, all societies'
  // certificates in one RLS+definer-RPC registry). Marking it 'society' made both the
  // server AND client backup try to read it with `.eq('society_id', …)` and abort on
  // "column society_id does not exist". A global entity is excluded from per-society backup.
  scope: "global",
  nature: "evidence",
  dependsOn: [],
  naturalKey: ["cert_no"],
  formats: ["csv", "json"],
  backupPolicy: "sidecar",
  columns: [
    c12("cert_no", "Certificate No.", "\u092A\u094D\u0930\u092E\u093E\u0923\u092A\u0924\u094D\u0930 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c12("holder_name", "Holder Name", "\u0927\u093E\u0930\u0915 \u0928\u093E\u092E"),
    c12("email", "Email", "\u0908\u092E\u0947\u0932", { piiClass: "contact" }),
    c12("society_name", "Society Name", "\u0938\u092E\u093F\u0924\u093F \u0928\u093E\u092E"),
    num9("parts_passed", "Parts Passed", "\u0909\u0924\u094D\u0924\u0940\u0930\u094D\u0923 \u092D\u093E\u0917"),
    c12("issued_at", "Issued At", "\u091C\u093E\u0930\u0940 \u0924\u093F\u0925\u093F", { type: "date" })
  ]
};
var societies = {
  key: "societies",
  table: "societies",
  domain: "system",
  label: "Societies Registry",
  labelHi: "\u0938\u092E\u093F\u0924\u093F \u0930\u091C\u093F\u0938\u094D\u091F\u094D\u0930\u0940",
  minRole: "admin",
  scope: "global",
  nature: "system",
  dependsOn: [],
  naturalKey: ["registration_no"],
  formats: [],
  backupPolicy: "exclude",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("registration_no", "Registration No.", "\u092A\u0902\u091C\u0940\u0915\u0930\u0923 \u0938\u0902\u0916\u094D\u092F\u093E"),
    c12("name", "Name", "\u0928\u093E\u092E")
  ]
};
var societyUsers = {
  key: "society_user",
  table: "society_users",
  domain: "system",
  label: "Society Users",
  labelHi: "\u0938\u092E\u093F\u0924\u093F \u0909\u092A\u092F\u094B\u0917\u0915\u0930\u094D\u0924\u093E",
  minRole: "admin",
  scope: "society",
  nature: "system",
  dependsOn: [],
  naturalKey: ["email"],
  formats: [],
  backupPolicy: "exclude",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("email", "Email", "\u0908\u092E\u0947\u0932", { piiClass: "contact" }),
    c12("password", "Password Hash", "\u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u0939\u0948\u0936", { piiClass: "identity", defaultVisible: false }),
    c12("mfa_secret", "MFA Secret", "\u090F\u092E\u090F\u092B\u090F \u0938\u0940\u0915\u094D\u0930\u0947\u091F", { piiClass: "identity", defaultVisible: false }),
    c12("role", "Role", "\u092D\u0942\u092E\u093F\u0915\u093E", { type: "enum" })
  ]
};
var societyCapabilities = {
  key: "society_capability",
  table: "society_capabilities",
  domain: "system",
  label: "Society Capabilities",
  labelHi: "\u0938\u092E\u093F\u0924\u093F \u0915\u094D\u0937\u092E\u0924\u093E\u090F\u0901",
  minRole: "admin",
  scope: "society",
  nature: "system",
  dependsOn: [],
  naturalKey: ["id"],
  formats: [],
  backupPolicy: "exclude",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("capability", "Capability", "\u0915\u094D\u0937\u092E\u0924\u093E"),
    c12("mode", "Mode", "\u0935\u093F\u0927\u093F", { type: "enum" }),
    c12("source", "Source", "\u0938\u094D\u0930\u094B\u0924", { type: "enum" })
  ]
};
var platformAdmins = {
  key: "platform_admin",
  table: "platform_admins",
  domain: "system",
  label: "Platform Admins",
  labelHi: "\u092A\u094D\u0932\u0947\u091F\u092B\u093C\u0949\u0930\u094D\u092E \u0935\u094D\u092F\u0935\u0938\u094D\u0925\u093E\u092A\u0915",
  minRole: "admin",
  scope: "global",
  nature: "system",
  dependsOn: [],
  naturalKey: ["email"],
  formats: [],
  backupPolicy: "exclude",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("email", "Email", "\u0908\u092E\u0947\u0932", { piiClass: "contact" }),
    c12("name", "Name", "\u0928\u093E\u092E")
  ]
};
var userMfa = {
  key: "user_mfa",
  table: "user_mfa",
  domain: "system",
  label: "User MFA",
  labelHi: "\u0909\u092A\u092F\u094B\u0917\u0915\u0930\u094D\u0924\u093E \u090F\u092E\u090F\u092B\u090F",
  minRole: "admin",
  scope: "global",
  nature: "system",
  dependsOn: [],
  naturalKey: ["email"],
  formats: [],
  backupPolicy: "exclude",
  columns: [
    c12("email", "Email", "\u0908\u092E\u0947\u0932", { piiClass: "contact" }),
    c12("secret", "TOTP Secret", "\u091F\u0940\u0913\u091F\u0940\u092A\u0940 \u0938\u0940\u0915\u094D\u0930\u0947\u091F", { piiClass: "identity", defaultVisible: false })
  ]
};
var userMfaRecovery = {
  key: "user_mfa_recovery",
  table: "user_mfa_recovery",
  domain: "system",
  label: "User MFA Recovery Codes",
  labelHi: "\u090F\u092E\u090F\u092B\u090F \u0930\u093F\u0915\u0935\u0930\u0940 \u0915\u094B\u0921",
  minRole: "admin",
  scope: "global",
  nature: "system",
  dependsOn: [],
  naturalKey: ["id"],
  formats: [],
  backupPolicy: "exclude",
  columns: [
    c12("id", "ID", "\u0906\u0908\u0921\u0940", { defaultVisible: false }),
    c12("email", "Email", "\u0908\u092E\u0947\u0932", { piiClass: "contact" }),
    c12("code_hash", "Recovery Code Hash", "\u0930\u093F\u0915\u0935\u0930\u0940 \u0915\u094B\u0921 \u0939\u0948\u0936", { piiClass: "identity", defaultVisible: false })
  ]
};
var documentSequences = {
  key: "document_sequence",
  table: "document_sequences",
  domain: "system",
  label: "Document Numbering",
  labelHi: "\u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0915\u094D\u0930\u092E\u093E\u0902\u0915\u0928",
  minRole: "admin",
  scope: "society",
  nature: "system",
  dependsOn: [],
  naturalKey: ["book", "fy"],
  formats: ["json"],
  backupPolicy: "full",
  columns: [
    c12("book", "Book", "\u092C\u0939\u0940"),
    c12("fy", "Financial Year", "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937"),
    c12("last_number", "Last Number", "\u0905\u0902\u0924\u093F\u092E \u0938\u0902\u0916\u094D\u092F\u093E", { type: "number" }),
    c12("updated_at", "Updated At", "\u0905\u0926\u094D\u092F\u0924\u0928", { type: "date", defaultVisible: false })
  ]
};
var ledgerEvents = {
  key: "ledger_event",
  table: "ledger_events",
  domain: "system",
  label: "Ledger Events",
  labelHi: "\u0932\u0947\u091C\u0930 \u0907\u0935\u0947\u0902\u091F\u094D\u0938",
  minRole: "admin",
  scope: "society",
  nature: "evidence",
  dependsOn: [],
  naturalKey: ["event_id"],
  formats: ["json"],
  backupPolicy: "sidecar",
  columns: [
    c12("event_id", "Event ID", "\u0907\u0935\u0947\u0902\u091F \u0906\u0908\u0921\u0940"),
    c12("event_type", "Event Type", "\u0907\u0935\u0947\u0902\u091F \u092A\u094D\u0930\u0915\u093E\u0930", { type: "enum" }),
    c12("aggregate_type", "Aggregate", "\u090F\u0917\u094D\u0930\u0940\u0917\u0947\u091F", { type: "enum" }),
    c12("aggregate_id", "Aggregate ID", "\u090F\u0917\u094D\u0930\u0940\u0917\u0947\u091F \u0906\u0908\u0921\u0940"),
    c12("sequence", "Sequence", "\u0915\u094D\u0930\u092E", { type: "number", defaultVisible: false }),
    c12("occurred_at", "Occurred At", "\u0918\u091F\u093F\u0924", { type: "date", defaultVisible: false })
  ]
};
var PLATFORM_ENTITIES = [
  asset,
  bankReconciliation,
  tdsEntry,
  tdsChallan,
  tdsChallanLink,
  ewayBill,
  complianceFiling,
  recoverable,
  kachiAaratEntry,
  p7Entry,
  budget,
  auditObjection,
  meeting,
  election,
  auditLog,
  guideCertificate,
  documentSequences,
  ledgerEvents,
  societies,
  societyUsers,
  societyCapabilities,
  platformAdmins,
  userMfa,
  userMfaRecovery
];

// src/lib/export/registry.ts
var REGISTRY = [
  ...CORE_ENTITIES,
  ...MEMBER_ENTITIES,
  ...INVENTORY_ENTITIES,
  ...TRADE_ENTITIES,
  ...LENDING_ENTITIES,
  ...PAYROLL_ENTITIES,
  ...PROCUREMENT_ENTITIES,
  ...DAIRY_ENTITIES,
  ...HOUSING_ENTITIES,
  ...MARKETING_ENTITIES,
  ...CONSUMER_ENTITIES,
  ...PLATFORM_ENTITIES
];
function backupEntities() {
  return REGISTRY.filter((e) => e.backupPolicy !== "exclude" && e.scope === "society");
}

// node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i = 0; i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b[30]);
  for (var i = 1; i < 30; ++i) {
    for (var j = b[i]; j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = function(cd, mb, r) {
  var s = cd.length;
  var i = 0;
  var l = new u16(mb);
  for (; i < s; ++i) {
    if (cd[i])
      ++l[cd[i] - 1];
  }
  var le = new u16(mb);
  for (i = 1; i < mb; ++i) {
    le[i] = le[i - 1] + l[i - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        var sv = i << 4 | cd[i];
        var r_1 = mb - cd[i];
        var v = le[cd[i] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
      }
    }
  }
  return co;
};
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i = 0; i < d.length; ++i) {
    if (d[i])
      t.push({ s: i, f: d[i] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i2].f ? i0++ : i2++];
    r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i = 1; i < s; ++i) {
    if (t2[i].s > maxSym)
      maxSym = t2[i].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (; i < s; ++i) {
      var i2_1 = t2[i].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i;
    }
    for (; i >= 0 && dt; --i) {
      var i2_3 = t2[i].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln = function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c13) {
  var s = c13.length;
  while (s && !c13[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c13[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i = 1; i <= s; ++i) {
    if (c13[i] == cln && i != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (; cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (; cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c13[i];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i = 0; i < cl.length; ++i)
    l += cf[i] * cl[i];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i = 0; i < s; ++i)
    out[o + i + 4] = dat[i];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i = 0; i < lclt.length; ++i)
    ++lcfreq[lclt[i] & 31];
  for (var i = 0; i < lcdt.length; ++i)
    ++lcfreq[lcdt[i] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i = 0; i < nlcc; ++i)
      wbits(out, p + 3 * i, lct[clim[i]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i = 0; i < clct.length; ++i) {
        var len = clct[i] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i = 0; i < li; ++i) {
    var sym = syms[i];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c13 = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i2) {
      return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25e3);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (; i + 2 < s; ++i) {
      var hv = hsh(i);
      var imod = i & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i) {
        var rem = s - i;
        if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
          li = lc_1 = eb = 0, bs = i;
          for (var j = 0; j < 286; ++j)
            lf[j] = 0;
          for (var j = 0; j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c13, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i + l] == dat[i + l - dif]) {
              var nl = 0;
              for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0; j < mmd; ++j) {
                  var ti = i - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i];
          ++lf[dat[i]];
        }
      }
    }
    for (i = Math.max(i, wi); i < s; ++i) {
      syms[li++] = dat[i];
      ++lf[dat[i]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i, st.w = wi;
    }
  } else {
    for (var i = st.w || 0; i < s + lst; i += 65535) {
      var e = i + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
};
var crct = /* @__PURE__ */ function() {
  var t = new Int32Array(256);
  for (var i = 0; i < 256; ++i) {
    var c13 = i, k = 9;
    while (--k)
      c13 = (c13 & 1 && -306674912) ^ c13 >>> 1;
    t[i] = c13;
  }
  return t;
}();
var crc = function() {
  var c13 = -1;
  return {
    p: function(d) {
      var cr = c13;
      for (var i = 0; i < d.length; ++i)
        cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
      c13 = cr;
    },
    d: function() {
      return ~c13;
    }
  };
};
var dopt = function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
};
var mrg = function(a, b) {
  var o = {};
  for (var k in a)
    o[k] = a[k];
  for (var k in b)
    o[k] = b[k];
  return o;
};
var wbytes = function(d, b, v) {
  for (; v; ++b)
    d[b] = v, v >>>= 8;
};
function deflateSync(data, opts) {
  return dopt(data, opts || {}, 0, 0);
}
var fltn = function(d, p, t, o) {
  for (var k in d) {
    var val = d[k], n = p + k, op = o;
    if (Array.isArray(val))
      op = mrg(o, val[1]), val = val[0];
    if (ArrayBuffer.isView(val))
      t[n] = [val, op];
    else {
      t[n += "/"] = [new u8(0), op];
      fltn(val, n, t, o);
    }
  }
};
var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i = 0; i < str.length; ++i)
      ar_1[i] = str.charCodeAt(i);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = function(v) {
    ar[ai++] = v;
  };
  for (var i = 0; i < l; ++i) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i << 1));
      n.set(ar);
      ar = n;
    }
    var c13 = str.charCodeAt(i);
    if (c13 < 128 || latin1)
      w(c13);
    else if (c13 < 2048)
      w(192 | c13 >> 6), w(128 | c13 & 63);
    else if (c13 > 55295 && c13 < 57344)
      c13 = 65536 + (c13 & 1023 << 10) | str.charCodeAt(++i) & 1023, w(240 | c13 >> 18), w(128 | c13 >> 12 & 63), w(128 | c13 >> 6 & 63), w(128 | c13 & 63);
    else
      w(224 | c13 >> 12), w(128 | c13 >> 6 & 63), w(128 | c13 & 63);
  }
  return slc(ar, 0, ai);
}
var exfl = function(ex) {
  var le = 0;
  if (ex) {
    for (var k in ex) {
      var l = ex[k].length;
      if (l > 65535)
        err(9);
      le += l + 4;
    }
  }
  return le;
};
var wzh = function(d, b, f, fn, u, c13, ce, co) {
  var fl2 = fn.length, ex = f.extra, col = co && co.length;
  var exl = exfl(ex);
  wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
  if (ce != null)
    d[b++] = 20, d[b++] = f.os;
  d[b] = 20, b += 2;
  d[b++] = f.flag << 1 | (c13 < 0 && 8), d[b++] = u && 8;
  d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
  var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
  if (y < 0 || y > 119)
    err(10);
  wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
  if (c13 != -1) {
    wbytes(d, b, f.crc);
    wbytes(d, b + 4, c13 < 0 ? -c13 - 2 : c13);
    wbytes(d, b + 8, f.size);
  }
  wbytes(d, b + 12, fl2);
  wbytes(d, b + 14, exl), b += 16;
  if (ce != null) {
    wbytes(d, b, col);
    wbytes(d, b + 6, f.attrs);
    wbytes(d, b + 10, ce), b += 14;
  }
  d.set(fn, b);
  b += fl2;
  if (exl) {
    for (var k in ex) {
      var exf = ex[k], l = exf.length;
      wbytes(d, b, +k);
      wbytes(d, b + 2, l);
      d.set(exf, b + 4), b += 4 + l;
    }
  }
  if (col)
    d.set(co, b), b += col;
  return b;
};
var wzf = function(o, b, c13, d, e) {
  wbytes(o, b, 101010256);
  wbytes(o, b + 8, c13);
  wbytes(o, b + 10, c13);
  wbytes(o, b + 12, d);
  wbytes(o, b + 16, e);
};
function zipSync(data, opts) {
  if (!opts)
    opts = {};
  var r = {};
  var files = [];
  fltn(data, "", r, opts);
  var o = 0;
  var tot = 0;
  for (var fn in r) {
    var _a2 = r[fn], file = _a2[0], p = _a2[1];
    var compression = p.level == 0 ? 0 : 8;
    var f = strToU8(fn), s = f.length;
    var com = p.comment, m = com && strToU8(com), ms = m && m.length;
    var exl = exfl(p.extra);
    if (s > 65535)
      err(11);
    var d = compression ? deflateSync(file, p) : file, l = d.length;
    var c13 = crc();
    c13.p(file);
    files.push(mrg(p, {
      size: file.length,
      crc: c13.d(),
      c: d,
      f,
      m,
      u: s != fn.length || m && com.length != ms,
      o,
      compression
    }));
    o += 30 + s + exl + l;
    tot += 76 + 2 * (s + exl) + (ms || 0) + l;
  }
  var out = new u8(tot + 22), oe = o, cdl = tot - o;
  for (var i = 0; i < files.length; ++i) {
    var f = files[i];
    wzh(out, f.o, f, f.f, f.u, f.c.length);
    var badd = 30 + f.f.length + exfl(f.extra);
    out.set(f.c, f.o + badd);
    wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
  }
  wzf(out, o, files.length, cdl, oe);
  return out;
}

// src/lib/backup/integrity.ts
var HASH_ALGORITHM = "SHA-256";
function canonicalize(value) {
  return JSON.stringify(canonicalValue(value));
}
function canonicalValue(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => v === void 0 ? null : canonicalValue(v));
  const source = value;
  const out = {};
  for (const key of Object.keys(source).sort()) {
    if (source[key] === void 0) continue;
    out[key] = canonicalValue(source[key]);
  }
  return out;
}
function toHex(bytes) {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}
async function sha256Bytes(bytes) {
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, bytes);
  return toHex(new Uint8Array(digest));
}
async function sha256Text(text) {
  return sha256Bytes(new TextEncoder().encode(text));
}
async function sha256Canonical(value) {
  return sha256Text(canonicalize(value));
}

// src/lib/backup/manifest.ts
var BACKUP_FORMAT_VERSION = "1.0";
function entityPath(key, policy) {
  switch (policy) {
    case "full":
      return `data/${key}.ndjson`;
    case "replay":
      return `derived/${key}.ndjson`;
    case "sidecar":
      return `evidence/${key}.ndjson`;
    case "exclude":
      throw new Error(`"${key}" is excluded from backups and has no path`);
    default:
      throw new Error(`"${key}" has an unrecognised backup policy "${policy}"`);
  }
}
async function registryFingerprint(entities) {
  const shape = [...entities].map((e) => ({
    key: e.key,
    table: e.table,
    policy: e.backupPolicy,
    columns: e.columns.map((c13) => c13.key).sort()
  })).sort((a, b) => a.key.localeCompare(b.key));
  return sha256Canonical(shape);
}
var FORBIDDEN_ENCRYPTION_KEYS = ["key", "password", "passphrase", "secret", "derivedKey"];
async function buildManifest(input) {
  if (input.encryption) {
    for (const forbidden of FORBIDDEN_ENCRYPTION_KEYS) {
      if (forbidden in input.encryption) {
        throw new Error(`encryption params must never carry "${forbidden}" \u2014 the key would ship with the archive`);
      }
    }
  }
  const totals = {
    entityCount: input.entities.length,
    rowCount: input.entities.reduce((sum, e) => sum + e.rowCount, 0),
    bytes: input.entities.reduce((sum, e) => sum + e.bytes, 0)
  };
  const unsigned = {
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: input.appVersion,
    schemaVersion: input.schemaVersion,
    societyId: input.societyId,
    societyName: input.societyName,
    registrationNo: input.registrationNo,
    financialYear: input.financialYear,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    trigger: input.trigger,
    encryption: input.encryption ?? null,
    entities: input.entities,
    registryFingerprint: input.registryFingerprint,
    totals
  };
  return { ...unsigned, manifestHash: await sha256Canonical(unsigned) };
}

// src/lib/backup/ndjson.ts
function toNdjson(rows) {
  if (rows.length === 0) return "";
  return rows.map((row) => canonicalize(row)).join("\n") + "\n";
}

// src/lib/backup/writer.ts
var MANIFEST_PATH = "manifest.json";
var ZIP_EPOCH = Date.UTC(1980, 0, 1);
var BackupIncompleteError = class extends Error {
  /** Which entity aborted the archive. */
  entityKey;
  // Not a parameter property: Node's type stripping is strip-only, and scripts/ imports
  // this module directly. See the same note in ndjson.ts.
  constructor(entityKey, message) {
    super(`backup aborted at "${entityKey}": ${message}`);
    this.name = "BackupIncompleteError";
    this.entityKey = entityKey;
  }
};
function planArchive(entities) {
  const written = [];
  const skipped = [];
  for (const entity of entities) {
    if (entity.backupPolicy === "exclude") {
      skipped.push({ key: entity.key, reason: "exclude" });
      continue;
    }
    if (entity.scope === "global") {
      skipped.push({ key: entity.key, reason: "global" });
      continue;
    }
    written.push({ entity, path: entityPath(entity.key, entity.backupPolicy) });
  }
  if (written.length + skipped.length !== entities.length) {
    throw new Error(
      `archive plan lost entities: ${entities.length} declared, ${written.length} written + ${skipped.length} skipped`
    );
  }
  const seen = /* @__PURE__ */ new Set();
  for (const { path } of written) {
    if (seen.has(path)) throw new Error(`two entities map to the same archive path "${path}"`);
    seen.add(path);
  }
  return { written, skipped };
}
async function buildArchive(input) {
  const plan = planArchive(input.entities);
  const files = {};
  const entityManifests = [];
  let done = 0;
  for (const { entity, path } of plan.written) {
    const { rows, truncated, error } = await input.fetchRows(entity, input.societyId);
    if (error) throw new BackupIncompleteError(entity.key, `could not be read (${error})`);
    if (truncated) throw new BackupIncompleteError(entity.key, "holds more rows than could be read in one pass");
    const text = toNdjson(rows);
    const bytes = strToU8(text);
    files[path] = bytes;
    entityManifests.push({
      key: entity.key,
      table: entity.table,
      policy: entity.backupPolicy,
      rowCount: rows.length,
      bytes: bytes.length,
      sha256: await sha256Bytes(bytes),
      columns: entity.columns.map((c13) => c13.key)
    });
    input.onProgress?.(++done, plan.written.length, entity.key);
  }
  const manifest = await buildManifest({
    ...input.meta,
    entities: entityManifests,
    registryFingerprint: await registryFingerprint(input.entities)
  });
  files[MANIFEST_PATH] = strToU8(JSON.stringify(manifest, null, 2));
  const archive = zipSync(files, { level: 6, mtime: ZIP_EPOCH });
  return { archive, manifest, plan };
}
function archiveFileName(societyName, financialYear, createdAt) {
  const slug = societyName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "society";
  const stamp = createdAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return `${slug}-FY${financialYear}-${stamp}.slbak`;
}

// src/lib/backup/crypto.ts
var CONTAINER_MAGIC = "SLBAK1\n";
var PBKDF2_ITERATIONS = 6e5;
var SALT_BYTES = 16;
var IV_BYTES = 12;
function toBase64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
}
async function deriveKey(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    // not extractable
    ["encrypt", "decrypt"]
  );
}
var MAGIC_BYTES = new TextEncoder().encode(CONTAINER_MAGIC);
async function encryptArchive(archive, passphrase, meta, options = {}) {
  if (!passphrase) throw new Error("a passphrase is required");
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = options.iv ?? crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const iterations = options.iterations ?? PBKDF2_ITERATIONS;
  const header = {
    ...meta,
    encryption: {
      algo: "AES-256-GCM",
      kdf: "PBKDF2-SHA256",
      iterations,
      salt: toBase64(salt),
      iv: toBase64(iv)
    }
  };
  const headerBytes = new TextEncoder().encode(canonicalize(header));
  const prefix = new Uint8Array(MAGIC_BYTES.length + 4 + headerBytes.length);
  prefix.set(MAGIC_BYTES, 0);
  new DataView(prefix.buffer).setUint32(MAGIC_BYTES.length, headerBytes.length, false);
  prefix.set(headerBytes, MAGIC_BYTES.length + 4);
  const key = await deriveKey(passphrase, salt, iterations);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: prefix },
    key,
    archive
  ));
  const out = new Uint8Array(prefix.length + ciphertext.length);
  out.set(prefix, 0);
  out.set(ciphertext, prefix.length);
  return out;
}
export {
  BACKUP_FORMAT_VERSION,
  REGISTRY,
  archiveFileName,
  backupEntities,
  buildArchive,
  encryptArchive,
  planArchive,
  sha256Bytes
};

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
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i = 1; i < a.length; ++i) {
    if (a[i] > m)
      m = a[i];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
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
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i = 0; i < hcLen; ++i) {
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i = 0; i < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i++] = s;
          } else {
            var c13 = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c13 = ldt[i - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i++] = c13;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c13 = lm[bits16(dat, pos) & lms], sym = c13 >> 4;
      pos += c13 & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c13)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i = sym - 257, b = fleb[i];
          add = bits(dat, pos, (1 << b) - 1) + fl[i];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
var b2 = function(d, b) {
  return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
};
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
var dutf8 = function(d) {
  for (var r = "", i = 0; ; ) {
    var c13 = d[i++];
    var eb = (c13 > 127) + (c13 > 223) + (c13 > 239);
    if (i + eb > d.length)
      return { s: r, r: slc(d, i - 1) };
    if (!eb)
      r += String.fromCharCode(c13);
    else if (eb == 3) {
      c13 = ((c13 & 15) << 18 | (d[i++] & 63) << 12 | (d[i++] & 63) << 6 | d[i++] & 63) - 65536, r += String.fromCharCode(55296 | c13 >> 10, 56320 | c13 & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c13 & 31) << 6 | d[i++] & 63);
    else
      r += String.fromCharCode((c13 & 15) << 12 | (d[i++] & 63) << 6 | d[i++] & 63);
  }
};
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i = 0; i < dat.length; i += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i, i + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
var slzh = function(d, b) {
  return b + 30 + b2(d, b + 26) + b2(d, b + 28);
};
var zh = function(d, b, z) {
  var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
  var _a2 = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a2[0], su = _a2[1], off = _a2[2];
  return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
};
var z64hs = function(d, b, l, z, sc, su, off) {
  var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
  var nf = nsc + nsu + noff;
  if (z && nf) {
    for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
      if (b2(d, b) == 1) {
        return [
          nsc ? b8(d, b + 4 + 8 * nsu) : sc,
          nsu ? b8(d, b + 4) : su,
          noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
          1
        ];
      }
    }
    if (z < 2)
      err(13);
  }
  return [sc, su, off, 0];
};
function unzipSync(data, opts) {
  var files = {};
  var e = data.length - 22;
  for (; b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558)
      err(13);
  }
  ;
  var c13 = b2(data, e + 8);
  if (!c13)
    return {};
  var o = b4(data, e + 16);
  var z = b4(data, e - 20) == 117853008;
  if (z) {
    var ze = b4(data, e - 12);
    z = b4(data, ze) == 101075792;
    if (z) {
      c13 = b4(data, ze + 32);
      o = b4(data, ze + 48);
    }
  }
  var fltr = opts && opts.filter;
  for (var i = 0; i < c13; ++i) {
    var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
    o = no;
    if (!fltr || fltr({
      name: fn,
      size: sc,
      originalSize: su,
      compression: c_2
    })) {
      if (!c_2)
        files[fn] = slc(data, b, b + sc);
      else if (c_2 == 8)
        files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
      else
        err(14, "unknown compression type " + c_2);
    }
  }
  return files;
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
function digestsEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifyFiles(digests, contents) {
  const failures = [];
  for (const digest of digests) {
    const bytes = contents(digest.path);
    if (!bytes) {
      failures.push({ path: digest.path, reason: "missing" });
      continue;
    }
    if (bytes.length !== digest.bytes) {
      failures.push({ path: digest.path, reason: "size-mismatch", expected: digest.bytes, actual: bytes.length });
    }
    const actual = await sha256Bytes(bytes);
    if (!digestsEqual(actual, digest.sha256)) {
      failures.push({ path: digest.path, reason: "hash-mismatch", expected: digest.sha256, actual });
    }
  }
  return failures;
}

// src/lib/backup/crypto.ts
var CONTAINER_MAGIC = "SLBAK1\n";
var NotAnEncryptedArchiveError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "NotAnEncryptedArchiveError";
  }
};
var MAGIC_BYTES = new TextEncoder().encode(CONTAINER_MAGIC);
function isEncryptedArchive(bytes) {
  if (bytes.length < MAGIC_BYTES.length) return false;
  for (let i = 0; i < MAGIC_BYTES.length; i++) if (bytes[i] !== MAGIC_BYTES[i]) return false;
  return true;
}
function splitContainer(bytes) {
  if (!isEncryptedArchive(bytes)) throw new NotAnEncryptedArchiveError("missing SLBAK1 magic \u2014 this is not an encrypted archive");
  const lenOffset = MAGIC_BYTES.length;
  if (bytes.length < lenOffset + 4) throw new NotAnEncryptedArchiveError("truncated container");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLen = view.getUint32(lenOffset, false);
  const headerStart = lenOffset + 4;
  const headerEnd = headerStart + headerLen;
  if (headerLen === 0 || headerEnd > bytes.length) throw new NotAnEncryptedArchiveError("header length is out of range");
  const headerBytes = bytes.subarray(headerStart, headerEnd);
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(headerBytes));
  } catch {
    throw new NotAnEncryptedArchiveError("header is not valid JSON");
  }
  if (!header?.encryption?.salt || !header.encryption.iv) {
    throw new NotAnEncryptedArchiveError("header carries no encryption parameters");
  }
  return {
    headerBytes,
    header,
    ciphertext: bytes.subarray(headerEnd),
    // Everything before the ciphertext is authenticated: magic, length, header.
    aad: bytes.subarray(0, headerEnd)
  };
}
function readContainerHeader(bytes) {
  return splitContainer(bytes).header;
}

// src/lib/backup/manifest.ts
var SUPPORTED_FORMAT_MAJOR = 1;
function classifyFormatVersion(formatVersion) {
  if (typeof formatVersion !== "string" || formatVersion.trim().length === 0) {
    return { ok: false, kind: "malformed", reason: "the archive carries no format version" };
  }
  const m = /^(\d+)\.(\d+)$/.exec(formatVersion.trim());
  if (!m) {
    return { ok: false, kind: "malformed", reason: `archive format "${formatVersion}" is not a valid version` };
  }
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (major > SUPPORTED_FORMAT_MAJOR) {
    return {
      ok: false,
      kind: "too-new",
      reason: `this archive (format ${formatVersion}) was written by a newer version of SahakarLekha \u2014 update the app to read it`
    };
  }
  if (major < SUPPORTED_FORMAT_MAJOR) {
    return {
      ok: false,
      kind: "too-old",
      reason: `archive format ${formatVersion} is older than this build can read (needs ${SUPPORTED_FORMAT_MAJOR}.x)`
    };
  }
  return { ok: true, major, minor };
}
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
function fileDigests(manifest) {
  return manifest.entities.map((e) => ({
    path: entityPath(e.key, e.policy),
    sha256: e.sha256,
    bytes: e.bytes
  }));
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
async function computeManifestHash(manifest) {
  const { manifestHash: _ignored, ...rest } = manifest;
  return sha256Canonical(rest);
}
async function verifyManifest(manifest) {
  if (!manifest || typeof manifest.manifestHash !== "string" || manifest.manifestHash.length === 0) {
    return { ok: false, reason: "manifest carries no hash" };
  }
  const fmt = classifyFormatVersion(manifest.formatVersion);
  if (!fmt.ok) {
    return { ok: false, reason: fmt.reason };
  }
  const expected = await computeManifestHash(manifest);
  if (!digestsEqual(expected, manifest.manifestHash)) {
    return { ok: false, reason: "manifest hash does not match its contents \u2014 the file has been altered" };
  }
  const totals = {
    entityCount: manifest.entities.length,
    rowCount: manifest.entities.reduce((sum, e) => sum + e.rowCount, 0),
    bytes: manifest.entities.reduce((sum, e) => sum + e.bytes, 0)
  };
  if (totals.entityCount !== manifest.totals.entityCount || totals.rowCount !== manifest.totals.rowCount || totals.bytes !== manifest.totals.bytes) {
    return { ok: false, reason: "manifest totals disagree with its own entity list" };
  }
  return { ok: true };
}
function unplaceableEntities(manifest, entities) {
  const known = new Set(entities.map((e) => e.key));
  return manifest.entities.map((e) => e.key).filter((k) => !known.has(k)).sort();
}

// src/lib/backup/ndjson.ts
var NdjsonParseError = class extends Error {
  /** 1-based line number of the offending row. */
  line;
  // Written out rather than as a TypeScript parameter property: Node's type stripping is
  // strip-only, and `constructor(public readonly line: number)` is a transform, not a type.
  // scripts/ imports these modules directly, so they must survive stripping.
  constructor(line, message) {
    super(`line ${line}: ${message}`);
    this.name = "NdjsonParseError";
    this.line = line;
  }
};
function parseNdjson(text) {
  const rows = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (e) {
      throw new NdjsonParseError(i + 1, e instanceof Error ? e.message : "invalid JSON");
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new NdjsonParseError(i + 1, "each line must be a JSON object");
    }
    rows.push(parsed);
  }
  return rows;
}

// src/lib/backup/writer.ts
var MANIFEST_PATH = "manifest.json";
var ZIP_EPOCH = Date.UTC(1980, 0, 1);

// src/lib/backup/verify.ts
var emptyReport = (problem) => ({
  ok: false,
  manifest: null,
  problems: [problem],
  entities: [],
  unlistedFiles: [],
  unplaceable: [],
  fingerprintMatches: null,
  encrypted: false,
  encryptedHeader: null
});
async function verifyArchive(archive, options = {}) {
  if (isEncryptedArchive(archive)) {
    let header = null;
    try {
      header = readContainerHeader(archive);
    } catch {
    }
    return {
      ok: false,
      manifest: null,
      problems: ["this archive is encrypted \u2014 decrypt it with its passphrase before verifying"],
      entities: [],
      unlistedFiles: [],
      unplaceable: [],
      fingerprintMatches: null,
      encrypted: true,
      encryptedHeader: header
    };
  }
  let files;
  try {
    files = unzipSync(archive);
  } catch (e) {
    return emptyReport(`not a readable archive (${e instanceof Error ? e.message : "unknown error"})`);
  }
  const manifestBytes = files[MANIFEST_PATH];
  if (!manifestBytes) return emptyReport(`the archive has no ${MANIFEST_PATH}`);
  let manifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes));
  } catch {
    return emptyReport(`${MANIFEST_PATH} is not valid JSON`);
  }
  if (!manifest || !Array.isArray(manifest.entities)) {
    return emptyReport(`${MANIFEST_PATH} does not describe an archive`);
  }
  const problems = [];
  const verdict = await verifyManifest(manifest);
  if (!verdict.ok) problems.push(verdict.reason ?? "manifest failed verification");
  const digests = fileDigests(manifest);
  const failures = await verifyFiles(digests, (path) => files[path]);
  const failureByPath = new Map(failures.map((f) => [f.path, f]));
  const entities = manifest.entities.map((e, i) => {
    const path = digests[i].path;
    const failure = failureByPath.get(path);
    return {
      key: e.key,
      path,
      policy: e.policy,
      rowCount: e.rowCount,
      bytes: e.bytes,
      status: failure?.reason ?? "ok"
    };
  });
  for (const f of failures) problems.push(`${f.path}: ${f.reason}`);
  const listed = /* @__PURE__ */ new Set([MANIFEST_PATH, ...digests.map((d) => d.path)]);
  const unlistedFiles = Object.keys(files).filter((p) => !listed.has(p)).sort();
  for (const path of unlistedFiles) {
    problems.push(`${path}: present in the archive but not listed in the manifest`);
  }
  let unplaceable = [];
  let fingerprintMatches = null;
  if (options.entities) {
    unplaceable = unplaceableEntities(manifest, options.entities);
    for (const key of unplaceable) {
      problems.push(`"${key}" is in the archive but this build has no declaration for it`);
    }
    fingerprintMatches = await registryFingerprint(options.entities) === manifest.registryFingerprint;
  }
  return {
    // A fingerprint mismatch alone is NOT a failure: an older archive is still valid, and
    // `unplaceable` already names what actually cannot be restored. Failing on it would
    // reject every archive written before the next entity is added.
    ok: problems.length === 0,
    manifest,
    problems,
    entities,
    unlistedFiles,
    unplaceable,
    fingerprintMatches,
    encrypted: false,
    encryptedHeader: null
  };
}

// src/lib/restore/archive.ts
async function loadArchive(bytes, entities) {
  const report = await verifyArchive(bytes, { entities });
  if (!report.ok || !report.manifest) {
    return { report, rows: {}, unplaceable: report.unplaceable, problems: [], derivedEntries: [] };
  }
  const byKey = new Map(entities.map((e) => [e.key, e]));
  const rows = {};
  const problems = [];
  const files = unzipSync(bytes);
  for (const listed of report.manifest.entities) {
    const entity = byKey.get(listed.key);
    if (!entity) continue;
    if (entity.backupPolicy !== "full") continue;
    const path = entityPath(listed.key, "full");
    const file = files[path];
    if (!file) {
      problems.push(`${listed.key}: listed in the manifest but ${path} is not in the archive`);
      continue;
    }
    try {
      rows[listed.key] = parseNdjson(strFromU8(file));
    } catch (e) {
      problems.push(`${listed.key}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (rows[listed.key].length !== listed.rowCount) {
      problems.push(
        `${listed.key}: the manifest promised ${listed.rowCount} row(s) but the file holds ${rows[listed.key].length}`
      );
    }
  }
  if (problems.length) return { report, rows: {}, unplaceable: report.unplaceable, problems, derivedEntries: [] };
  let derivedEntries = [];
  const derivedPath = entityPath("voucher_entry", "replay");
  const derivedFile = files[derivedPath];
  if (derivedFile) {
    try {
      derivedEntries = parseNdjson(strFromU8(derivedFile));
    } catch (e) {
      return {
        report,
        rows: {},
        unplaceable: report.unplaceable,
        derivedEntries: [],
        problems: [`voucher_entry: ${e instanceof Error ? e.message : String(e)}`]
      };
    }
  }
  return { report, rows, unplaceable: report.unplaceable, problems: [], derivedEntries };
}

// src/lib/voucherUtils.ts
function getVoucherLines(v) {
  if (v.lines && v.lines.length > 0) return v.lines;
  const lines = [];
  if (v.debitAccountId && v.amount > 0) {
    lines.push({ id: `${v.id}-dr`, accountId: v.debitAccountId, type: "Dr", amount: v.amount });
  }
  if (v.creditAccountId && v.amount > 0) {
    lines.push({ id: `${v.id}-cr`, accountId: v.creditAccountId, type: "Cr", amount: v.amount });
  }
  return lines;
}
function buildVoucherEntries(v, societyId) {
  return getVoucherLines(v).map((l) => ({
    id: `${v.id}-${l.id}`,
    voucherId: v.id,
    accountId: l.accountId,
    dr: l.type === "Dr" ? l.amount : 0,
    cr: l.type === "Cr" ? l.amount : 0,
    narration: l.narration,
    societyId,
    // Denormalize the optional dimension only when present — keeps non-labour entries
    // byte-identical and safe even before the columns are migrated.
    ...v.workOrderId !== void 0 ? { workOrderId: v.workOrderId } : {},
    ...v.costCentreId !== void 0 ? { costCentreId: v.costCentreId } : {}
  }));
}

// src/lib/restore/replay.ts
var REPLAY_FIELDS = Object.freeze([
  "id",
  "voucherId",
  "accountId",
  "dr",
  "cr",
  "narration",
  "societyId",
  "workOrderId",
  "costCentreId"
]);
function replayEntries(vouchers, societyId) {
  const out = [];
  for (const v of vouchers) {
    if (v.isDeleted) continue;
    out.push(...buildVoucherEntries(v, societyId));
  }
  return out;
}

// src/lib/backup/rehearsal.ts
var round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
var sortedMap = (m) => {
  const out = {};
  for (const k of Object.keys(m).sort()) out[k] = m[k];
  return out;
};
function booksSignature(input) {
  let totalDr = 0;
  let totalCr = 0;
  const perAccount = {};
  for (const e of input.entries) {
    const dr = Number(e.dr) || 0;
    const cr = Number(e.cr) || 0;
    totalDr += dr;
    totalCr += cr;
    const acc = e.accountId === void 0 || e.accountId === null ? "(none)" : String(e.accountId);
    perAccount[acc] = (perAccount[acc] ?? 0) + dr - cr;
  }
  for (const acc of Object.keys(perAccount)) perAccount[acc] = round2(perAccount[acc]);
  totalDr = round2(totalDr);
  totalCr = round2(totalCr);
  const perItem = {};
  const negativeStockItems = [];
  let totalStockQty = 0;
  for (const item of input.stockItems) {
    const id = item.id === void 0 || item.id === null ? "(none)" : String(item.id);
    let qty = Number(item.openingStock) || 0;
    for (const m of input.stockMovements) {
      if (String(m.itemId) !== id) continue;
      const mq = Number(m.qty) || 0;
      if (m.type === "purchase" || m.type === "adjustment" && mq > 0) qty += mq;
      else qty -= Math.abs(mq);
    }
    if (qty < 0) negativeStockItems.push(id);
    qty = Math.max(0, qty);
    perItem[id] = round2(qty);
    totalStockQty += perItem[id];
  }
  return {
    entryCount: input.entries.length,
    totalDr,
    totalCr,
    balanced: totalDr === totalCr,
    perAccount: sortedMap(perAccount),
    stockItemCount: input.stockItems.length,
    totalStockQty: round2(totalStockQty),
    perItem: sortedMap(perItem),
    negativeStockItems: negativeStockItems.sort()
  };
}
function compareRehearsal(source, restored) {
  const differences = [];
  const accounts = /* @__PURE__ */ new Set();
  const items = /* @__PURE__ */ new Set();
  if (source.balanced !== restored.balanced) differences.push({ kind: "balance", source: source.balanced, restored: restored.balanced });
  if (source.totalDr !== restored.totalDr) differences.push({ kind: "totalDr", source: source.totalDr, restored: restored.totalDr });
  if (source.totalCr !== restored.totalCr) differences.push({ kind: "totalCr", source: source.totalCr, restored: restored.totalCr });
  if (source.entryCount !== restored.entryCount) differences.push({ kind: "entryCount", source: source.entryCount, restored: restored.entryCount });
  if (source.stockItemCount !== restored.stockItemCount) differences.push({ kind: "stockCount", source: source.stockItemCount, restored: restored.stockItemCount });
  for (const acc of /* @__PURE__ */ new Set([...Object.keys(source.perAccount), ...Object.keys(restored.perAccount)])) {
    const s = source.perAccount[acc] ?? 0;
    const r = restored.perAccount[acc] ?? 0;
    if (s !== r) {
      differences.push({ kind: "account", key: acc, source: s, restored: r });
      accounts.add(acc);
    }
  }
  for (const it of /* @__PURE__ */ new Set([...Object.keys(source.perItem), ...Object.keys(restored.perItem)])) {
    const s = source.perItem[it] ?? 0;
    const r = restored.perItem[it] ?? 0;
    if (s !== r) {
      differences.push({ kind: "item", key: it, source: s, restored: r });
      items.add(it);
    }
  }
  return {
    ok: differences.length === 0,
    sourceBalanced: source.balanced,
    differences,
    accounts: [...accounts].sort(),
    items: [...items].sort()
  };
}

// src/lib/backup/health.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
function ageDays(iso, now) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY_MS);
}
function backupHealth(inputs) {
  const freshnessDays = inputs.freshnessDays ?? 7;
  const now = Date.parse(inputs.now);
  if (Number.isNaN(now)) {
    return { status: "unknown", reasons: ["the current time is unknown"], backupAgeDays: null, rehearsalAgeDays: null, proven: false };
  }
  const backupAgeDays = ageDays(inputs.lastBackupAt, now);
  const rehearsalAgeDays = ageDays(inputs.lastRehearsal?.at ?? null, now);
  const reasons = [];
  let red = false;
  if (backupAgeDays === null) {
    reasons.push("no backup has ever been taken");
    red = true;
  } else if (backupAgeDays > freshnessDays) {
    reasons.push(`the last backup is ${backupAgeDays} days old`);
  }
  if (!inputs.lastVerifyAt) {
    reasons.push("the last backup was never verified");
  }
  let proven = false;
  if (!inputs.lastRehearsal) {
    reasons.push("the backup has never been rehearsed \u2014 it is not proven restorable");
  } else if (!inputs.lastRehearsal.passed) {
    reasons.push("the last rehearsal FAILED \u2014 the backup did not reproduce the books");
    red = true;
  } else if (rehearsalAgeDays !== null && rehearsalAgeDays > freshnessDays) {
    reasons.push(`the last successful rehearsal is ${rehearsalAgeDays} days old`);
  } else {
    proven = true;
  }
  let status;
  if (reasons.length === 0) status = "green";
  else if (red) status = "red";
  else status = "amber";
  return { status, reasons, backupAgeDays, rehearsalAgeDays, proven };
}

// src/lib/backup/rehearsalRun.ts
var VOUCHER = "voucher";
var STOCK_ITEM = "stock_item";
var STOCK_MOVEMENT = "stock_movement";
var asVouchers = (rows) => rows;
function signatureOf(vouchers, stockItems, stockMovements, societyId) {
  const entries = replayEntries(asVouchers(vouchers), societyId);
  return booksSignature({ entries, stockItems, stockMovements });
}
async function runRehearsal(input) {
  try {
    const loaded = await input.loadArchive(input.bytes, input.entities);
    if (!loaded.report.ok) {
      return { status: "archive-invalid", problems: loaded.report.problems.length ? loaded.report.problems : ["the archive did not verify"] };
    }
    if (loaded.problems.length) {
      return { status: "archive-invalid", problems: loaded.problems };
    }
    const restored = signatureOf(
      loaded.rows[VOUCHER] ?? [],
      loaded.rows[STOCK_ITEM] ?? [],
      loaded.rows[STOCK_MOVEMENT] ?? [],
      input.societyId
    );
    const byKey = new Map(input.entities.map((e) => [e.key, e]));
    const liveRows = {};
    for (const key of [VOUCHER, STOCK_ITEM, STOCK_MOVEMENT]) {
      const entity = byKey.get(key);
      if (!entity) return { status: "error", message: `this build has no "${key}" entity` };
      const res = await input.fetchRows(entity, input.societyId);
      if (res.error) return { status: "read-failed", entityKey: key, message: res.error };
      if (res.truncated) return { status: "read-failed", entityKey: key, message: "holds more rows than could be read in one pass" };
      liveRows[key] = res.rows;
    }
    const live = signatureOf(liveRows[VOUCHER], liveRows[STOCK_ITEM], liveRows[STOCK_MOVEMENT], input.societyId);
    const verdict = compareRehearsal(live, restored);
    const health = backupHealth({
      lastBackupAt: input.backupCreatedAt ?? input.now,
      lastVerifyAt: input.now,
      // we just verified it, above
      lastRehearsal: { at: input.now, passed: verdict.ok },
      now: input.now
    });
    return { status: verdict.ok ? "passed" : "failed", verdict, live, restored, health };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
export {
  REGISTRY,
  loadArchive,
  runRehearsal
};

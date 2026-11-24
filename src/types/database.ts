export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      _member_ref_backup: {
        Row: {
          id: number
          old_member_id: string
          row_id: string
          saved_at: string
          society_id: string
          tbl: string
        }
        Insert: {
          id?: number
          old_member_id: string
          row_id: string
          saved_at?: string
          society_id: string
          tbl: string
        }
        Update: {
          id?: number
          old_member_id?: string
          row_id?: string
          saved_at?: string
          society_id?: string
          tbl?: string
        }
        Relationships: []
      }
      _rls_182_backup: {
        Row: {
          cmd: string
          created: string[]
          permissive: string
          policyname: string
          qual: string | null
          roles: string[]
          tablename: string
          with_check: string | null
        }
        Insert: {
          cmd: string
          created: string[]
          permissive: string
          policyname: string
          qual?: string | null
          roles: string[]
          tablename: string
          with_check?: string | null
        }
        Update: {
          cmd?: string
          created?: string[]
          permissive?: string
          policyname?: string
          qual?: string | null
          roles?: string[]
          tablename?: string
          with_check?: string | null
        }
        Relationships: []
      }
      _soc001_orphans_backup: {
        Row: {
          id: number
          row_data: Json
          saved_at: string
          tbl: string
        }
        Insert: {
          id?: number
          row_data: Json
          saved_at?: string
          tbl: string
        }
        Update: {
          id?: number
          row_data?: Json
          saved_at?: string
          tbl?: string
        }
        Relationships: []
      }
      account_reclass_log: {
        Row: {
          account_id: string
          id: number
          logged_at: string
          migration: string
          old_row: Json
          society_id: string
        }
        Insert: {
          account_id: string
          id?: number
          logged_at?: string
          migration: string
          old_row: Json
          society_id: string
        }
        Update: {
          account_id?: string
          id?: number
          logged_at?: string
          migration?: string
          old_row?: Json
          society_id?: string
        }
        Relationships: []
      }
      account_roles: {
        Row: {
          account_id: string
          role: string
          society_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          role: string
          society_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          role?: string
          society_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_roles_account_fkey"
            columns: ["account_id", "society_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "society_id"]
          },
        ]
      }
      account_seed_log: {
        Row: {
          account_id: string
          id: number
          logged_at: string
          migration: string
          society_id: string
        }
        Insert: {
          account_id: string
          id?: number
          logged_at?: string
          migration: string
          society_id: string
        }
        Update: {
          account_id?: string
          id?: number
          logged_at?: string
          migration?: string
          society_id?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          code: string | null
          cropCategory: string | null
          id: string
          isGroup: boolean | null
          isSystem: boolean | null
          jurisdiction: string | null
          name: string
          nameHi: string | null
          openingBalance: number | null
          openingBalanceType: string | null
          p1ExpenseBucket: string | null
          p1IncomeCategory: string | null
          parentId: string | null
          report_class: string | null
          society_id: string
          subtype: string | null
          turnoverBucket: string | null
          type: string
        }
        Insert: {
          code?: string | null
          cropCategory?: string | null
          id: string
          isGroup?: boolean | null
          isSystem?: boolean | null
          jurisdiction?: string | null
          name: string
          nameHi?: string | null
          openingBalance?: number | null
          openingBalanceType?: string | null
          p1ExpenseBucket?: string | null
          p1IncomeCategory?: string | null
          parentId?: string | null
          report_class?: string | null
          society_id: string
          subtype?: string | null
          turnoverBucket?: string | null
          type: string
        }
        Update: {
          code?: string | null
          cropCategory?: string | null
          id?: string
          isGroup?: boolean | null
          isSystem?: boolean | null
          jurisdiction?: string | null
          name?: string
          nameHi?: string | null
          openingBalance?: number | null
          openingBalanceType?: string | null
          p1ExpenseBucket?: string | null
          p1IncomeCategory?: string | null
          parentId?: string | null
          report_class?: string | null
          society_id?: string
          subtype?: string | null
          turnoverBucket?: string | null
          type?: string
        }
        Relationships: []
      }
      app_migrations: {
        Row: {
          applied_at: string
          applied_by: string
          name: string
          version: string
        }
        Insert: {
          applied_at?: string
          applied_by?: string
          name: string
          version: string
        }
        Update: {
          applied_at?: string
          applied_by?: string
          name?: string
          version?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          acquisitionVoucherId: string | null
          assetNo: string | null
          capacityMT: number | null
          category: string | null
          condition: string | null
          cost: number | null
          depreciationMethod: string | null
          depreciationPostedFY: Json | null
          depreciationRate: number | null
          description: string | null
          disposalDate: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          location: string | null
          marketValue: number | null
          name: string | null
          p6Category: string | null
          purchaseDate: string | null
          residualValue: number | null
          saleProceeds: number | null
          society_id: string
          status: string | null
          usefulLife: number | null
          voucherIds: Json | null
        }
        Insert: {
          acquisitionVoucherId?: string | null
          assetNo?: string | null
          capacityMT?: number | null
          category?: string | null
          condition?: string | null
          cost?: number | null
          depreciationMethod?: string | null
          depreciationPostedFY?: Json | null
          depreciationRate?: number | null
          description?: string | null
          disposalDate?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          location?: string | null
          marketValue?: number | null
          name?: string | null
          p6Category?: string | null
          purchaseDate?: string | null
          residualValue?: number | null
          saleProceeds?: number | null
          society_id: string
          status?: string | null
          usefulLife?: number | null
          voucherIds?: Json | null
        }
        Update: {
          acquisitionVoucherId?: string | null
          assetNo?: string | null
          capacityMT?: number | null
          category?: string | null
          condition?: string | null
          cost?: number | null
          depreciationMethod?: string | null
          depreciationPostedFY?: Json | null
          depreciationRate?: number | null
          description?: string | null
          disposalDate?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          location?: string | null
          marketValue?: number | null
          name?: string | null
          p6Category?: string | null
          purchaseDate?: string | null
          residualValue?: number | null
          saleProceeds?: number | null
          society_id?: string
          status?: string | null
          usefulLife?: number | null
          voucherIds?: Json | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_name: string | null
          actor_role: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          jurisdiction: string | null
          reason: string | null
          society_id: string
          source: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_name?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          jurisdiction?: string | null
          reason?: string | null
          society_id: string
          source?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_name?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          jurisdiction?: string | null
          reason?: string | null
          society_id?: string
          source?: string | null
        }
        Relationships: []
      }
      audit_objections: {
        Row: {
          actionTaken: string | null
          amountInvolved: number | null
          auditYear: string | null
          category: string | null
          createdAt: string | null
          dueDate: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          objection: string | null
          objectionNo: string | null
          paraNo: string | null
          rectifiedDate: string | null
          remarks: string | null
          society_id: string
          status: string | null
        }
        Insert: {
          actionTaken?: string | null
          amountInvolved?: number | null
          auditYear?: string | null
          category?: string | null
          createdAt?: string | null
          dueDate?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          objection?: string | null
          objectionNo?: string | null
          paraNo?: string | null
          rectifiedDate?: string | null
          remarks?: string | null
          society_id: string
          status?: string | null
        }
        Update: {
          actionTaken?: string | null
          amountInvolved?: number | null
          auditYear?: string | null
          category?: string | null
          createdAt?: string | null
          dueDate?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          objection?: string | null
          objectionNo?: string | null
          paraNo?: string | null
          rectifiedDate?: string | null
          remarks?: string | null
          society_id?: string
          status?: string | null
        }
        Relationships: []
      }
      bank_reconciliations: {
        Row: {
          asOfDate: string | null
          bankAccountId: string | null
          bankAccountName: string | null
          bookBalance: number | null
          difference: number | null
          id: string
          isDeleted: boolean | null
          isReconciled: boolean | null
          jurisdiction: string | null
          reconciledAt: string | null
          reconciledBy: string | null
          society_id: string
          statementBalance: number | null
          unclearedDepositIds: Json | null
          unclearedDepositsTotal: number | null
          unclearedPaymentIds: Json | null
          unclearedPaymentsTotal: number | null
        }
        Insert: {
          asOfDate?: string | null
          bankAccountId?: string | null
          bankAccountName?: string | null
          bookBalance?: number | null
          difference?: number | null
          id: string
          isDeleted?: boolean | null
          isReconciled?: boolean | null
          jurisdiction?: string | null
          reconciledAt?: string | null
          reconciledBy?: string | null
          society_id: string
          statementBalance?: number | null
          unclearedDepositIds?: Json | null
          unclearedDepositsTotal?: number | null
          unclearedPaymentIds?: Json | null
          unclearedPaymentsTotal?: number | null
        }
        Update: {
          asOfDate?: string | null
          bankAccountId?: string | null
          bankAccountName?: string | null
          bookBalance?: number | null
          difference?: number | null
          id?: string
          isDeleted?: boolean | null
          isReconciled?: boolean | null
          jurisdiction?: string | null
          reconciledAt?: string | null
          reconciledBy?: string | null
          society_id?: string
          statementBalance?: number | null
          unclearedDepositIds?: Json | null
          unclearedDepositsTotal?: number | null
          unclearedPaymentIds?: Json | null
          unclearedPaymentsTotal?: number | null
        }
        Relationships: []
      }
      billing_seller: {
        Row: {
          address: string | null
          gst_rate_pct: number | null
          gstin: string | null
          id: boolean
          invoice_prefix: string
          legal_name: string | null
          sac: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          gst_rate_pct?: number | null
          gstin?: string | null
          id?: boolean
          invoice_prefix?: string
          legal_name?: string | null
          sac?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          gst_rate_pct?: number | null
          gstin?: string | null
          id?: boolean
          invoice_prefix?: string
          legal_name?: string | null
          sac?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      blog_post_views: {
        Row: {
          slug: string
          updated_at: string
          views: number
        }
        Insert: {
          slug: string
          updated_at?: string
          views?: number
        }
        Update: {
          slug?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          code: string | null
          createdAt: string | null
          id: string
          isActive: boolean | null
          isHeadOffice: boolean | null
          jurisdiction: string | null
          name: string
          society_id: string | null
        }
        Insert: {
          address?: string | null
          code?: string | null
          createdAt?: string | null
          id: string
          isActive?: boolean | null
          isHeadOffice?: boolean | null
          jurisdiction?: string | null
          name: string
          society_id?: string | null
        }
        Update: {
          address?: string | null
          code?: string | null
          createdAt?: string | null
          id?: string
          isActive?: boolean | null
          isHeadOffice?: boolean | null
          jurisdiction?: string | null
          name?: string
          society_id?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          approvedAt: string | null
          approvedBy: string | null
          createdAt: string | null
          createdBy: string | null
          financialYear: string | null
          heads: Json | null
          id: string
          jurisdiction: string | null
          society_id: string
        }
        Insert: {
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string | null
          createdBy?: string | null
          financialYear?: string | null
          heads?: Json | null
          id: string
          jurisdiction?: string | null
          society_id: string
        }
        Update: {
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string | null
          createdBy?: string | null
          financialYear?: string | null
          heads?: Json | null
          id?: string
          jurisdiction?: string | null
          society_id?: string
        }
        Relationships: []
      }
      catalog_versions: {
        Row: {
          catalog_name: string
          content_hash: string
          effective_summary: Json
          id: string
          recorded_at: string
          rule_count: number
          source: string
          unverified_count: number
          value_count: number
          verified_count: number
        }
        Insert: {
          catalog_name: string
          content_hash: string
          effective_summary?: Json
          id?: string
          recorded_at?: string
          rule_count: number
          source?: string
          unverified_count: number
          value_count: number
          verified_count: number
        }
        Update: {
          catalog_name?: string
          content_hash?: string
          effective_summary?: Json
          id?: string
          recorded_at?: string
          rule_count?: number
          source?: string
          unverified_count?: number
          value_count?: number
          verified_count?: number
        }
        Relationships: []
      }
      change_log: {
        Row: {
          actor_email: string | null
          actor_role: string | null
          after: Json | null
          before: Json | null
          changed: string[] | null
          id: string
          occurred_at: string
          op: string
          row_id: string | null
          society_id: string | null
          table_name: string
        }
        Insert: {
          actor_email?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          changed?: string[] | null
          id?: string
          occurred_at?: string
          op: string
          row_id?: string | null
          society_id?: string | null
          table_name: string
        }
        Update: {
          actor_email?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          changed?: string[] | null
          id?: string
          occurred_at?: string
          op?: string
          row_id?: string | null
          society_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      compliance_filings: {
        Row: {
          filedAt: string | null
          filedBy: string | null
          id: string
          itemId: string | null
          jurisdiction: string | null
          note: string | null
          society_id: string
        }
        Insert: {
          filedAt?: string | null
          filedBy?: string | null
          id: string
          itemId?: string | null
          jurisdiction?: string | null
          note?: string | null
          society_id: string
        }
        Update: {
          filedAt?: string | null
          filedBy?: string | null
          id?: string
          itemId?: string | null
          jurisdiction?: string | null
          note?: string | null
          society_id?: string
        }
        Relationships: []
      }
      consumer_patronage_runs: {
        Row: {
          amountPaid: number | null
          approvedAt: string | null
          approvedBy: string | null
          createdAt: string | null
          from: string | null
          fyLabel: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          kind: string | null
          lines: Json | null
          ratePct: number | null
          resolutionDate: string | null
          resolutionNo: string | null
          society_id: string
          status: string | null
          to: string | null
          total: number | null
          voucherId: string | null
        }
        Insert: {
          amountPaid?: number | null
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string | null
          from?: string | null
          fyLabel?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          kind?: string | null
          lines?: Json | null
          ratePct?: number | null
          resolutionDate?: string | null
          resolutionNo?: string | null
          society_id: string
          status?: string | null
          to?: string | null
          total?: number | null
          voucherId?: string | null
        }
        Update: {
          amountPaid?: number | null
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string | null
          from?: string | null
          fyLabel?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          kind?: string | null
          lines?: Json | null
          ratePct?: number | null
          resolutionDate?: string | null
          resolutionNo?: string | null
          society_id?: string
          status?: string | null
          to?: string | null
          total?: number | null
          voucherId?: string | null
        }
        Relationships: []
      }
      consumer_price_lists: {
        Row: {
          createdAt: string | null
          effectiveFrom: string | null
          id: string
          isDeleted: boolean | null
          itemId: string | null
          jurisdiction: string | null
          price: number | null
          society_id: string
          tier: string | null
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          effectiveFrom?: string | null
          id: string
          isDeleted?: boolean | null
          itemId?: string | null
          jurisdiction?: string | null
          price?: number | null
          society_id: string
          tier?: string | null
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          effectiveFrom?: string | null
          id?: string
          isDeleted?: boolean | null
          itemId?: string | null
          jurisdiction?: string | null
          price?: number | null
          society_id?: string
          tier?: string | null
          updatedAt?: string | null
        }
        Relationships: []
      }
      consumer_purchase_orders: {
        Row: {
          approvedAt: string | null
          approvedBy: string | null
          createdAt: string | null
          date: string | null
          expectedDate: string | null
          id: string
          isDeleted: boolean | null
          items: Json | null
          jurisdiction: string | null
          notes: string | null
          poNo: string | null
          purchaseId: string | null
          purchaseNo: string | null
          receivedAt: string | null
          resolutionNo: string | null
          society_id: string
          status: string | null
          supplierId: string | null
          supplierName: string | null
          supplierPhone: string | null
          total: number | null
          varianceApprovedBy: string | null
          varianceReason: string | null
          varianceStatus: string | null
        }
        Insert: {
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string | null
          date?: string | null
          expectedDate?: string | null
          id: string
          isDeleted?: boolean | null
          items?: Json | null
          jurisdiction?: string | null
          notes?: string | null
          poNo?: string | null
          purchaseId?: string | null
          purchaseNo?: string | null
          receivedAt?: string | null
          resolutionNo?: string | null
          society_id: string
          status?: string | null
          supplierId?: string | null
          supplierName?: string | null
          supplierPhone?: string | null
          total?: number | null
          varianceApprovedBy?: string | null
          varianceReason?: string | null
          varianceStatus?: string | null
        }
        Update: {
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string | null
          date?: string | null
          expectedDate?: string | null
          id?: string
          isDeleted?: boolean | null
          items?: Json | null
          jurisdiction?: string | null
          notes?: string | null
          poNo?: string | null
          purchaseId?: string | null
          purchaseNo?: string | null
          receivedAt?: string | null
          resolutionNo?: string | null
          society_id?: string
          status?: string | null
          supplierId?: string | null
          supplierName?: string | null
          supplierPhone?: string | null
          total?: number | null
          varianceApprovedBy?: string | null
          varianceReason?: string | null
          varianceStatus?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          accountId: string | null
          accountNo: string | null
          address: string | null
          addressLine1: string | null
          addressLine2: string | null
          bankName: string | null
          branch: string | null
          city: string | null
          contactDesignation: string | null
          contactPerson: string | null
          country: string | null
          createdAt: string | null
          creditDays: number | null
          creditLimit: number | null
          customerCode: string | null
          customerType: string | null
          discountPercent: number | null
          email: string | null
          gstin: string | null
          gstNo: string | null
          id: string
          ifsc: string | null
          isActive: boolean | null
          jurisdiction: string | null
          landline: string | null
          lateFeeRule: Json | null
          legalName: string | null
          mailingName: string | null
          mobile: string | null
          name: string | null
          nameHi: string | null
          notes: string | null
          openingBalance: number | null
          openingBalanceType: string | null
          pan: string | null
          phone: string | null
          pincode: string | null
          placeOfSupply: string | null
          registrationType: string | null
          society_id: string
          state: string | null
          tcsApplicable: boolean | null
          tdsApplicable: boolean | null
          tradeName: string | null
          upiId: string | null
          website: string | null
        }
        Insert: {
          accountId?: string | null
          accountNo?: string | null
          address?: string | null
          addressLine1?: string | null
          addressLine2?: string | null
          bankName?: string | null
          branch?: string | null
          city?: string | null
          contactDesignation?: string | null
          contactPerson?: string | null
          country?: string | null
          createdAt?: string | null
          creditDays?: number | null
          creditLimit?: number | null
          customerCode?: string | null
          customerType?: string | null
          discountPercent?: number | null
          email?: string | null
          gstin?: string | null
          gstNo?: string | null
          id: string
          ifsc?: string | null
          isActive?: boolean | null
          jurisdiction?: string | null
          landline?: string | null
          lateFeeRule?: Json | null
          legalName?: string | null
          mailingName?: string | null
          mobile?: string | null
          name?: string | null
          nameHi?: string | null
          notes?: string | null
          openingBalance?: number | null
          openingBalanceType?: string | null
          pan?: string | null
          phone?: string | null
          pincode?: string | null
          placeOfSupply?: string | null
          registrationType?: string | null
          society_id: string
          state?: string | null
          tcsApplicable?: boolean | null
          tdsApplicable?: boolean | null
          tradeName?: string | null
          upiId?: string | null
          website?: string | null
        }
        Update: {
          accountId?: string | null
          accountNo?: string | null
          address?: string | null
          addressLine1?: string | null
          addressLine2?: string | null
          bankName?: string | null
          branch?: string | null
          city?: string | null
          contactDesignation?: string | null
          contactPerson?: string | null
          country?: string | null
          createdAt?: string | null
          creditDays?: number | null
          creditLimit?: number | null
          customerCode?: string | null
          customerType?: string | null
          discountPercent?: number | null
          email?: string | null
          gstin?: string | null
          gstNo?: string | null
          id?: string
          ifsc?: string | null
          isActive?: boolean | null
          jurisdiction?: string | null
          landline?: string | null
          lateFeeRule?: Json | null
          legalName?: string | null
          mailingName?: string | null
          mobile?: string | null
          name?: string | null
          nameHi?: string | null
          notes?: string | null
          openingBalance?: number | null
          openingBalanceType?: string | null
          pan?: string | null
          phone?: string | null
          pincode?: string | null
          placeOfSupply?: string | null
          registrationType?: string | null
          society_id?: string
          state?: string | null
          tcsApplicable?: boolean | null
          tdsApplicable?: boolean | null
          tradeName?: string | null
          upiId?: string | null
          website?: string | null
        }
        Relationships: []
      }
      dairy_dispatches: {
        Row: {
          amount: number | null
          amountReceived: number | null
          createdAt: string | null
          date: string | null
          fat: number | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          qty: number | null
          rate: number | null
          remarks: string | null
          shift: string | null
          shortage: number | null
          snf: number | null
          society_id: string
          unionName: string | null
          vehicleNo: string | null
          voucherId: string | null
        }
        Insert: {
          amount?: number | null
          amountReceived?: number | null
          createdAt?: string | null
          date?: string | null
          fat?: number | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          qty?: number | null
          rate?: number | null
          remarks?: string | null
          shift?: string | null
          shortage?: number | null
          snf?: number | null
          society_id: string
          unionName?: string | null
          vehicleNo?: string | null
          voucherId?: string | null
        }
        Update: {
          amount?: number | null
          amountReceived?: number | null
          createdAt?: string | null
          date?: string | null
          fat?: number | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          qty?: number | null
          rate?: number | null
          remarks?: string | null
          shift?: string | null
          shortage?: number | null
          snf?: number | null
          society_id?: string
          unionName?: string | null
          vehicleNo?: string | null
          voucherId?: string | null
        }
        Relationships: []
      }
      dairy_distributions: {
        Row: {
          amountPaid: number | null
          approvedAt: string | null
          approvedBy: string | null
          basis: string | null
          createdAt: string | null
          from: string | null
          fyLabel: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          kind: string | null
          lines: Json | null
          rate: number | null
          resolutionDate: string | null
          resolutionNo: string | null
          society_id: string
          status: string | null
          to: string | null
          total: number | null
          voucherId: string | null
        }
        Insert: {
          amountPaid?: number | null
          approvedAt?: string | null
          approvedBy?: string | null
          basis?: string | null
          createdAt?: string | null
          from?: string | null
          fyLabel?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          kind?: string | null
          lines?: Json | null
          rate?: number | null
          resolutionDate?: string | null
          resolutionNo?: string | null
          society_id: string
          status?: string | null
          to?: string | null
          total?: number | null
          voucherId?: string | null
        }
        Update: {
          amountPaid?: number | null
          approvedAt?: string | null
          approvedBy?: string | null
          basis?: string | null
          createdAt?: string | null
          from?: string | null
          fyLabel?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          kind?: string | null
          lines?: Json | null
          rate?: number | null
          resolutionDate?: string | null
          resolutionNo?: string | null
          society_id?: string
          status?: string | null
          to?: string | null
          total?: number | null
          voucherId?: string | null
        }
        Relationships: []
      }
      dairy_input_issues: {
        Row: {
          amount: number | null
          createdAt: string | null
          date: string | null
          id: string
          incomeAccountId: string | null
          inputType: string | null
          isDeleted: boolean | null
          itemName: string | null
          jurisdiction: string | null
          memberId: string | null
          memberName: string | null
          qty: number | null
          remarks: string | null
          society_id: string
          voucherId: string | null
        }
        Insert: {
          amount?: number | null
          createdAt?: string | null
          date?: string | null
          id: string
          incomeAccountId?: string | null
          inputType?: string | null
          isDeleted?: boolean | null
          itemName?: string | null
          jurisdiction?: string | null
          memberId?: string | null
          memberName?: string | null
          qty?: number | null
          remarks?: string | null
          society_id: string
          voucherId?: string | null
        }
        Update: {
          amount?: number | null
          createdAt?: string | null
          date?: string | null
          id?: string
          incomeAccountId?: string | null
          inputType?: string | null
          isDeleted?: boolean | null
          itemName?: string | null
          jurisdiction?: string | null
          memberId?: string | null
          memberName?: string | null
          qty?: number | null
          remarks?: string | null
          society_id?: string
          voucherId?: string | null
        }
        Relationships: []
      }
      dairy_rate_charts: {
        Row: {
          basis: string | null
          createdAt: string | null
          effectiveFrom: string | null
          fatBands: Json | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          matrix: Json | null
          name: string | null
          season: string | null
          snfBands: Json | null
          society_id: string
        }
        Insert: {
          basis?: string | null
          createdAt?: string | null
          effectiveFrom?: string | null
          fatBands?: Json | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          matrix?: Json | null
          name?: string | null
          season?: string | null
          snfBands?: Json | null
          society_id: string
        }
        Update: {
          basis?: string | null
          createdAt?: string | null
          effectiveFrom?: string | null
          fatBands?: Json | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          matrix?: Json | null
          name?: string | null
          season?: string | null
          snfBands?: Json | null
          society_id?: string
        }
        Relationships: []
      }
      dairy_settlements: {
        Row: {
          amountPaid: number | null
          approvedAt: string | null
          approvedBy: string | null
          createdAt: string | null
          deductionLines: Json | null
          from: string | null
          gross: number | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          memberId: string | null
          memberName: string | null
          netPayable: number | null
          settlementNo: string | null
          society_id: string
          status: string | null
          to: string | null
          voucherId: string | null
        }
        Insert: {
          amountPaid?: number | null
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string | null
          deductionLines?: Json | null
          from?: string | null
          gross?: number | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          memberId?: string | null
          memberName?: string | null
          netPayable?: number | null
          settlementNo?: string | null
          society_id: string
          status?: string | null
          to?: string | null
          voucherId?: string | null
        }
        Update: {
          amountPaid?: number | null
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string | null
          deductionLines?: Json | null
          from?: string | null
          gross?: number | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          memberId?: string | null
          memberName?: string | null
          netPayable?: number | null
          settlementNo?: string | null
          society_id?: string
          status?: string | null
          to?: string | null
          voucherId?: string | null
        }
        Relationships: []
      }
      data_fix_log: {
        Row: {
          entity: string
          entity_id: string
          fix: string
          id: number
          logged_at: string
          old_row: Json
          society_id: string
        }
        Insert: {
          entity: string
          entity_id: string
          fix: string
          id?: number
          logged_at?: string
          old_row: Json
          society_id: string
        }
        Update: {
          entity?: string
          entity_id?: string
          fix?: string
          id?: number
          logged_at?: string
          old_row?: Json
          society_id?: string
        }
        Relationships: []
      }
      department_bills: {
        Row: {
          amount: number | null
          billNo: string | null
          billType: string | null
          createdAt: string | null
          date: string | null
          departmentId: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          narration: string | null
          paidAmount: number | null
          society_id: string
          status: string | null
          voucherId: string | null
          workOrderId: string | null
        }
        Insert: {
          amount?: number | null
          billNo?: string | null
          billType?: string | null
          createdAt?: string | null
          date?: string | null
          departmentId?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          narration?: string | null
          paidAmount?: number | null
          society_id: string
          status?: string | null
          voucherId?: string | null
          workOrderId?: string | null
        }
        Update: {
          amount?: number | null
          billNo?: string | null
          billType?: string | null
          createdAt?: string | null
          date?: string | null
          departmentId?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          narration?: string | null
          paidAmount?: number | null
          society_id?: string
          status?: string | null
          voucherId?: string | null
          workOrderId?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          accountId: string | null
          address: string | null
          contactPerson: string | null
          createdAt: string | null
          departmentCode: string | null
          departmentType: string | null
          gstin: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          name: string | null
          openingBalance: number | null
          phone: string | null
          society_id: string
          status: string | null
          tdsApplicable: boolean | null
        }
        Insert: {
          accountId?: string | null
          address?: string | null
          contactPerson?: string | null
          createdAt?: string | null
          departmentCode?: string | null
          departmentType?: string | null
          gstin?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          name?: string | null
          openingBalance?: number | null
          phone?: string | null
          society_id: string
          status?: string | null
          tdsApplicable?: boolean | null
        }
        Update: {
          accountId?: string | null
          address?: string | null
          contactPerson?: string | null
          createdAt?: string | null
          departmentCode?: string | null
          departmentType?: string | null
          gstin?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          name?: string | null
          openingBalance?: number | null
          phone?: string | null
          society_id?: string
          status?: string | null
          tdsApplicable?: boolean | null
        }
        Relationships: []
      }
      deposit_accounts: {
        Row: {
          accountNo: string | null
          agent: string | null
          balance: number | null
          createdAt: string | null
          depositType: string | null
          id: string
          installmentAmount: number | null
          interestRate: number | null
          jurisdiction: string | null
          maturityDate: string | null
          memberId: string | null
          openDate: string | null
          society_id: string
          status: string | null
        }
        Insert: {
          accountNo?: string | null
          agent?: string | null
          balance?: number | null
          createdAt?: string | null
          depositType?: string | null
          id: string
          installmentAmount?: number | null
          interestRate?: number | null
          jurisdiction?: string | null
          maturityDate?: string | null
          memberId?: string | null
          openDate?: string | null
          society_id: string
          status?: string | null
        }
        Update: {
          accountNo?: string | null
          agent?: string | null
          balance?: number | null
          createdAt?: string | null
          depositType?: string | null
          id?: string
          installmentAmount?: number | null
          interestRate?: number | null
          jurisdiction?: string | null
          maturityDate?: string | null
          memberId?: string | null
          openDate?: string | null
          society_id?: string
          status?: string | null
        }
        Relationships: []
      }
      deposit_transactions: {
        Row: {
          amount: number | null
          balanceAfter: number | null
          createdAt: string | null
          date: string | null
          depositAccountId: string | null
          id: string
          jurisdiction: string | null
          mode: string | null
          society_id: string
          txnType: string | null
          voucherId: string | null
        }
        Insert: {
          amount?: number | null
          balanceAfter?: number | null
          createdAt?: string | null
          date?: string | null
          depositAccountId?: string | null
          id: string
          jurisdiction?: string | null
          mode?: string | null
          society_id: string
          txnType?: string | null
          voucherId?: string | null
        }
        Update: {
          amount?: number | null
          balanceAfter?: number | null
          createdAt?: string | null
          date?: string | null
          depositAccountId?: string | null
          id?: string
          jurisdiction?: string | null
          mode?: string | null
          society_id?: string
          txnType?: string | null
          voucherId?: string | null
        }
        Relationships: []
      }
      document_sequences: {
        Row: {
          book: string
          fy: string
          jurisdiction: string | null
          last_number: number
          society_id: string
          updated_at: string
        }
        Insert: {
          book: string
          fy: string
          jurisdiction?: string | null
          last_number?: number
          society_id: string
          updated_at?: string
        }
        Update: {
          book?: string
          fy?: string
          jurisdiction?: string | null
          last_number?: number
          society_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      elections: {
        Row: {
          candidates: Json | null
          createdAt: string | null
          createdBy: string | null
          electionDate: string | null
          electionNo: string | null
          id: string
          jurisdiction: string | null
          nominationDeadline: string | null
          post: string | null
          remarks: string | null
          society_id: string
          status: string | null
          title: string | null
          totalVoters: number | null
          votesCast: number | null
          winnerId: string | null
        }
        Insert: {
          candidates?: Json | null
          createdAt?: string | null
          createdBy?: string | null
          electionDate?: string | null
          electionNo?: string | null
          id: string
          jurisdiction?: string | null
          nominationDeadline?: string | null
          post?: string | null
          remarks?: string | null
          society_id: string
          status?: string | null
          title?: string | null
          totalVoters?: number | null
          votesCast?: number | null
          winnerId?: string | null
        }
        Update: {
          candidates?: Json | null
          createdAt?: string | null
          createdBy?: string | null
          electionDate?: string | null
          electionNo?: string | null
          id?: string
          jurisdiction?: string | null
          nominationDeadline?: string | null
          post?: string | null
          remarks?: string | null
          society_id?: string
          status?: string | null
          title?: string | null
          totalVoters?: number | null
          votesCast?: number | null
          winnerId?: string | null
        }
        Relationships: []
      }
      email_health_alerts: {
        Row: {
          id: string
          level: string
          resolved_at: string | null
          sent_at: string
          summary: Json
        }
        Insert: {
          id?: string
          level: string
          resolved_at?: string | null
          sent_at?: string
          summary: Json
        }
        Update: {
          id?: string
          level?: string
          resolved_at?: string | null
          sent_at?: string
          summary?: Json
        }
        Relationships: []
      }
      email_preferences: {
        Row: {
          email: string
          locale: string | null
          unsubscribe_token: string
          updated_at: string
          weekly_digest: boolean
        }
        Insert: {
          email: string
          locale?: string | null
          unsubscribe_token?: string
          updated_at?: string
          weekly_digest?: boolean
        }
        Update: {
          email?: string
          locale?: string | null
          unsubscribe_token?: string
          updated_at?: string
          weekly_digest?: boolean
        }
        Relationships: []
      }
      email_suppression: {
        Row: {
          created_at: string
          detail: string | null
          email: string
          reason: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          email: string
          reason: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          email?: string
          reason?: string
        }
        Relationships: []
      }
      email_verifications: {
        Row: {
          email: string
          requested_at: string | null
          token_expires_at: string | null
          token_hash: string | null
          verified_at: string | null
        }
        Insert: {
          email: string
          requested_at?: string | null
          token_expires_at?: string | null
          token_hash?: string | null
          verified_at?: string | null
        }
        Update: {
          email?: string
          requested_at?: string | null
          token_expires_at?: string | null
          token_hash?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          bankAccount: string | null
          basicSalary: number | null
          category: string | null
          designation: string | null
          empNo: string | null
          esiApplicable: boolean | null
          esiNo: string | null
          hafedSalaryPaid: number | null
          hafedSalaryPercent: number | null
          id: string
          isDeleted: boolean | null
          isHafedDeputed: boolean | null
          isOutsourced: boolean | null
          joinDate: string | null
          jurisdiction: string | null
          name: string | null
          nameHi: string | null
          pan: string | null
          payScale: string | null
          pfApplicable: boolean | null
          phone: string | null
          society_id: string
          status: string | null
          uan: string | null
        }
        Insert: {
          bankAccount?: string | null
          basicSalary?: number | null
          category?: string | null
          designation?: string | null
          empNo?: string | null
          esiApplicable?: boolean | null
          esiNo?: string | null
          hafedSalaryPaid?: number | null
          hafedSalaryPercent?: number | null
          id: string
          isDeleted?: boolean | null
          isHafedDeputed?: boolean | null
          isOutsourced?: boolean | null
          joinDate?: string | null
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          pan?: string | null
          payScale?: string | null
          pfApplicable?: boolean | null
          phone?: string | null
          society_id: string
          status?: string | null
          uan?: string | null
        }
        Update: {
          bankAccount?: string | null
          basicSalary?: number | null
          category?: string | null
          designation?: string | null
          empNo?: string | null
          esiApplicable?: boolean | null
          esiNo?: string | null
          hafedSalaryPaid?: number | null
          hafedSalaryPercent?: number | null
          id?: string
          isDeleted?: boolean | null
          isHafedDeputed?: boolean | null
          isOutsourced?: boolean | null
          joinDate?: string | null
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          pan?: string | null
          payScale?: string | null
          pfApplicable?: boolean | null
          phone?: string | null
          society_id?: string
          status?: string | null
          uan?: string | null
        }
        Relationships: []
      }
      error_log: {
        Row: {
          actor_name: string | null
          context: Json | null
          created_at: string
          id: string
          jurisdiction: string | null
          message: string | null
          society_id: string | null
          source: string | null
          stack: string | null
          url: string | null
        }
        Insert: {
          actor_name?: string | null
          context?: Json | null
          created_at?: string
          id: string
          jurisdiction?: string | null
          message?: string | null
          society_id?: string | null
          source?: string | null
          stack?: string | null
          url?: string | null
        }
        Update: {
          actor_name?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          jurisdiction?: string | null
          message?: string | null
          society_id?: string | null
          source?: string | null
          stack?: string | null
          url?: string | null
        }
        Relationships: []
      }
      eway_bills: {
        Row: {
          date: string | null
          distance: number | null
          docNo: string | null
          ewbNo: string | null
          grandTotal: number | null
          id: string
          items: Json | null
          jurisdiction: string | null
          partyGst: string | null
          partyName: string | null
          society_id: string
          totalGst: number | null
          totalTaxable: number | null
          transDocDate: string | null
          transDocNo: string | null
          transporterGstin: string | null
          transporterName: string | null
          transportMode: string | null
          type: string | null
          vehicleNo: string | null
        }
        Insert: {
          date?: string | null
          distance?: number | null
          docNo?: string | null
          ewbNo?: string | null
          grandTotal?: number | null
          id: string
          items?: Json | null
          jurisdiction?: string | null
          partyGst?: string | null
          partyName?: string | null
          society_id: string
          totalGst?: number | null
          totalTaxable?: number | null
          transDocDate?: string | null
          transDocNo?: string | null
          transporterGstin?: string | null
          transporterName?: string | null
          transportMode?: string | null
          type?: string | null
          vehicleNo?: string | null
        }
        Update: {
          date?: string | null
          distance?: number | null
          docNo?: string | null
          ewbNo?: string | null
          grandTotal?: number | null
          id?: string
          items?: Json | null
          jurisdiction?: string | null
          partyGst?: string | null
          partyName?: string | null
          society_id?: string
          totalGst?: number | null
          totalTaxable?: number | null
          transDocDate?: string | null
          transDocNo?: string | null
          transporterGstin?: string | null
          transporterName?: string | null
          transportMode?: string | null
          type?: string | null
          vehicleNo?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_public: boolean
          jurisdiction: string | null
          message: string | null
          name: string | null
          page_url: string | null
          rating: number | null
          society_id: string | null
          society_name: string | null
          status: string
          type: string
          user_email: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_public?: boolean
          jurisdiction?: string | null
          message?: string | null
          name?: string | null
          page_url?: string | null
          rating?: number | null
          society_id?: string | null
          society_name?: string | null
          status?: string
          type?: string
          user_email?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_public?: boolean
          jurisdiction?: string | null
          message?: string | null
          name?: string | null
          page_url?: string | null
          rating?: number | null
          society_id?: string | null
          society_name?: string | null
          status?: string
          type?: string
          user_email?: string | null
        }
        Relationships: []
      }
      financial_years: {
        Row: {
          audit_reference: string | null
          audited_at: string | null
          audited_by: string | null
          close_authority: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          end_date: string
          fy_label: string
          id: string
          net_result_minor: number | null
          opening_event_id: string | null
          period_lock_date: string | null
          previous_fy_id: string | null
          society_id: string
          start_date: string
          status: string
        }
        Insert: {
          audit_reference?: string | null
          audited_at?: string | null
          audited_by?: string | null
          close_authority?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date: string
          fy_label: string
          id?: string
          net_result_minor?: number | null
          opening_event_id?: string | null
          period_lock_date?: string | null
          previous_fy_id?: string | null
          society_id: string
          start_date: string
          status?: string
        }
        Update: {
          audit_reference?: string | null
          audited_at?: string | null
          audited_by?: string | null
          close_authority?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date?: string
          fy_label?: string
          id?: string
          net_result_minor?: number | null
          opening_event_id?: string | null
          period_lock_date?: string | null
          previous_fy_id?: string | null
          society_id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_years_previous_fy_id_fkey"
            columns: ["previous_fy_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
        ]
      }
      godowns: {
        Row: {
          address: string | null
          branchId: string | null
          capacityMT: number | null
          code: string | null
          createdAt: string | null
          id: string
          isActive: boolean | null
          jurisdiction: string | null
          name: string
          society_id: string | null
        }
        Insert: {
          address?: string | null
          branchId?: string | null
          capacityMT?: number | null
          code?: string | null
          createdAt?: string | null
          id: string
          isActive?: boolean | null
          jurisdiction?: string | null
          name: string
          society_id?: string | null
        }
        Update: {
          address?: string | null
          branchId?: string | null
          capacityMT?: number | null
          code?: string | null
          createdAt?: string | null
          id?: string
          isActive?: boolean | null
          jurisdiction?: string | null
          name?: string
          society_id?: string | null
        }
        Relationships: []
      }
      guide_certificates: {
        Row: {
          cert_no: string
          email: string | null
          holder_name: string
          issued_at: string
          parts_passed: number
          society_name: string | null
        }
        Insert: {
          cert_no: string
          email?: string | null
          holder_name: string
          issued_at?: string
          parts_passed?: number
          society_name?: string | null
        }
        Update: {
          cert_no?: string
          email?: string | null
          holder_name?: string
          issued_at?: string
          parts_passed?: number
          society_name?: string | null
        }
        Relationships: []
      }
      housing_amc: {
        Row: {
          amount: number | null
          contractNo: string | null
          createdAt: string | null
          equipment: string | null
          expiryDate: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          remarks: string | null
          society_id: string
          startDate: string | null
          vendor: string | null
        }
        Insert: {
          amount?: number | null
          contractNo?: string | null
          createdAt?: string | null
          equipment?: string | null
          expiryDate?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          remarks?: string | null
          society_id: string
          startDate?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number | null
          contractNo?: string | null
          createdAt?: string | null
          equipment?: string | null
          expiryDate?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          remarks?: string | null
          society_id?: string
          startDate?: string | null
          vendor?: string | null
        }
        Relationships: []
      }
      housing_buildings: {
        Row: {
          address: string | null
          createdAt: string | null
          floors: number | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          name: string | null
          remarks: string | null
          society_id: string
          totalUnits: number | null
        }
        Insert: {
          address?: string | null
          createdAt?: string | null
          floors?: number | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          name?: string | null
          remarks?: string | null
          society_id: string
          totalUnits?: number | null
        }
        Update: {
          address?: string | null
          createdAt?: string | null
          floors?: number | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          name?: string | null
          remarks?: string | null
          society_id?: string
          totalUnits?: number | null
        }
        Relationships: []
      }
      housing_charge_heads: {
        Row: {
          accountId: string | null
          basis: string | null
          code: string | null
          createdAt: string | null
          gstable: boolean | null
          id: string
          isActive: boolean | null
          isDeleted: boolean | null
          isFund: boolean | null
          jurisdiction: string | null
          kind: string | null
          nameEn: string | null
          nameHi: string | null
          order: number | null
          rate: number | null
          society_id: string
        }
        Insert: {
          accountId?: string | null
          basis?: string | null
          code?: string | null
          createdAt?: string | null
          gstable?: boolean | null
          id: string
          isActive?: boolean | null
          isDeleted?: boolean | null
          isFund?: boolean | null
          jurisdiction?: string | null
          kind?: string | null
          nameEn?: string | null
          nameHi?: string | null
          order?: number | null
          rate?: number | null
          society_id: string
        }
        Update: {
          accountId?: string | null
          basis?: string | null
          code?: string | null
          createdAt?: string | null
          gstable?: boolean | null
          id?: string
          isActive?: boolean | null
          isDeleted?: boolean | null
          isFund?: boolean | null
          jurisdiction?: string | null
          kind?: string | null
          nameEn?: string | null
          nameHi?: string | null
          order?: number | null
          rate?: number | null
          society_id?: string
        }
        Relationships: []
      }
      housing_complaints: {
        Row: {
          category: string | null
          complaintNo: string | null
          createdAt: string | null
          description: string | null
          flatId: string | null
          flatNo: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          memberId: string | null
          raisedDate: string | null
          resolution: string | null
          resolvedDate: string | null
          society_id: string
          status: string | null
          title: string | null
        }
        Insert: {
          category?: string | null
          complaintNo?: string | null
          createdAt?: string | null
          description?: string | null
          flatId?: string | null
          flatNo?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          memberId?: string | null
          raisedDate?: string | null
          resolution?: string | null
          resolvedDate?: string | null
          society_id: string
          status?: string | null
          title?: string | null
        }
        Update: {
          category?: string | null
          complaintNo?: string | null
          createdAt?: string | null
          description?: string | null
          flatId?: string | null
          flatNo?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          memberId?: string | null
          raisedDate?: string | null
          resolution?: string | null
          resolvedDate?: string | null
          society_id?: string
          status?: string | null
          title?: string | null
        }
        Relationships: []
      }
      housing_documents: {
        Row: {
          authority: string | null
          createdAt: string | null
          date: string | null
          docType: string | null
          expiryDate: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          reference: string | null
          remarks: string | null
          society_id: string
          status: string | null
          title: string | null
        }
        Insert: {
          authority?: string | null
          createdAt?: string | null
          date?: string | null
          docType?: string | null
          expiryDate?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          reference?: string | null
          remarks?: string | null
          society_id: string
          status?: string | null
          title?: string | null
        }
        Update: {
          authority?: string | null
          createdAt?: string | null
          date?: string | null
          docType?: string | null
          expiryDate?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          reference?: string | null
          remarks?: string | null
          society_id?: string
          status?: string | null
          title?: string | null
        }
        Relationships: []
      }
      housing_flats: {
        Row: {
          area: number | null
          associateMemberId: string | null
          blockNo: string | null
          buildingId: string | null
          chargeOverrides: Json | null
          createdAt: string | null
          flatNo: string | null
          floor: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          memberId: string | null
          monthlyMaintenance: number | null
          nomineeName: string | null
          nomineePhone: string | null
          nomineeRelation: string | null
          occupancy: string | null
          ownerType: string | null
          receivableAccountId: string | null
          registrationDate: string | null
          shareCertNo: string | null
          shareCount: number | null
          shareFaceValue: number | null
          society_id: string
          unitType: string | null
        }
        Insert: {
          area?: number | null
          associateMemberId?: string | null
          blockNo?: string | null
          buildingId?: string | null
          chargeOverrides?: Json | null
          createdAt?: string | null
          flatNo?: string | null
          floor?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          memberId?: string | null
          monthlyMaintenance?: number | null
          nomineeName?: string | null
          nomineePhone?: string | null
          nomineeRelation?: string | null
          occupancy?: string | null
          ownerType?: string | null
          receivableAccountId?: string | null
          registrationDate?: string | null
          shareCertNo?: string | null
          shareCount?: number | null
          shareFaceValue?: number | null
          society_id: string
          unitType?: string | null
        }
        Update: {
          area?: number | null
          associateMemberId?: string | null
          blockNo?: string | null
          buildingId?: string | null
          chargeOverrides?: Json | null
          createdAt?: string | null
          flatNo?: string | null
          floor?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          memberId?: string | null
          monthlyMaintenance?: number | null
          nomineeName?: string | null
          nomineePhone?: string | null
          nomineeRelation?: string | null
          occupancy?: string | null
          ownerType?: string | null
          receivableAccountId?: string | null
          registrationDate?: string | null
          shareCertNo?: string | null
          shareCount?: number | null
          shareFaceValue?: number | null
          society_id?: string
          unitType?: string | null
        }
        Relationships: []
      }
      housing_fund_investments: {
        Row: {
          amount: number | null
          createdAt: string | null
          date: string | null
          fundAccountId: string | null
          id: string
          institution: string | null
          instrument: string | null
          interestRate: number | null
          investmentAccountId: string | null
          isDeleted: boolean | null
          jurisdiction: string | null
          maturityDate: string | null
          redemptionVoucherId: string | null
          society_id: string
          status: string | null
          voucherId: string | null
        }
        Insert: {
          amount?: number | null
          createdAt?: string | null
          date?: string | null
          fundAccountId?: string | null
          id: string
          institution?: string | null
          instrument?: string | null
          interestRate?: number | null
          investmentAccountId?: string | null
          isDeleted?: boolean | null
          jurisdiction?: string | null
          maturityDate?: string | null
          redemptionVoucherId?: string | null
          society_id: string
          status?: string | null
          voucherId?: string | null
        }
        Update: {
          amount?: number | null
          createdAt?: string | null
          date?: string | null
          fundAccountId?: string | null
          id?: string
          institution?: string | null
          instrument?: string | null
          interestRate?: number | null
          investmentAccountId?: string | null
          isDeleted?: boolean | null
          jurisdiction?: string | null
          maturityDate?: string | null
          redemptionVoucherId?: string | null
          society_id?: string
          status?: string | null
          voucherId?: string | null
        }
        Relationships: []
      }
      housing_insurance: {
        Row: {
          coverageType: string | null
          createdAt: string | null
          expiryDate: string | null
          id: string
          insurer: string | null
          isDeleted: boolean | null
          jurisdiction: string | null
          policyNo: string | null
          premium: number | null
          remarks: string | null
          society_id: string
          startDate: string | null
          sumInsured: number | null
        }
        Insert: {
          coverageType?: string | null
          createdAt?: string | null
          expiryDate?: string | null
          id: string
          insurer?: string | null
          isDeleted?: boolean | null
          jurisdiction?: string | null
          policyNo?: string | null
          premium?: number | null
          remarks?: string | null
          society_id: string
          startDate?: string | null
          sumInsured?: number | null
        }
        Update: {
          coverageType?: string | null
          createdAt?: string | null
          expiryDate?: string | null
          id?: string
          insurer?: string | null
          isDeleted?: boolean | null
          jurisdiction?: string | null
          policyNo?: string | null
          premium?: number | null
          remarks?: string | null
          society_id?: string
          startDate?: string | null
          sumInsured?: number | null
        }
        Relationships: []
      }
      housing_parking: {
        Row: {
          createdAt: string | null
          flatId: string | null
          flatNo: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          memberId: string | null
          monthlyCharge: number | null
          slotNo: string | null
          society_id: string
          status: string | null
          vehicleNo: string | null
          vehicleType: string | null
        }
        Insert: {
          createdAt?: string | null
          flatId?: string | null
          flatNo?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          memberId?: string | null
          monthlyCharge?: number | null
          slotNo?: string | null
          society_id: string
          status?: string | null
          vehicleNo?: string | null
          vehicleType?: string | null
        }
        Update: {
          createdAt?: string | null
          flatId?: string | null
          flatNo?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          memberId?: string | null
          monthlyCharge?: number | null
          slotNo?: string | null
          society_id?: string
          status?: string | null
          vehicleNo?: string | null
          vehicleType?: string | null
        }
        Relationships: []
      }
      housing_transfers: {
        Row: {
          createdAt: string | null
          date: string | null
          flatId: string | null
          flatNo: string | null
          fromMemberId: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          premium: number | null
          remarks: string | null
          resolutionDate: string | null
          resolutionNo: string | null
          society_id: string
          toMemberId: string | null
          transferFee: number | null
          transferType: string | null
          voucherId: string | null
        }
        Insert: {
          createdAt?: string | null
          date?: string | null
          flatId?: string | null
          flatNo?: string | null
          fromMemberId?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          premium?: number | null
          remarks?: string | null
          resolutionDate?: string | null
          resolutionNo?: string | null
          society_id: string
          toMemberId?: string | null
          transferFee?: number | null
          transferType?: string | null
          voucherId?: string | null
        }
        Update: {
          createdAt?: string | null
          date?: string | null
          flatId?: string | null
          flatNo?: string | null
          fromMemberId?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          premium?: number | null
          remarks?: string | null
          resolutionDate?: string | null
          resolutionNo?: string | null
          society_id?: string
          toMemberId?: string | null
          transferFee?: number | null
          transferType?: string | null
          voucherId?: string | null
        }
        Relationships: []
      }
      hsn_master: {
        Row: {
          cess: number | null
          code: string
          createdAt: string | null
          description: string | null
          gstRate: number | null
          id: string
          jurisdiction: string | null
          society_id: string
          type: string | null
        }
        Insert: {
          cess?: number | null
          code: string
          createdAt?: string | null
          description?: string | null
          gstRate?: number | null
          id: string
          jurisdiction?: string | null
          society_id: string
          type?: string | null
        }
        Update: {
          cess?: number | null
          code?: string
          createdAt?: string | null
          description?: string | null
          gstRate?: number | null
          id?: string
          jurisdiction?: string | null
          society_id?: string
          type?: string | null
        }
        Relationships: []
      }
      invoice_counters: {
        Row: {
          fy: string
          last_no: number
        }
        Insert: {
          fy: string
          last_no?: number
        }
        Update: {
          fy?: string
          last_no?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          buyer_address: string | null
          buyer_gstin: string | null
          buyer_name: string
          buyer_state_code: string
          cgst_paise: number
          created_at: string
          email_error: string | null
          emailed_at: string | null
          emailed_to: string | null
          fy: string
          gst_rate_pct: number
          id: string
          igst_paise: number
          invoice_date: string
          invoice_no: string
          kind: string
          order_id: string
          payment_id: string | null
          place_of_supply: string
          plan: string
          sac: string
          seller_address: string
          seller_gstin: string
          seller_name: string
          seller_state_code: string
          seq: number
          sgst_paise: number
          society_id: string
          taxable_paise: number
          total_paise: number
        }
        Insert: {
          buyer_address?: string | null
          buyer_gstin?: string | null
          buyer_name: string
          buyer_state_code: string
          cgst_paise?: number
          created_at?: string
          email_error?: string | null
          emailed_at?: string | null
          emailed_to?: string | null
          fy: string
          gst_rate_pct: number
          id?: string
          igst_paise?: number
          invoice_date: string
          invoice_no: string
          kind: string
          order_id: string
          payment_id?: string | null
          place_of_supply: string
          plan: string
          sac: string
          seller_address: string
          seller_gstin: string
          seller_name: string
          seller_state_code: string
          seq: number
          sgst_paise?: number
          society_id: string
          taxable_paise: number
          total_paise: number
        }
        Update: {
          buyer_address?: string | null
          buyer_gstin?: string | null
          buyer_name?: string
          buyer_state_code?: string
          cgst_paise?: number
          created_at?: string
          email_error?: string | null
          emailed_at?: string | null
          emailed_to?: string | null
          fy?: string
          gst_rate_pct?: number
          id?: string
          igst_paise?: number
          invoice_date?: string
          invoice_no?: string
          kind?: string
          order_id?: string
          payment_id?: string | null
          place_of_supply?: string
          plan?: string
          sac?: string
          seller_address?: string
          seller_gstin?: string
          seller_name?: string
          seller_state_code?: string
          seq?: number
          sgst_paise?: number
          society_id?: string
          taxable_paise?: number
          total_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kachi_aarat_entries: {
        Row: {
          businessValue: number | null
          createdAt: string | null
          crop: string | null
          damiEarned: number | null
          date: string | null
          fyStartDate: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          narration: string | null
          partyName: string | null
          society_id: string
        }
        Insert: {
          businessValue?: number | null
          createdAt?: string | null
          crop?: string | null
          damiEarned?: number | null
          date?: string | null
          fyStartDate?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          narration?: string | null
          partyName?: string | null
          society_id: string
        }
        Update: {
          businessValue?: number | null
          createdAt?: string | null
          crop?: string | null
          damiEarned?: number | null
          date?: string | null
          fyStartDate?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          narration?: string | null
          partyName?: string | null
          society_id?: string
        }
        Relationships: []
      }
      kcc_loans: {
        Row: {
          createdAt: string | null
          createdBy: string | null
          cropName: string | null
          cropSeason: string | null
          disbursementDate: string | null
          drawnAmount: number | null
          dueDate: string | null
          id: string
          interestRate: number | null
          jurisdiction: string | null
          landAreaHectares: number | null
          loanNo: string | null
          memberId: string | null
          memberName: string | null
          narration: string | null
          outstandingAmount: number | null
          repaidAmount: number | null
          sanctionedAmount: number | null
          society_id: string
          status: string | null
          voucherId: string | null
        }
        Insert: {
          createdAt?: string | null
          createdBy?: string | null
          cropName?: string | null
          cropSeason?: string | null
          disbursementDate?: string | null
          drawnAmount?: number | null
          dueDate?: string | null
          id: string
          interestRate?: number | null
          jurisdiction?: string | null
          landAreaHectares?: number | null
          loanNo?: string | null
          memberId?: string | null
          memberName?: string | null
          narration?: string | null
          outstandingAmount?: number | null
          repaidAmount?: number | null
          sanctionedAmount?: number | null
          society_id: string
          status?: string | null
          voucherId?: string | null
        }
        Update: {
          createdAt?: string | null
          createdBy?: string | null
          cropName?: string | null
          cropSeason?: string | null
          disbursementDate?: string | null
          drawnAmount?: number | null
          dueDate?: string | null
          id?: string
          interestRate?: number | null
          jurisdiction?: string | null
          landAreaHectares?: number | null
          loanNo?: string | null
          memberId?: string | null
          memberName?: string | null
          narration?: string | null
          outstandingAmount?: number | null
          repaidAmount?: number | null
          sanctionedAmount?: number | null
          society_id?: string
          status?: string | null
          voucherId?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          marketing_consent: boolean
          name: string | null
          page_url: string | null
          society_type: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          marketing_consent?: boolean
          name?: string | null
          page_url?: string | null
          society_type?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          marketing_consent?: boolean
          name?: string | null
          page_url?: string | null
          society_type?: string | null
          source?: string | null
        }
        Relationships: []
      }
      ledger_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          created_at: string
          event_id: string
          event_type: string
          jurisdiction: string | null
          occurred_at: string
          on_behalf_of: string | null
          payload: Json
          producer_id: string | null
          producer_kind: string
          reversal_of: string | null
          schema_version: number
          sequence: number
          society_id: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          created_at?: string
          event_id: string
          event_type: string
          jurisdiction?: string | null
          occurred_at?: string
          on_behalf_of?: string | null
          payload: Json
          producer_id?: string | null
          producer_kind?: string
          reversal_of?: string | null
          schema_version?: number
          sequence: number
          society_id: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          created_at?: string
          event_id?: string
          event_type?: string
          jurisdiction?: string | null
          occurred_at?: string
          on_behalf_of?: string | null
          payload?: Json
          producer_id?: string | null
          producer_kind?: string
          reversal_of?: string | null
          schema_version?: number
          sequence?: number
          society_id?: string
        }
        Relationships: []
      }
      loan_interest_accruals: {
        Row: {
          amount: number
          createdAt: string
          createdBy: string | null
          days: number
          id: string
          isDeleted: boolean
          loanId: string
          memberId: string | null
          outstanding: number
          overdue: boolean
          periodFrom: string
          periodTo: string
          ratePa: number
          recovered: number
          society_id: string
          voucherId: string | null
        }
        Insert: {
          amount?: number
          createdAt?: string
          createdBy?: string | null
          days?: number
          id: string
          isDeleted?: boolean
          loanId: string
          memberId?: string | null
          outstanding?: number
          overdue?: boolean
          periodFrom: string
          periodTo: string
          ratePa?: number
          recovered?: number
          society_id: string
          voucherId?: string | null
        }
        Update: {
          amount?: number
          createdAt?: string
          createdBy?: string | null
          days?: number
          id?: string
          isDeleted?: boolean
          loanId?: string
          memberId?: string | null
          outstanding?: number
          overdue?: boolean
          periodFrom?: string
          periodTo?: string
          ratePa?: number
          recovered?: number
          society_id?: string
          voucherId?: string | null
        }
        Relationships: []
      }
      loans: {
        Row: {
          amount: number | null
          createdAt: string | null
          disbursementDate: string | null
          dueDate: string | null
          id: string
          interestRate: number | null
          isDeleted: boolean | null
          jurisdiction: string | null
          loanNo: string | null
          loanType: string | null
          memberId: string | null
          monthlyInstallment: number | null
          purpose: string | null
          repaidAmount: number | null
          security: string | null
          society_id: string
          status: string | null
          sureties: Json | null
          voucherId: string | null
        }
        Insert: {
          amount?: number | null
          createdAt?: string | null
          disbursementDate?: string | null
          dueDate?: string | null
          id: string
          interestRate?: number | null
          isDeleted?: boolean | null
          jurisdiction?: string | null
          loanNo?: string | null
          loanType?: string | null
          memberId?: string | null
          monthlyInstallment?: number | null
          purpose?: string | null
          repaidAmount?: number | null
          security?: string | null
          society_id: string
          status?: string | null
          sureties?: Json | null
          voucherId?: string | null
        }
        Update: {
          amount?: number | null
          createdAt?: string | null
          disbursementDate?: string | null
          dueDate?: string | null
          id?: string
          interestRate?: number | null
          isDeleted?: boolean | null
          jurisdiction?: string | null
          loanNo?: string | null
          loanType?: string | null
          memberId?: string | null
          monthlyInstallment?: number | null
          purpose?: string | null
          repaidAmount?: number | null
          security?: string | null
          society_id?: string
          status?: string | null
          sureties?: Json | null
          voucherId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_member_fkey"
            columns: ["memberId", "society_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "society_id"]
          },
        ]
      }
      maintenance_bills: {
        Row: {
          amount: number | null
          billNo: string | null
          createdAt: string | null
          date: string | null
          flatId: string | null
          flatNo: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          lines: Json | null
          memberId: string | null
          paidAmount: number | null
          period: string | null
          receivableAccountId: string | null
          society_id: string
          status: string | null
          voucherId: string | null
        }
        Insert: {
          amount?: number | null
          billNo?: string | null
          createdAt?: string | null
          date?: string | null
          flatId?: string | null
          flatNo?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          lines?: Json | null
          memberId?: string | null
          paidAmount?: number | null
          period?: string | null
          receivableAccountId?: string | null
          society_id: string
          status?: string | null
          voucherId?: string | null
        }
        Update: {
          amount?: number | null
          billNo?: string | null
          createdAt?: string | null
          date?: string | null
          flatId?: string | null
          flatNo?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          lines?: Json | null
          memberId?: string | null
          paidAmount?: number | null
          period?: string | null
          receivableAccountId?: string | null
          society_id?: string
          status?: string | null
          voucherId?: string | null
        }
        Relationships: []
      }
      marketing_dealer_licences: {
        Row: {
          authority: string | null
          createdAt: string
          id: string
          isDeleted: boolean
          issuedOn: string | null
          jurisdiction: string | null
          kind: string
          licenceNo: string | null
          note: string | null
          productGroup: string | null
          society_id: string
          sourceName: string | null
          supplierId: string | null
          updatedAt: string
          validUpto: string | null
        }
        Insert: {
          authority?: string | null
          createdAt?: string
          id: string
          isDeleted?: boolean
          issuedOn?: string | null
          jurisdiction?: string | null
          kind: string
          licenceNo?: string | null
          note?: string | null
          productGroup?: string | null
          society_id: string
          sourceName?: string | null
          supplierId?: string | null
          updatedAt?: string
          validUpto?: string | null
        }
        Update: {
          authority?: string | null
          createdAt?: string
          id?: string
          isDeleted?: boolean
          issuedOn?: string | null
          jurisdiction?: string | null
          kind?: string
          licenceNo?: string | null
          note?: string | null
          productGroup?: string | null
          society_id?: string
          sourceName?: string | null
          supplierId?: string | null
          updatedAt?: string
          validUpto?: string | null
        }
        Relationships: []
      }
      marketing_hired_trips: {
        Row: {
          createdAt: string
          date: string
          dispatchId: string | null
          expenseAccountId: string
          freight: number
          fromPlace: string | null
          id: string
          isDeleted: boolean
          jurisdiction: string | null
          note: string | null
          payableAccountId: string
          qty: number | null
          rate: number | null
          society_id: string
          toPlace: string | null
          transporterId: string
          tripNo: string
          updatedAt: string
          vehicleNo: string | null
          voucherId: string | null
        }
        Insert: {
          createdAt?: string
          date: string
          dispatchId?: string | null
          expenseAccountId: string
          freight?: number
          fromPlace?: string | null
          id: string
          isDeleted?: boolean
          jurisdiction?: string | null
          note?: string | null
          payableAccountId: string
          qty?: number | null
          rate?: number | null
          society_id: string
          toPlace?: string | null
          transporterId: string
          tripNo: string
          updatedAt?: string
          vehicleNo?: string | null
          voucherId?: string | null
        }
        Update: {
          createdAt?: string
          date?: string
          dispatchId?: string | null
          expenseAccountId?: string
          freight?: number
          fromPlace?: string | null
          id?: string
          isDeleted?: boolean
          jurisdiction?: string | null
          note?: string | null
          payableAccountId?: string
          qty?: number | null
          rate?: number | null
          society_id?: string
          toPlace?: string | null
          transporterId?: string
          tripNo?: string
          updatedAt?: string
          vehicleNo?: string | null
          voucherId?: string | null
        }
        Relationships: []
      }
      marketing_scheme_claims: {
        Row: {
          amount: number
          authority: string | null
          claimNo: string
          createdAt: string
          creditAccountId: string
          date: string
          id: string
          isDeleted: boolean
          jurisdiction: string | null
          note: string | null
          period: string | null
          receivableAccountId: string
          schemeName: string
          society_id: string
          updatedAt: string
          voucherId: string | null
        }
        Insert: {
          amount?: number
          authority?: string | null
          claimNo: string
          createdAt?: string
          creditAccountId: string
          date: string
          id: string
          isDeleted?: boolean
          jurisdiction?: string | null
          note?: string | null
          period?: string | null
          receivableAccountId: string
          schemeName: string
          society_id: string
          updatedAt?: string
          voucherId?: string | null
        }
        Update: {
          amount?: number
          authority?: string | null
          claimNo?: string
          createdAt?: string
          creditAccountId?: string
          date?: string
          id?: string
          isDeleted?: boolean
          jurisdiction?: string | null
          note?: string | null
          period?: string | null
          receivableAccountId?: string
          schemeName?: string
          society_id?: string
          updatedAt?: string
          voucherId?: string | null
        }
        Relationships: []
      }
      marketing_transporters: {
        Row: {
          createdAt: string | null
          id: string
          jurisdiction: string | null
          ledgerAccountId: string | null
          name: string | null
          nameHi: string | null
          phone: string | null
          ratePerQtl: number | null
          society_id: string
          updatedAt: string | null
          vehicleNo: string | null
        }
        Insert: {
          createdAt?: string | null
          id: string
          jurisdiction?: string | null
          ledgerAccountId?: string | null
          name?: string | null
          nameHi?: string | null
          phone?: string | null
          ratePerQtl?: number | null
          society_id: string
          updatedAt?: string | null
          vehicleNo?: string | null
        }
        Update: {
          createdAt?: string | null
          id?: string
          jurisdiction?: string | null
          ledgerAccountId?: string | null
          name?: string | null
          nameHi?: string | null
          phone?: string | null
          ratePerQtl?: number | null
          society_id?: string
          updatedAt?: string | null
          vehicleNo?: string | null
        }
        Relationships: []
      }
      meeting_register: {
        Row: {
          agenda: string | null
          attendees: string | null
          createdAt: string | null
          date: string | null
          id: string
          jurisdiction: string | null
          meetingNo: string | null
          minutes: string | null
          resolutions: string | null
          society_id: string
          status: string | null
          time: string | null
          type: string | null
          venue: string | null
        }
        Insert: {
          agenda?: string | null
          attendees?: string | null
          createdAt?: string | null
          date?: string | null
          id: string
          jurisdiction?: string | null
          meetingNo?: string | null
          minutes?: string | null
          resolutions?: string | null
          society_id: string
          status?: string | null
          time?: string | null
          type?: string | null
          venue?: string | null
        }
        Update: {
          agenda?: string | null
          attendees?: string | null
          createdAt?: string | null
          date?: string | null
          id?: string
          jurisdiction?: string | null
          meetingNo?: string | null
          minutes?: string | null
          resolutions?: string | null
          society_id?: string
          status?: string | null
          time?: string | null
          type?: string | null
          venue?: string | null
        }
        Relationships: []
      }
      member_distribution_runs: {
        Row: {
          basis: string
          createdAt: string
          createdBy: string | null
          fyLabel: string
          id: string
          isDeleted: boolean
          kind: string
          lines: Json
          ratePct: number | null
          society_id: string
          source: string
          status: string
          total: number
          voucherId: string | null
        }
        Insert: {
          basis?: string
          createdAt?: string
          createdBy?: string | null
          fyLabel: string
          id: string
          isDeleted?: boolean
          kind: string
          lines?: Json
          ratePct?: number | null
          society_id: string
          source?: string
          status?: string
          total?: number
          voucherId?: string | null
        }
        Update: {
          basis?: string
          createdAt?: string
          createdBy?: string | null
          fyLabel?: string
          id?: string
          isDeleted?: boolean
          kind?: string
          lines?: Json
          ratePct?: number | null
          society_id?: string
          source?: string
          status?: string
          total?: number
          voucherId?: string | null
        }
        Relationships: []
      }
      member_identity: {
        Row: {
          aadhaar: string | null
          member_id: string
          pan: string | null
          society_id: string
          updated_at: string
        }
        Insert: {
          aadhaar?: string | null
          member_id: string
          pan?: string | null
          society_id: string
          updated_at?: string
        }
        Update: {
          aadhaar?: string | null
          member_id?: string
          pan?: string | null
          society_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      member_portal_login_attempts: {
        Row: {
          attempts: number
          key: string
          locked_until: string | null
          window_start: string
        }
        Insert: {
          attempts?: number
          key: string
          locked_until?: string | null
          window_start?: string
        }
        Update: {
          attempts?: number
          key?: string
          locked_until?: string | null
          window_start?: string
        }
        Relationships: []
      }
      member_portal_users: {
        Row: {
          auth_user_id: string
          created_at: string
          created_by: string | null
          is_active: boolean
          member_id: string
          revoked_at: string | null
          revoked_by: string | null
          society_id: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          member_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          society_id: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          member_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          society_id?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          aadhaar: string | null
          address: string | null
          admissionDate: string | null
          admissionFee: number | null
          admissionResolutionDate: string | null
          admissionResolutionNo: string | null
          age: number | null
          applicationDate: string | null
          approvalStatus: string | null
          branchId: string | null
          caste: string | null
          correspondenceAddress: string | null
          createdAt: string | null
          creditLimit: number | null
          dateOfBirth: string | null
          decidedAt: string | null
          district: string | null
          fatherName: string | null
          gender: string | null
          id: string
          isDeleted: boolean | null
          joinDate: string | null
          jurisdiction: string | null
          kycStatus: string | null
          memberId: string | null
          memberType: string | null
          name: string | null
          nomineeAddress: string | null
          nomineeAge: number | null
          nomineeFatherName: string | null
          nomineeName: string | null
          nomineeOccupation: string | null
          nomineePhone: string | null
          nomineeRelation: string | null
          nominees: Json | null
          nomineeShares: number | null
          occupation: string | null
          pan: string | null
          paymentMode: string | null
          phone: string | null
          photoPath: string | null
          pinCode: string | null
          postOffice: string | null
          rejectionReason: string | null
          shareCapital: number | null
          shareCertIssuedAt: string | null
          shareCertNo: string | null
          shareCertReason: string | null
          shareCertStatus: string | null
          shareCount: number | null
          shareFaceValue: number | null
          society_id: string
          state: string | null
          status: string | null
          statusChangedAt: string | null
          statusDetails: Json | null
          statusReason: string | null
          statusResolutionDate: string | null
          statusResolutionNo: string | null
          tehsil: string | null
        }
        Insert: {
          aadhaar?: string | null
          address?: string | null
          admissionDate?: string | null
          admissionFee?: number | null
          admissionResolutionDate?: string | null
          admissionResolutionNo?: string | null
          age?: number | null
          applicationDate?: string | null
          approvalStatus?: string | null
          branchId?: string | null
          caste?: string | null
          correspondenceAddress?: string | null
          createdAt?: string | null
          creditLimit?: number | null
          dateOfBirth?: string | null
          decidedAt?: string | null
          district?: string | null
          fatherName?: string | null
          gender?: string | null
          id: string
          isDeleted?: boolean | null
          joinDate?: string | null
          jurisdiction?: string | null
          kycStatus?: string | null
          memberId?: string | null
          memberType?: string | null
          name?: string | null
          nomineeAddress?: string | null
          nomineeAge?: number | null
          nomineeFatherName?: string | null
          nomineeName?: string | null
          nomineeOccupation?: string | null
          nomineePhone?: string | null
          nomineeRelation?: string | null
          nominees?: Json | null
          nomineeShares?: number | null
          occupation?: string | null
          pan?: string | null
          paymentMode?: string | null
          phone?: string | null
          photoPath?: string | null
          pinCode?: string | null
          postOffice?: string | null
          rejectionReason?: string | null
          shareCapital?: number | null
          shareCertIssuedAt?: string | null
          shareCertNo?: string | null
          shareCertReason?: string | null
          shareCertStatus?: string | null
          shareCount?: number | null
          shareFaceValue?: number | null
          society_id: string
          state?: string | null
          status?: string | null
          statusChangedAt?: string | null
          statusDetails?: Json | null
          statusReason?: string | null
          statusResolutionDate?: string | null
          statusResolutionNo?: string | null
          tehsil?: string | null
        }
        Update: {
          aadhaar?: string | null
          address?: string | null
          admissionDate?: string | null
          admissionFee?: number | null
          admissionResolutionDate?: string | null
          admissionResolutionNo?: string | null
          age?: number | null
          applicationDate?: string | null
          approvalStatus?: string | null
          branchId?: string | null
          caste?: string | null
          correspondenceAddress?: string | null
          createdAt?: string | null
          creditLimit?: number | null
          dateOfBirth?: string | null
          decidedAt?: string | null
          district?: string | null
          fatherName?: string | null
          gender?: string | null
          id?: string
          isDeleted?: boolean | null
          joinDate?: string | null
          jurisdiction?: string | null
          kycStatus?: string | null
          memberId?: string | null
          memberType?: string | null
          name?: string | null
          nomineeAddress?: string | null
          nomineeAge?: number | null
          nomineeFatherName?: string | null
          nomineeName?: string | null
          nomineeOccupation?: string | null
          nomineePhone?: string | null
          nomineeRelation?: string | null
          nominees?: Json | null
          nomineeShares?: number | null
          occupation?: string | null
          pan?: string | null
          paymentMode?: string | null
          phone?: string | null
          photoPath?: string | null
          pinCode?: string | null
          postOffice?: string | null
          rejectionReason?: string | null
          shareCapital?: number | null
          shareCertIssuedAt?: string | null
          shareCertNo?: string | null
          shareCertReason?: string | null
          shareCertStatus?: string | null
          shareCount?: number | null
          shareFaceValue?: number | null
          society_id?: string
          state?: string | null
          status?: string | null
          statusChangedAt?: string | null
          statusDetails?: Json | null
          statusReason?: string | null
          statusResolutionDate?: string | null
          statusResolutionNo?: string | null
          tehsil?: string | null
        }
        Relationships: []
      }
      mfa_failures: {
        Row: {
          at: string
          email: string
          id: number
        }
        Insert: {
          at?: string
          email: string
          id?: never
        }
        Update: {
          at?: string
          email?: string
          id?: never
        }
        Relationships: []
      }
      mfa_verified_sessions: {
        Row: {
          email: string
          session_id: string
          verified_at: string
        }
        Insert: {
          email: string
          session_id: string
          verified_at?: string
        }
        Update: {
          email?: string
          session_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      milk_entries: {
        Row: {
          amount: number | null
          centreId: string | null
          clr: number | null
          createdAt: string | null
          date: string | null
          fat: number | null
          id: string
          jurisdiction: string | null
          memberId: string | null
          memberName: string | null
          qty: number | null
          qualityDecision: string | null
          rate: number | null
          rateChartId: string | null
          shift: string | null
          snf: number | null
          society_id: string
          source: string | null
          water: number | null
        }
        Insert: {
          amount?: number | null
          centreId?: string | null
          clr?: number | null
          createdAt?: string | null
          date?: string | null
          fat?: number | null
          id: string
          jurisdiction?: string | null
          memberId?: string | null
          memberName?: string | null
          qty?: number | null
          qualityDecision?: string | null
          rate?: number | null
          rateChartId?: string | null
          shift?: string | null
          snf?: number | null
          society_id: string
          source?: string | null
          water?: number | null
        }
        Update: {
          amount?: number | null
          centreId?: string | null
          clr?: number | null
          createdAt?: string | null
          date?: string | null
          fat?: number | null
          id?: string
          jurisdiction?: string | null
          memberId?: string | null
          memberName?: string | null
          qty?: number | null
          qualityDecision?: string | null
          rate?: number | null
          rateChartId?: string | null
          shift?: string | null
          snf?: number | null
          society_id?: string
          source?: string | null
          water?: number | null
        }
        Relationships: []
      }
      muster_entries: {
        Row: {
          accrualVoucherId: string | null
          accrued: boolean | null
          createdAt: string | null
          dailyWage: number | null
          daysWorked: number | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          memberId: string | null
          paid: boolean | null
          paidAmount: number | null
          paymentVoucherId: string | null
          period: string | null
          society_id: string
          workBasis: string | null
          workOrderId: string | null
        }
        Insert: {
          accrualVoucherId?: string | null
          accrued?: boolean | null
          createdAt?: string | null
          dailyWage?: number | null
          daysWorked?: number | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          memberId?: string | null
          paid?: boolean | null
          paidAmount?: number | null
          paymentVoucherId?: string | null
          period?: string | null
          society_id: string
          workBasis?: string | null
          workOrderId?: string | null
        }
        Update: {
          accrualVoucherId?: string | null
          accrued?: boolean | null
          createdAt?: string | null
          dailyWage?: number | null
          daysWorked?: number | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          memberId?: string | null
          paid?: boolean | null
          paidAmount?: number | null
          paymentVoucherId?: string | null
          period?: string | null
          society_id?: string
          workBasis?: string | null
          workOrderId?: string | null
        }
        Relationships: []
      }
      notification_outbox: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          delivery_event_at: string | null
          delivery_status: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          locale: string
          locked_until: string | null
          payload: Json
          provider_message_id: string | null
          recipient: string
          scheduled_at: string
          sent_at: string | null
          society_id: string | null
          status: string
          template_key: string
        }
        Insert: {
          attempts?: number
          channel?: string
          created_at?: string
          delivery_event_at?: string | null
          delivery_status?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          locale?: string
          locked_until?: string | null
          payload?: Json
          provider_message_id?: string | null
          recipient: string
          scheduled_at?: string
          sent_at?: string | null
          society_id?: string | null
          status?: string
          template_key: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          delivery_event_at?: string | null
          delivery_status?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locale?: string
          locked_until?: string | null
          payload?: Json
          provider_message_id?: string | null
          recipient?: string
          scheduled_at?: string
          sent_at?: string | null
          society_id?: string | null
          status?: string
          template_key?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          activated_at: string | null
          amount: number
          amount_paise: number | null
          buyer_address: string | null
          buyer_gstin: string | null
          buyer_name: string | null
          buyer_state_code: string | null
          created_at: string
          currency: string
          id: string
          invoice_error: string | null
          invoice_tried_at: string | null
          is_test: boolean | null
          kind: string
          payer_email: string | null
          payment_id: string | null
          plan: string
          set_period_end: string | null
          society_id: string
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          amount: number
          amount_paise?: number | null
          buyer_address?: string | null
          buyer_gstin?: string | null
          buyer_name?: string | null
          buyer_state_code?: string | null
          created_at?: string
          currency?: string
          id: string
          invoice_error?: string | null
          invoice_tried_at?: string | null
          is_test?: boolean | null
          kind?: string
          payer_email?: string | null
          payment_id?: string | null
          plan: string
          set_period_end?: string | null
          society_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          amount?: number
          amount_paise?: number | null
          buyer_address?: string | null
          buyer_gstin?: string | null
          buyer_name?: string | null
          buyer_state_code?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_error?: string | null
          invoice_tried_at?: string | null
          is_test?: boolean | null
          kind?: string
          payer_email?: string | null
          payment_id?: string | null
          plan?: string
          set_period_end?: string | null
          society_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      p7_entries: {
        Row: {
          consumerProductSales: number | null
          createdAt: string | null
          fyStartDate: string | null
          godownRentPaid: number | null
          id: string
          jurisdiction: string | null
          narration: string | null
          rentedCapacityMT: number | null
          rentedGodownCount: number | null
          society_id: string
          sugarCattleFeedSales: number | null
          transportChargesPaid: number | null
          truckCount: number | null
        }
        Insert: {
          consumerProductSales?: number | null
          createdAt?: string | null
          fyStartDate?: string | null
          godownRentPaid?: number | null
          id: string
          jurisdiction?: string | null
          narration?: string | null
          rentedCapacityMT?: number | null
          rentedGodownCount?: number | null
          society_id: string
          sugarCattleFeedSales?: number | null
          transportChargesPaid?: number | null
          truckCount?: number | null
        }
        Update: {
          consumerProductSales?: number | null
          createdAt?: string | null
          fyStartDate?: string | null
          godownRentPaid?: number | null
          id?: string
          jurisdiction?: string | null
          narration?: string | null
          rentedCapacityMT?: number | null
          rentedGodownCount?: number | null
          society_id?: string
          sugarCattleFeedSales?: number | null
          transportChargesPaid?: number | null
          truckCount?: number | null
        }
        Relationships: []
      }
      partner_clawbacks: {
        Row: {
          amount_paise: number
          commission_id: number
          created_at: string
          created_by: string
          id: number
          partner_id: string
          reason: string
          settled_payout_id: number | null
        }
        Insert: {
          amount_paise: number
          commission_id: number
          created_at?: string
          created_by: string
          id?: number
          partner_id: string
          reason: string
          settled_payout_id?: number | null
        }
        Update: {
          amount_paise?: number
          commission_id?: number
          created_at?: string
          created_by?: string
          id?: number
          partner_id?: string
          reason?: string
          settled_payout_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_clawbacks_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: true
            referencedRelation: "partner_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_clawbacks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_clawbacks_settled_payout_id_fkey"
            columns: ["settled_payout_id"]
            isOneToOne: false
            referencedRelation: "partner_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_commission_rules: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          first_year_pct: number
          hold_days: number
          id: number
          note: string | null
          renewal_pct: number
          renewal_years: number
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from: string
          first_year_pct: number
          hold_days?: number
          id?: number
          note?: string | null
          renewal_pct: number
          renewal_years: number
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          first_year_pct?: number
          hold_days?: number
          id?: number
          note?: string | null
          renewal_pct?: number
          renewal_years?: number
        }
        Relationships: []
      }
      partner_commissions: {
        Row: {
          basis: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          code: string
          commission_paise: number
          created_at: string
          hold_until: string
          id: number
          invoice_date: string
          invoice_id: string
          invoice_no: string
          kind: string
          partner_id: string
          payout_id: number | null
          rate_pct: number | null
          rule_id: number | null
          society_id: string
          status: string
          taxable_paise: number
          updated_at: string
        }
        Insert: {
          basis: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          code: string
          commission_paise?: number
          created_at?: string
          hold_until: string
          id?: number
          invoice_date: string
          invoice_id: string
          invoice_no: string
          kind: string
          partner_id: string
          payout_id?: number | null
          rate_pct?: number | null
          rule_id?: number | null
          society_id: string
          status?: string
          taxable_paise: number
          updated_at?: string
        }
        Update: {
          basis?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          code?: string
          commission_paise?: number
          created_at?: string
          hold_until?: string
          id?: number
          invoice_date?: string
          invoice_id?: string
          invoice_no?: string
          kind?: string
          partner_id?: string
          payout_id?: number | null
          rate_pct?: number | null
          rule_id?: number | null
          society_id?: string
          status?: string
          taxable_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_commissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_payout_fk"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "partner_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "partner_commission_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_detail_requests: {
        Row: {
          account_name: string | null
          account_no: string | null
          admin_note: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          gstin: string | null
          id: number
          ifsc: string | null
          pan: string | null
          pan_name: string | null
          partner_id: string
          status: string
          upi_id: string | null
        }
        Insert: {
          account_name?: string | null
          account_no?: string | null
          admin_note?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          gstin?: string | null
          id?: number
          ifsc?: string | null
          pan?: string | null
          pan_name?: string | null
          partner_id: string
          status?: string
          upi_id?: string | null
        }
        Update: {
          account_name?: string | null
          account_no?: string | null
          admin_note?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          gstin?: string | null
          id?: number
          ifsc?: string | null
          pan?: string | null
          pan_name?: string | null
          partner_id?: string
          status?: string
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_detail_requests_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_login_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: number
          partner_id: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: number
          partner_id: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: number
          partner_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_login_codes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payment_details: {
        Row: {
          account_name: string | null
          account_no: string | null
          gstin: string | null
          ifsc: string | null
          pan: string | null
          pan_name: string | null
          partner_id: string
          updated_at: string
          updated_by: string
          upi_id: string | null
        }
        Insert: {
          account_name?: string | null
          account_no?: string | null
          gstin?: string | null
          ifsc?: string | null
          pan?: string | null
          pan_name?: string | null
          partner_id: string
          updated_at?: string
          updated_by: string
          upi_id?: string | null
        }
        Update: {
          account_name?: string | null
          account_no?: string | null
          gstin?: string | null
          ifsc?: string | null
          pan?: string | null
          pan_name?: string | null
          partner_id?: string
          updated_at?: string
          updated_by?: string
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_payment_details_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payout_items: {
        Row: {
          commission_id: number
          payout_id: number
        }
        Insert: {
          commission_id: number
          payout_id: number
        }
        Update: {
          commission_id?: number
          payout_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_payout_items_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: true
            referencedRelation: "partner_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payout_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "partner_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payouts: {
        Row: {
          base_paise: number
          clawback_paise: number
          created_at: string
          created_by: string
          credit_paise: number
          fy: string
          id: number
          method: string
          net_paise: number
          note: string | null
          pan_at_payout: string | null
          partner_id: string
          payout_date: string
          tds_paise: number
          tds_rate_pct: number
          tds_rule_id: number
          utr: string
        }
        Insert: {
          base_paise: number
          clawback_paise?: number
          created_at?: string
          created_by: string
          credit_paise: number
          fy: string
          id?: number
          method: string
          net_paise: number
          note?: string | null
          pan_at_payout?: string | null
          partner_id: string
          payout_date: string
          tds_paise: number
          tds_rate_pct: number
          tds_rule_id: number
          utr: string
        }
        Update: {
          base_paise?: number
          clawback_paise?: number
          created_at?: string
          created_by?: string
          credit_paise?: number
          fy?: string
          id?: number
          method?: string
          net_paise?: number
          note?: string | null
          pan_at_payout?: string | null
          partner_id?: string
          payout_date?: string
          tds_paise?: number
          tds_rate_pct?: number
          tds_rule_id?: number
          utr?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_payouts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payouts_tds_rule_id_fkey"
            columns: ["tds_rule_id"]
            isOneToOne: false
            referencedRelation: "partner_tds_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: number
          last_seen_at: string | null
          partner_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: number
          last_seen_at?: string | null
          partner_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: number
          last_seen_at?: string | null
          partner_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_tds_rules: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          fy_threshold_paise: number
          id: number
          no_pan_rate_pct: number
          note: string | null
          rate_pct: number
          section_ref: string
          source_ref: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from: string
          fy_threshold_paise: number
          id?: number
          no_pan_rate_pct: number
          note?: string | null
          rate_pct: number
          section_ref: string
          source_ref: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          fy_threshold_paise?: number
          id?: number
          no_pan_rate_pct?: number
          note?: string | null
          rate_pct?: number
          section_ref?: string
          source_ref?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          admin_note: string | null
          category: string
          code: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          declaration_version: string
          declared_not_proxy: boolean
          declared_not_public_servant: boolean
          district: string | null
          email: string | null
          id: string
          name: string
          note: string | null
          phone: string
          state: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          category: string
          code?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          declaration_version?: string
          declared_not_proxy: boolean
          declared_not_public_servant: boolean
          district?: string | null
          email?: string | null
          id?: string
          name: string
          note?: string | null
          phone: string
          state?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          category?: string
          code?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          declaration_version?: string
          declared_not_proxy?: boolean
          declared_not_public_servant?: boolean
          district?: string | null
          email?: string | null
          id?: string
          name?: string
          note?: string | null
          phone?: string
          state?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      party_identity: {
        Row: {
          entity_id: string
          entity_type: string
          fields: Json
          society_id: string
          updated_at: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          fields?: Json
          society_id: string
          updated_at?: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          fields?: Json
          society_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pf_esi_runs: {
        Row: {
          createdAt: string | null
          depositVoucherId: string | null
          epfAdminEdli: number | null
          epfEmployee: number | null
          epfEmployer: number | null
          esiEmployee: number | null
          esiEmployer: number | null
          grossWages: number | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          period: string | null
          society_id: string
          status: string | null
          voucherId: string | null
        }
        Insert: {
          createdAt?: string | null
          depositVoucherId?: string | null
          epfAdminEdli?: number | null
          epfEmployee?: number | null
          epfEmployer?: number | null
          esiEmployee?: number | null
          esiEmployer?: number | null
          grossWages?: number | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          period?: string | null
          society_id: string
          status?: string | null
          voucherId?: string | null
        }
        Update: {
          createdAt?: string | null
          depositVoucherId?: string | null
          epfAdminEdli?: number | null
          epfEmployee?: number | null
          epfEmployer?: number | null
          esiEmployee?: number | null
          esiEmployer?: number | null
          grossWages?: number | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          period?: string | null
          society_id?: string
          status?: string | null
          voucherId?: string | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean
          mfa_enabled: boolean
          name: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean
          mfa_enabled?: boolean
          name?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean
          mfa_enabled?: boolean
          name?: string
        }
        Relationships: []
      }
      procurement_agencies: {
        Row: {
          code: string | null
          commissionBasis: string | null
          commissionIncomeAccountId: string | null
          commissionRate: number | null
          createdAt: string | null
          id: string
          jurisdiction: string | null
          kind: string | null
          ledgerAccountId: string | null
          name: string | null
          nameHi: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          code?: string | null
          commissionBasis?: string | null
          commissionIncomeAccountId?: string | null
          commissionRate?: number | null
          createdAt?: string | null
          id: string
          jurisdiction?: string | null
          kind?: string | null
          ledgerAccountId?: string | null
          name?: string | null
          nameHi?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          code?: string | null
          commissionBasis?: string | null
          commissionIncomeAccountId?: string | null
          commissionRate?: number | null
          createdAt?: string | null
          id?: string
          jurisdiction?: string | null
          kind?: string | null
          ledgerAccountId?: string | null
          name?: string | null
          nameHi?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_agency_bills: {
        Row: {
          agencyId: string
          billNo: string
          createdAt: string
          date: string
          dispatchIds: Json
          id: string
          incidentalTotal: number
          isDeleted: boolean
          jurisdiction: string | null
          lines: Json
          mspValue: number
          note: string | null
          qty: number
          society_id: string
          status: string
          total: number
          updatedAt: string
          voucherId: string | null
        }
        Insert: {
          agencyId: string
          billNo: string
          createdAt?: string
          date: string
          dispatchIds?: Json
          id: string
          incidentalTotal?: number
          isDeleted?: boolean
          jurisdiction?: string | null
          lines?: Json
          mspValue?: number
          note?: string | null
          qty?: number
          society_id: string
          status?: string
          total?: number
          updatedAt?: string
          voucherId?: string | null
        }
        Update: {
          agencyId?: string
          billNo?: string
          createdAt?: string
          date?: string
          dispatchIds?: Json
          id?: string
          incidentalTotal?: number
          isDeleted?: boolean
          jurisdiction?: string | null
          lines?: Json
          mspValue?: number
          note?: string | null
          qty?: number
          society_id?: string
          status?: string
          total?: number
          updatedAt?: string
          voucherId?: string | null
        }
        Relationships: []
      }
      procurement_arhtiyas: {
        Row: {
          createdAt: string
          damiBasis: string | null
          damiRate: number | null
          id: string
          jurisdiction: string | null
          licenceNo: string | null
          mobile: string | null
          name: string
          nameHi: string | null
          society_id: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          damiBasis?: string | null
          damiRate?: number | null
          id: string
          jurisdiction?: string | null
          licenceNo?: string | null
          mobile?: string | null
          name: string
          nameHi?: string | null
          society_id: string
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          damiBasis?: string | null
          damiRate?: number | null
          id?: string
          jurisdiction?: string | null
          licenceNo?: string | null
          mobile?: string | null
          name?: string
          nameHi?: string | null
          society_id?: string
          updatedAt?: string
        }
        Relationships: []
      }
      procurement_bardana_movements: {
        Row: {
          bags: number
          bardanaTypeId: string | null
          createdAt: string
          date: string
          direction: string
          id: string
          jurisdiction: string | null
          lotId: string | null
          note: string | null
          partyId: string | null
          partyName: string | null
          partyType: string
          society_id: string
          updatedAt: string
        }
        Insert: {
          bags: number
          bardanaTypeId?: string | null
          createdAt?: string
          date: string
          direction: string
          id: string
          jurisdiction?: string | null
          lotId?: string | null
          note?: string | null
          partyId?: string | null
          partyName?: string | null
          partyType: string
          society_id: string
          updatedAt?: string
        }
        Update: {
          bags?: number
          bardanaTypeId?: string | null
          createdAt?: string
          date?: string
          direction?: string
          id?: string
          jurisdiction?: string | null
          lotId?: string | null
          note?: string | null
          partyId?: string | null
          partyName?: string | null
          partyType?: string
          society_id?: string
          updatedAt?: string
        }
        Relationships: []
      }
      procurement_bardana_types: {
        Row: {
          capacityKg: number | null
          createdAt: string | null
          id: string
          jurisdiction: string | null
          name: string | null
          nameHi: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          capacityKg?: number | null
          createdAt?: string | null
          id: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          capacityKg?: number | null
          createdAt?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_centres: {
        Row: {
          agencyId: string | null
          code: string | null
          createdAt: string | null
          id: string
          jurisdiction: string | null
          name: string | null
          nameHi: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          agencyId?: string | null
          code?: string | null
          createdAt?: string | null
          id: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          agencyId?: string | null
          code?: string | null
          createdAt?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_crops: {
        Row: {
          code: string | null
          createdAt: string | null
          id: string
          jurisdiction: string | null
          name: string | null
          nameHi: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          code?: string | null
          createdAt?: string | null
          id: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          code?: string | null
          createdAt?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_deduction_rules: {
        Row: {
          accountId: string | null
          basis: string | null
          basisUnit: string | null
          code: string | null
          createdAt: string | null
          id: string
          jurisdiction: string | null
          name: string | null
          nameHi: string | null
          rate: Json | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          accountId?: string | null
          basis?: string | null
          basisUnit?: string | null
          code?: string | null
          createdAt?: string | null
          id: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          rate?: Json | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          accountId?: string | null
          basis?: string | null
          basisUnit?: string | null
          code?: string | null
          createdAt?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          rate?: Json | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_dispatches: {
        Row: {
          acceptedDate: string | null
          acceptedQty: number | null
          agencyId: string
          bags: number | null
          createdAt: string
          date: string
          destination: string | null
          dispatchedQty: number
          dispatchedValue: number
          dispatchNo: string
          id: string
          isDeleted: boolean
          jurisdiction: string | null
          lotIds: Json
          note: string | null
          shortageAccountId: string | null
          shortageQty: number | null
          shortageValue: number | null
          shortageVoucherId: string | null
          society_id: string
          status: string
          transporterId: string | null
          updatedAt: string
          vehicleNo: string | null
        }
        Insert: {
          acceptedDate?: string | null
          acceptedQty?: number | null
          agencyId: string
          bags?: number | null
          createdAt?: string
          date: string
          destination?: string | null
          dispatchedQty?: number
          dispatchedValue?: number
          dispatchNo: string
          id: string
          isDeleted?: boolean
          jurisdiction?: string | null
          lotIds?: Json
          note?: string | null
          shortageAccountId?: string | null
          shortageQty?: number | null
          shortageValue?: number | null
          shortageVoucherId?: string | null
          society_id: string
          status?: string
          transporterId?: string | null
          updatedAt?: string
          vehicleNo?: string | null
        }
        Update: {
          acceptedDate?: string | null
          acceptedQty?: number | null
          agencyId?: string
          bags?: number | null
          createdAt?: string
          date?: string
          destination?: string | null
          dispatchedQty?: number
          dispatchedValue?: number
          dispatchNo?: string
          id?: string
          isDeleted?: boolean
          jurisdiction?: string | null
          lotIds?: Json
          note?: string | null
          shortageAccountId?: string | null
          shortageQty?: number | null
          shortageValue?: number | null
          shortageVoucherId?: string | null
          society_id?: string
          status?: string
          transporterId?: string | null
          updatedAt?: string
          vehicleNo?: string | null
        }
        Relationships: []
      }
      procurement_events: {
        Row: {
          actor: string | null
          correlationId: string | null
          id: string
          jurisdiction: string | null
          name: string
          occurredAt: string | null
          payload: Json | null
          recordedAt: string | null
          society_id: string
        }
        Insert: {
          actor?: string | null
          correlationId?: string | null
          id: string
          jurisdiction?: string | null
          name: string
          occurredAt?: string | null
          payload?: Json | null
          recordedAt?: string | null
          society_id: string
        }
        Update: {
          actor?: string | null
          correlationId?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string
          occurredAt?: string | null
          payload?: Json | null
          recordedAt?: string | null
          society_id?: string
        }
        Relationships: []
      }
      procurement_farmers: {
        Row: {
          bankAccountNo: string | null
          bankName: string | null
          createdAt: string | null
          farmerCode: string | null
          farmerName: string | null
          fatherName: string | null
          id: string
          ifsc: string | null
          jurisdiction: string | null
          mobile: string | null
          portalId: string | null
          society_id: string
          updatedAt: string | null
          village: string | null
        }
        Insert: {
          bankAccountNo?: string | null
          bankName?: string | null
          createdAt?: string | null
          farmerCode?: string | null
          farmerName?: string | null
          fatherName?: string | null
          id: string
          ifsc?: string | null
          jurisdiction?: string | null
          mobile?: string | null
          portalId?: string | null
          society_id: string
          updatedAt?: string | null
          village?: string | null
        }
        Update: {
          bankAccountNo?: string | null
          bankName?: string | null
          createdAt?: string | null
          farmerCode?: string | null
          farmerName?: string | null
          fatherName?: string | null
          id?: string
          ifsc?: string | null
          jurisdiction?: string | null
          mobile?: string | null
          portalId?: string | null
          society_id?: string
          updatedAt?: string | null
          village?: string | null
        }
        Relationships: []
      }
      procurement_financial_intents: {
        Row: {
          amount: Json | null
          amountAmountMinor: number | null
          amountCurrency: string | null
          createdAt: string | null
          id: string
          intentType: string | null
          jformId: string | null
          jurisdiction: string | null
          lotId: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          amount?: Json | null
          amountAmountMinor?: number | null
          amountCurrency?: string | null
          createdAt?: string | null
          id: string
          intentType?: string | null
          jformId?: string | null
          jurisdiction?: string | null
          lotId?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          amount?: Json | null
          amountAmountMinor?: number | null
          amountCurrency?: string | null
          createdAt?: string | null
          id?: string
          intentType?: string | null
          jformId?: string | null
          jurisdiction?: string | null
          lotId?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_jform_counters: {
        Row: {
          jurisdiction: string | null
          last_no: number
          society_id: string
        }
        Insert: {
          jurisdiction?: string | null
          last_no?: number
          society_id: string
        }
        Update: {
          jurisdiction?: string | null
          last_no?: number
          society_id?: string
        }
        Relationships: []
      }
      procurement_jforms: {
        Row: {
          createdAt: string | null
          deductions: Json | null
          deductionsAmountMinor: number | null
          deductionsCurrency: string | null
          documentNo: string | null
          gross: Json | null
          grossAmountMinor: number | null
          grossCurrency: string | null
          id: string
          jurisdiction: string | null
          lotId: string | null
          net: Json | null
          netAmountMinor: number | null
          netCurrency: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          deductions?: Json | null
          deductionsAmountMinor?: number | null
          deductionsCurrency?: string | null
          documentNo?: string | null
          gross?: Json | null
          grossAmountMinor?: number | null
          grossCurrency?: string | null
          id: string
          jurisdiction?: string | null
          lotId?: string | null
          net?: Json | null
          netAmountMinor?: number | null
          netCurrency?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          deductions?: Json | null
          deductionsAmountMinor?: number | null
          deductionsCurrency?: string | null
          documentNo?: string | null
          gross?: Json | null
          grossAmountMinor?: number | null
          grossCurrency?: string | null
          id?: string
          jurisdiction?: string | null
          lotId?: string | null
          net?: Json | null
          netAmountMinor?: number | null
          netCurrency?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_lots: {
        Row: {
          arhtiyaId: string | null
          bags: number | null
          cancelledAt: string | null
          cancelledBy: string | null
          cancelReason: string | null
          centreId: string | null
          createdAt: string | null
          cropId: string | null
          farmerId: string | null
          financialStatus: string | null
          grossWeight: number | null
          id: string
          jurisdiction: string | null
          lotDate: string | null
          mspRate: Json | null
          operationalStatus: string | null
          quantity: Json | null
          reconciliationStatus: string | null
          seasonId: string | null
          society_id: string
          tareWeight: number | null
          updatedAt: string | null
          varietyId: string | null
        }
        Insert: {
          arhtiyaId?: string | null
          bags?: number | null
          cancelledAt?: string | null
          cancelledBy?: string | null
          cancelReason?: string | null
          centreId?: string | null
          createdAt?: string | null
          cropId?: string | null
          farmerId?: string | null
          financialStatus?: string | null
          grossWeight?: number | null
          id: string
          jurisdiction?: string | null
          lotDate?: string | null
          mspRate?: Json | null
          operationalStatus?: string | null
          quantity?: Json | null
          reconciliationStatus?: string | null
          seasonId?: string | null
          society_id: string
          tareWeight?: number | null
          updatedAt?: string | null
          varietyId?: string | null
        }
        Update: {
          arhtiyaId?: string | null
          bags?: number | null
          cancelledAt?: string | null
          cancelledBy?: string | null
          cancelReason?: string | null
          centreId?: string | null
          createdAt?: string | null
          cropId?: string | null
          farmerId?: string | null
          financialStatus?: string | null
          grossWeight?: number | null
          id?: string
          jurisdiction?: string | null
          lotDate?: string | null
          mspRate?: Json | null
          operationalStatus?: string | null
          quantity?: Json | null
          reconciliationStatus?: string | null
          seasonId?: string | null
          society_id?: string
          tareWeight?: number | null
          updatedAt?: string | null
          varietyId?: string | null
        }
        Relationships: []
      }
      procurement_moisture_records: {
        Row: {
          createdAt: string | null
          id: string
          jurisdiction: string | null
          lotId: string | null
          moisture: Json | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          id: string
          jurisdiction?: string | null
          lotId?: string | null
          moisture?: Json | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          id?: string
          jurisdiction?: string | null
          lotId?: string | null
          moisture?: Json | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_msp_rates: {
        Row: {
          createdAt: string | null
          cropId: string | null
          effectiveFrom: string | null
          id: string
          jurisdiction: string | null
          rate: Json | null
          seasonId: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          cropId?: string | null
          effectiveFrom?: string | null
          id: string
          jurisdiction?: string | null
          rate?: Json | null
          seasonId?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          cropId?: string | null
          effectiveFrom?: string | null
          id?: string
          jurisdiction?: string | null
          rate?: Json | null
          seasonId?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_posting_requests: {
        Row: {
          amount: Json | null
          amountAmountMinor: number | null
          amountCurrency: string | null
          createdAt: string | null
          financialIntentId: string | null
          id: string
          jformId: string | null
          jurisdiction: string | null
          lotId: string | null
          requestType: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          amount?: Json | null
          amountAmountMinor?: number | null
          amountCurrency?: string | null
          createdAt?: string | null
          financialIntentId?: string | null
          id: string
          jformId?: string | null
          jurisdiction?: string | null
          lotId?: string | null
          requestType?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          amount?: Json | null
          amountAmountMinor?: number | null
          amountCurrency?: string | null
          createdAt?: string | null
          financialIntentId?: string | null
          id?: string
          jformId?: string | null
          jurisdiction?: string | null
          lotId?: string | null
          requestType?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_posting_rule_results: {
        Row: {
          createdAt: string | null
          financialIntentId: string | null
          id: string
          jformId: string | null
          jurisdiction: string | null
          legs: Json | null
          lotId: string | null
          postingRequestId: string | null
          profile: string | null
          requestType: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          financialIntentId?: string | null
          id: string
          jformId?: string | null
          jurisdiction?: string | null
          legs?: Json | null
          lotId?: string | null
          postingRequestId?: string | null
          profile?: string | null
          requestType?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          financialIntentId?: string | null
          id?: string
          jformId?: string | null
          jurisdiction?: string | null
          legs?: Json | null
          lotId?: string | null
          postingRequestId?: string | null
          profile?: string | null
          requestType?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_quality_specs: {
        Row: {
          createdAt: string | null
          cropId: string | null
          id: string
          jurisdiction: string | null
          maxLimit: number | null
          parameter: string | null
          seasonId: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          cropId?: string | null
          id: string
          jurisdiction?: string | null
          maxLimit?: number | null
          parameter?: string | null
          seasonId?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          cropId?: string | null
          id?: string
          jurisdiction?: string | null
          maxLimit?: number | null
          parameter?: string | null
          seasonId?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_quality_tests: {
        Row: {
          createdAt: string | null
          id: string
          inspectedBy: string | null
          jurisdiction: string | null
          lotId: string | null
          result: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          id: string
          inspectedBy?: string | null
          jurisdiction?: string | null
          lotId?: string | null
          result?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          id?: string
          inspectedBy?: string | null
          jurisdiction?: string | null
          lotId?: string | null
          result?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_seasons: {
        Row: {
          createdAt: string | null
          cropYear: string | null
          endDate: string | null
          id: string
          jurisdiction: string | null
          name: string | null
          nameHi: string | null
          society_id: string
          startDate: string | null
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          cropYear?: string | null
          endDate?: string | null
          id: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          society_id: string
          startDate?: string | null
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          cropYear?: string | null
          endDate?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          society_id?: string
          startDate?: string | null
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_settlement_counters: {
        Row: {
          jurisdiction: string | null
          last_no: number
          society_id: string
        }
        Insert: {
          jurisdiction?: string | null
          last_no?: number
          society_id: string
        }
        Update: {
          jurisdiction?: string | null
          last_no?: number
          society_id?: string
        }
        Relationships: []
      }
      procurement_settlements: {
        Row: {
          amountPaid: Json | null
          amountPaidAmountMinor: number | null
          amountPaidCurrency: string | null
          approvedAt: string | null
          approvedBy: string | null
          createdAt: string | null
          createdBy: string | null
          deductionLines: Json | null
          engineVoucherId: string | null
          gross: Json | null
          grossAmountMinor: number | null
          grossCurrency: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          netPayable: Json | null
          netPayableAmountMinor: number | null
          netPayableCurrency: string | null
          settlementNo: string | null
          settlementVoucherId: string | null
          society_id: string
          status: string | null
          updatedAt: string | null
        }
        Insert: {
          amountPaid?: Json | null
          amountPaidAmountMinor?: number | null
          amountPaidCurrency?: string | null
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string | null
          createdBy?: string | null
          deductionLines?: Json | null
          engineVoucherId?: string | null
          gross?: Json | null
          grossAmountMinor?: number | null
          grossCurrency?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          netPayable?: Json | null
          netPayableAmountMinor?: number | null
          netPayableCurrency?: string | null
          settlementNo?: string | null
          settlementVoucherId?: string | null
          society_id: string
          status?: string | null
          updatedAt?: string | null
        }
        Update: {
          amountPaid?: Json | null
          amountPaidAmountMinor?: number | null
          amountPaidCurrency?: string | null
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string | null
          createdBy?: string | null
          deductionLines?: Json | null
          engineVoucherId?: string | null
          gross?: Json | null
          grossAmountMinor?: number | null
          grossCurrency?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          netPayable?: Json | null
          netPayableAmountMinor?: number | null
          netPayableCurrency?: string | null
          settlementNo?: string | null
          settlementVoucherId?: string | null
          society_id?: string
          status?: string | null
          updatedAt?: string | null
        }
        Relationships: []
      }
      procurement_varieties: {
        Row: {
          createdAt: string | null
          cropId: string | null
          id: string
          jurisdiction: string | null
          name: string | null
          nameHi: string | null
          society_id: string
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          cropId?: string | null
          id: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          society_id: string
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          cropId?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          society_id?: string
          updatedAt?: string | null
        }
        Relationships: []
      }
      purchase_returns: {
        Row: {
          bankAccountId: string | null
          cgstAmount: number | null
          createdAt: string | null
          createdBy: string | null
          date: string | null
          grandTotal: number | null
          id: string
          igstAmount: number | null
          isDeleted: boolean | null
          items: Json | null
          jurisdiction: string | null
          netAmount: number | null
          originalPurchaseId: string | null
          purchaseNo: string | null
          refundMode: string | null
          returnNo: string | null
          sgstAmount: number | null
          society_id: string
          supplierId: string | null
          supplierName: string | null
          taxAmount: number | null
          voucherId: string | null
        }
        Insert: {
          bankAccountId?: string | null
          cgstAmount?: number | null
          createdAt?: string | null
          createdBy?: string | null
          date?: string | null
          grandTotal?: number | null
          id: string
          igstAmount?: number | null
          isDeleted?: boolean | null
          items?: Json | null
          jurisdiction?: string | null
          netAmount?: number | null
          originalPurchaseId?: string | null
          purchaseNo?: string | null
          refundMode?: string | null
          returnNo?: string | null
          sgstAmount?: number | null
          society_id: string
          supplierId?: string | null
          supplierName?: string | null
          taxAmount?: number | null
          voucherId?: string | null
        }
        Update: {
          bankAccountId?: string | null
          cgstAmount?: number | null
          createdAt?: string | null
          createdBy?: string | null
          date?: string | null
          grandTotal?: number | null
          id?: string
          igstAmount?: number | null
          isDeleted?: boolean | null
          items?: Json | null
          jurisdiction?: string | null
          netAmount?: number | null
          originalPurchaseId?: string | null
          purchaseNo?: string | null
          refundMode?: string | null
          returnNo?: string | null
          sgstAmount?: number | null
          society_id?: string
          supplierId?: string | null
          supplierName?: string | null
          taxAmount?: number | null
          voucherId?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          bankAccountId: string | null
          branchId: string | null
          cashDiscount: number | null
          cgstAmount: number | null
          cgstPct: number | null
          createdAt: string | null
          createdBy: string | null
          creditDays: number | null
          date: string | null
          discount: number | null
          dueDate: string | null
          grandTotal: number | null
          id: string
          igstAmount: number | null
          igstPct: number | null
          isDeleted: boolean | null
          items: Json | null
          jurisdiction: string | null
          lateFeeRule: Json | null
          memberId: string | null
          narration: string | null
          netAmount: number | null
          paymentMode: string | null
          purchaseNo: string | null
          rcmApplicable: boolean | null
          roundOff: number | null
          sgstAmount: number | null
          sgstPct: number | null
          society_id: string
          supplierBillDate: string | null
          supplierBillNo: string | null
          supplierId: string | null
          supplierName: string | null
          supplierPhone: string | null
          taxAmount: number | null
          taxVoucherIds: Json | null
          tcsAmount: number | null
          tcsPct: number | null
          tdsAmount: number | null
          tdsPct: number | null
          totalAmount: number | null
          voucherId: string | null
        }
        Insert: {
          bankAccountId?: string | null
          branchId?: string | null
          cashDiscount?: number | null
          cgstAmount?: number | null
          cgstPct?: number | null
          createdAt?: string | null
          createdBy?: string | null
          creditDays?: number | null
          date?: string | null
          discount?: number | null
          dueDate?: string | null
          grandTotal?: number | null
          id: string
          igstAmount?: number | null
          igstPct?: number | null
          isDeleted?: boolean | null
          items?: Json | null
          jurisdiction?: string | null
          lateFeeRule?: Json | null
          memberId?: string | null
          narration?: string | null
          netAmount?: number | null
          paymentMode?: string | null
          purchaseNo?: string | null
          rcmApplicable?: boolean | null
          roundOff?: number | null
          sgstAmount?: number | null
          sgstPct?: number | null
          society_id: string
          supplierBillDate?: string | null
          supplierBillNo?: string | null
          supplierId?: string | null
          supplierName?: string | null
          supplierPhone?: string | null
          taxAmount?: number | null
          taxVoucherIds?: Json | null
          tcsAmount?: number | null
          tcsPct?: number | null
          tdsAmount?: number | null
          tdsPct?: number | null
          totalAmount?: number | null
          voucherId?: string | null
        }
        Update: {
          bankAccountId?: string | null
          branchId?: string | null
          cashDiscount?: number | null
          cgstAmount?: number | null
          cgstPct?: number | null
          createdAt?: string | null
          createdBy?: string | null
          creditDays?: number | null
          date?: string | null
          discount?: number | null
          dueDate?: string | null
          grandTotal?: number | null
          id?: string
          igstAmount?: number | null
          igstPct?: number | null
          isDeleted?: boolean | null
          items?: Json | null
          jurisdiction?: string | null
          lateFeeRule?: Json | null
          memberId?: string | null
          narration?: string | null
          netAmount?: number | null
          paymentMode?: string | null
          purchaseNo?: string | null
          rcmApplicable?: boolean | null
          roundOff?: number | null
          sgstAmount?: number | null
          sgstPct?: number | null
          society_id?: string
          supplierBillDate?: string | null
          supplierBillNo?: string | null
          supplierId?: string | null
          supplierName?: string | null
          supplierPhone?: string | null
          taxAmount?: number | null
          taxVoucherIds?: Json | null
          tcsAmount?: number | null
          tcsPct?: number | null
          tdsAmount?: number | null
          tdsPct?: number | null
          totalAmount?: number | null
          voucherId?: string | null
        }
        Relationships: []
      }
      recoverables: {
        Row: {
          additions: number | null
          category: string | null
          createdAt: string | null
          fyStartDate: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          legalStage: string | null
          narration: string | null
          openingBalance: number | null
          partyName: string | null
          recoveries: number | null
          society_id: string
        }
        Insert: {
          additions?: number | null
          category?: string | null
          createdAt?: string | null
          fyStartDate?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          legalStage?: string | null
          narration?: string | null
          openingBalance?: number | null
          partyName?: string | null
          recoveries?: number | null
          society_id: string
        }
        Update: {
          additions?: number | null
          category?: string | null
          createdAt?: string | null
          fyStartDate?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          legalStage?: string | null
          narration?: string | null
          openingBalance?: number | null
          partyName?: string | null
          recoveries?: number | null
          society_id?: string
        }
        Relationships: []
      }
      referral_attribution_events: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: number
          new_partner_id: string | null
          old_partner_id: string | null
          reason: string | null
          society_id: string
          source: string | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          id?: number
          new_partner_id?: string | null
          old_partner_id?: string | null
          reason?: string | null
          society_id: string
          source?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: number
          new_partner_id?: string | null
          old_partner_id?: string | null
          reason?: string | null
          society_id?: string
          source?: string | null
        }
        Relationships: []
      }
      referral_attributions: {
        Row: {
          attributed_at: string
          attributed_by: string
          code: string
          partner_id: string
          society_id: string
          source: string
        }
        Insert: {
          attributed_at?: string
          attributed_by: string
          code: string
          partner_id: string
          society_id: string
          source: string
        }
        Update: {
          attributed_at?: string
          attributed_by?: string
          code?: string
          partner_id?: string
          society_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_attributions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      restore_staging: {
        Row: {
          created_at: string
          ops: Json
          run_id: string
          seq: number
          society_id: string
        }
        Insert: {
          created_at?: string
          ops: Json
          run_id: string
          seq: number
          society_id: string
        }
        Update: {
          created_at?: string
          ops?: Json
          run_id?: string
          seq?: number
          society_id?: string
        }
        Relationships: []
      }
      restore_tables: {
        Row: {
          table_name: string
        }
        Insert: {
          table_name: string
        }
        Update: {
          table_name?: string
        }
        Relationships: []
      }
      rls_policy_backup: {
        Row: {
          backed_up_at: string
          cmd: string | null
          id: number
          policy_name: string
          qual: string | null
          table_name: string
          with_check: string | null
        }
        Insert: {
          backed_up_at?: string
          cmd?: string | null
          id?: number
          policy_name: string
          qual?: string | null
          table_name: string
          with_check?: string | null
        }
        Update: {
          backed_up_at?: string
          cmd?: string | null
          id?: number
          policy_name?: string
          qual?: string | null
          table_name?: string
          with_check?: string | null
        }
        Relationships: []
      }
      salary_records: {
        Row: {
          accrualVoucherId: string | null
          allowances: number | null
          bankAccountId: string | null
          basicSalary: number | null
          createdAt: string | null
          deductions: number | null
          employeeId: string | null
          esiEmployee: number | null
          esiEmployer: number | null
          id: string
          isPaid: boolean | null
          jurisdiction: string | null
          month: string | null
          netSalary: number | null
          paidDate: string | null
          paymentMode: string | null
          pfEmployee: number | null
          pfEmployer: number | null
          pt: number | null
          slipNo: string | null
          society_id: string
          tds: number | null
          voucherId: string | null
        }
        Insert: {
          accrualVoucherId?: string | null
          allowances?: number | null
          bankAccountId?: string | null
          basicSalary?: number | null
          createdAt?: string | null
          deductions?: number | null
          employeeId?: string | null
          esiEmployee?: number | null
          esiEmployer?: number | null
          id: string
          isPaid?: boolean | null
          jurisdiction?: string | null
          month?: string | null
          netSalary?: number | null
          paidDate?: string | null
          paymentMode?: string | null
          pfEmployee?: number | null
          pfEmployer?: number | null
          pt?: number | null
          slipNo?: string | null
          society_id: string
          tds?: number | null
          voucherId?: string | null
        }
        Update: {
          accrualVoucherId?: string | null
          allowances?: number | null
          bankAccountId?: string | null
          basicSalary?: number | null
          createdAt?: string | null
          deductions?: number | null
          employeeId?: string | null
          esiEmployee?: number | null
          esiEmployer?: number | null
          id?: string
          isPaid?: boolean | null
          jurisdiction?: string | null
          month?: string | null
          netSalary?: number | null
          paidDate?: string | null
          paymentMode?: string | null
          pfEmployee?: number | null
          pfEmployer?: number | null
          pt?: number | null
          slipNo?: string | null
          society_id?: string
          tds?: number | null
          voucherId?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          bankAccountId: string | null
          branchId: string | null
          cgstAmount: number | null
          cgstPct: number | null
          createdAt: string | null
          createdBy: string | null
          creditDays: number | null
          customerId: string | null
          customerName: string | null
          customerPhone: string | null
          date: string | null
          discount: number | null
          dueDate: string | null
          grandTotal: number | null
          gstVoucherIds: Json | null
          id: string
          igstAmount: number | null
          igstPct: number | null
          isDeleted: boolean | null
          items: Json | null
          jurisdiction: string | null
          lateFeeRule: Json | null
          memberId: string | null
          narration: string | null
          netAmount: number | null
          paymentMode: string | null
          roundOff: number | null
          saleNo: string | null
          sgstAmount: number | null
          sgstPct: number | null
          society_id: string
          taxAmount: number | null
          totalAmount: number | null
          voucherId: string | null
        }
        Insert: {
          bankAccountId?: string | null
          branchId?: string | null
          cgstAmount?: number | null
          cgstPct?: number | null
          createdAt?: string | null
          createdBy?: string | null
          creditDays?: number | null
          customerId?: string | null
          customerName?: string | null
          customerPhone?: string | null
          date?: string | null
          discount?: number | null
          dueDate?: string | null
          grandTotal?: number | null
          gstVoucherIds?: Json | null
          id: string
          igstAmount?: number | null
          igstPct?: number | null
          isDeleted?: boolean | null
          items?: Json | null
          jurisdiction?: string | null
          lateFeeRule?: Json | null
          memberId?: string | null
          narration?: string | null
          netAmount?: number | null
          paymentMode?: string | null
          roundOff?: number | null
          saleNo?: string | null
          sgstAmount?: number | null
          sgstPct?: number | null
          society_id: string
          taxAmount?: number | null
          totalAmount?: number | null
          voucherId?: string | null
        }
        Update: {
          bankAccountId?: string | null
          branchId?: string | null
          cgstAmount?: number | null
          cgstPct?: number | null
          createdAt?: string | null
          createdBy?: string | null
          creditDays?: number | null
          customerId?: string | null
          customerName?: string | null
          customerPhone?: string | null
          date?: string | null
          discount?: number | null
          dueDate?: string | null
          grandTotal?: number | null
          gstVoucherIds?: Json | null
          id?: string
          igstAmount?: number | null
          igstPct?: number | null
          isDeleted?: boolean | null
          items?: Json | null
          jurisdiction?: string | null
          lateFeeRule?: Json | null
          memberId?: string | null
          narration?: string | null
          netAmount?: number | null
          paymentMode?: string | null
          roundOff?: number | null
          saleNo?: string | null
          sgstAmount?: number | null
          sgstPct?: number | null
          society_id?: string
          taxAmount?: number | null
          totalAmount?: number | null
          voucherId?: string | null
        }
        Relationships: []
      }
      sales_returns: {
        Row: {
          bankAccountId: string | null
          cgstAmount: number | null
          createdAt: string | null
          createdBy: string | null
          customerId: string | null
          customerName: string | null
          date: string | null
          grandTotal: number | null
          id: string
          igstAmount: number | null
          isDeleted: boolean | null
          items: Json | null
          jurisdiction: string | null
          memberId: string | null
          netAmount: number | null
          originalSaleId: string | null
          refundMode: string | null
          returnNo: string | null
          saleNo: string | null
          sgstAmount: number | null
          society_id: string
          taxAmount: number | null
          voucherId: string | null
        }
        Insert: {
          bankAccountId?: string | null
          cgstAmount?: number | null
          createdAt?: string | null
          createdBy?: string | null
          customerId?: string | null
          customerName?: string | null
          date?: string | null
          grandTotal?: number | null
          id: string
          igstAmount?: number | null
          isDeleted?: boolean | null
          items?: Json | null
          jurisdiction?: string | null
          memberId?: string | null
          netAmount?: number | null
          originalSaleId?: string | null
          refundMode?: string | null
          returnNo?: string | null
          saleNo?: string | null
          sgstAmount?: number | null
          society_id: string
          taxAmount?: number | null
          voucherId?: string | null
        }
        Update: {
          bankAccountId?: string | null
          cgstAmount?: number | null
          createdAt?: string | null
          createdBy?: string | null
          customerId?: string | null
          customerName?: string | null
          date?: string | null
          grandTotal?: number | null
          id?: string
          igstAmount?: number | null
          isDeleted?: boolean | null
          items?: Json | null
          jurisdiction?: string | null
          memberId?: string | null
          netAmount?: number | null
          originalSaleId?: string | null
          refundMode?: string | null
          returnNo?: string | null
          saleNo?: string | null
          sgstAmount?: number | null
          society_id?: string
          taxAmount?: number | null
          voucherId?: string | null
        }
        Relationships: []
      }
      signup_attempts: {
        Row: {
          at: string
          email_hash: string
          id: number
          ip_hash: string
        }
        Insert: {
          at?: string
          email_hash: string
          id?: number
          ip_hash: string
        }
        Update: {
          at?: string
          email_hash?: string
          id?: number
          ip_hash?: string
        }
        Relationships: []
      }
      societies: {
        Row: {
          address: string | null
          created_at: string | null
          district: string
          financial_year: string | null
          id: string
          name: string
          name_hi: string | null
          phone: string | null
          registration_no: string
          state: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          district: string
          financial_year?: string | null
          id?: string
          name: string
          name_hi?: string | null
          phone?: string | null
          registration_no: string
          state: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          district?: string
          financial_year?: string | null
          id?: string
          name?: string
          name_hi?: string | null
          phone?: string | null
          registration_no?: string
          state?: string
        }
        Relationships: []
      }
      society_activities: {
        Row: {
          activity: string
          config: Json | null
          disabled_at: string | null
          enabled_at: string
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          society_id: string
          status: string
        }
        Insert: {
          activity: string
          config?: Json | null
          disabled_at?: string | null
          enabled_at?: string
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          society_id: string
          status?: string
        }
        Update: {
          activity?: string
          config?: Json | null
          disabled_at?: string | null
          enabled_at?: string
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          society_id?: string
          status?: string
        }
        Relationships: []
      }
      society_capabilities: {
        Row: {
          capability: string
          created_at: string | null
          expires_at: string | null
          granted_by: string | null
          id: string
          jurisdiction: string | null
          mode: string
          society_id: string
          source: string
        }
        Insert: {
          capability: string
          created_at?: string | null
          expires_at?: string | null
          granted_by?: string | null
          id: string
          jurisdiction?: string | null
          mode?: string
          society_id: string
          source?: string
        }
        Update: {
          capability?: string
          created_at?: string | null
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          jurisdiction?: string | null
          mode?: string
          society_id?: string
          source?: string
        }
        Relationships: []
      }
      society_flags: {
        Row: {
          posting_service: boolean
          society_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          posting_service?: boolean
          society_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          posting_service?: boolean
          society_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      society_settings: {
        Row: {
          aato: number | null
          activitiesCutoverEnabled: boolean | null
          address: string | null
          approvalRequired: boolean | null
          approvalThresholdAmount: number | null
          approvalVoucherTypes: Json | null
          auditCertificates: Json | null
          bankAccountNo: string | null
          bankBranch: string | null
          bankIfsc: string | null
          bankName: string | null
          boardMembers: Json | null
          boardType: string | null
          businessType: string | null
          compulsoryDepositWithdrawal: boolean | null
          created_at: string | null
          district: string | null
          email: string | null
          entityPan: string | null
          financialYear: string | null
          financialYearStart: string | null
          fyCloseAuthority: string | null
          fyCloseAuthorityRequired: boolean | null
          fyLocked: boolean | null
          fyLockedAt: string | null
          fyLockedBy: string | null
          fyUnlockRequestedAt: string | null
          fyUnlockRequestedBy: string | null
          gstin: string | null
          hafedDistrictOffice: string | null
          id: string
          interestDayCount: string | null
          is_locked: boolean | null
          jurisdiction: string | null
          lateFeeRules: Json | null
          ledgerReadsEnabled: boolean | null
          liabilityEvidence: string | null
          liabilityType: string | null
          maintenanceGstEnabled: boolean | null
          maintenanceGstRate: number | null
          maxSharePremiumPercent: number | null
          name: string | null
          nameHi: string | null
          notificationChannels: Json | null
          periodLockBy: string | null
          periodLockDate: string | null
          phone: string | null
          pinCode: string | null
          plan: string | null
          plan_expires_at: string | null
          previousFinancialYear: string | null
          previousYearBalances: Json | null
          procurementVia5116: boolean | null
          producerEvidence: string | null
          producerSociety: boolean | null
          registrationNo: string | null
          reserveFundPct: number | null
          sanctionedStrength: number | null
          shortName: string | null
          shortNameHi: string | null
          signatories: Json | null
          society_id: string
          societyType: string | null
          societyVariant: string | null
          state: string | null
          statutoryAppropriation: boolean | null
          storageLossNormPct: number | null
          subscription_notes: string | null
          tan: string | null
          trial_ends_at: string | null
          upiId: string | null
        }
        Insert: {
          aato?: number | null
          activitiesCutoverEnabled?: boolean | null
          address?: string | null
          approvalRequired?: boolean | null
          approvalThresholdAmount?: number | null
          approvalVoucherTypes?: Json | null
          auditCertificates?: Json | null
          bankAccountNo?: string | null
          bankBranch?: string | null
          bankIfsc?: string | null
          bankName?: string | null
          boardMembers?: Json | null
          boardType?: string | null
          businessType?: string | null
          compulsoryDepositWithdrawal?: boolean | null
          created_at?: string | null
          district?: string | null
          email?: string | null
          entityPan?: string | null
          financialYear?: string | null
          financialYearStart?: string | null
          fyCloseAuthority?: string | null
          fyCloseAuthorityRequired?: boolean | null
          fyLocked?: boolean | null
          fyLockedAt?: string | null
          fyLockedBy?: string | null
          fyUnlockRequestedAt?: string | null
          fyUnlockRequestedBy?: string | null
          gstin?: string | null
          hafedDistrictOffice?: string | null
          id?: string
          interestDayCount?: string | null
          is_locked?: boolean | null
          jurisdiction?: string | null
          lateFeeRules?: Json | null
          ledgerReadsEnabled?: boolean | null
          liabilityEvidence?: string | null
          liabilityType?: string | null
          maintenanceGstEnabled?: boolean | null
          maintenanceGstRate?: number | null
          maxSharePremiumPercent?: number | null
          name?: string | null
          nameHi?: string | null
          notificationChannels?: Json | null
          periodLockBy?: string | null
          periodLockDate?: string | null
          phone?: string | null
          pinCode?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          previousFinancialYear?: string | null
          previousYearBalances?: Json | null
          procurementVia5116?: boolean | null
          producerEvidence?: string | null
          producerSociety?: boolean | null
          registrationNo?: string | null
          reserveFundPct?: number | null
          sanctionedStrength?: number | null
          shortName?: string | null
          shortNameHi?: string | null
          signatories?: Json | null
          society_id: string
          societyType?: string | null
          societyVariant?: string | null
          state?: string | null
          statutoryAppropriation?: boolean | null
          storageLossNormPct?: number | null
          subscription_notes?: string | null
          tan?: string | null
          trial_ends_at?: string | null
          upiId?: string | null
        }
        Update: {
          aato?: number | null
          activitiesCutoverEnabled?: boolean | null
          address?: string | null
          approvalRequired?: boolean | null
          approvalThresholdAmount?: number | null
          approvalVoucherTypes?: Json | null
          auditCertificates?: Json | null
          bankAccountNo?: string | null
          bankBranch?: string | null
          bankIfsc?: string | null
          bankName?: string | null
          boardMembers?: Json | null
          boardType?: string | null
          businessType?: string | null
          compulsoryDepositWithdrawal?: boolean | null
          created_at?: string | null
          district?: string | null
          email?: string | null
          entityPan?: string | null
          financialYear?: string | null
          financialYearStart?: string | null
          fyCloseAuthority?: string | null
          fyCloseAuthorityRequired?: boolean | null
          fyLocked?: boolean | null
          fyLockedAt?: string | null
          fyLockedBy?: string | null
          fyUnlockRequestedAt?: string | null
          fyUnlockRequestedBy?: string | null
          gstin?: string | null
          hafedDistrictOffice?: string | null
          id?: string
          interestDayCount?: string | null
          is_locked?: boolean | null
          jurisdiction?: string | null
          lateFeeRules?: Json | null
          ledgerReadsEnabled?: boolean | null
          liabilityEvidence?: string | null
          liabilityType?: string | null
          maintenanceGstEnabled?: boolean | null
          maintenanceGstRate?: number | null
          maxSharePremiumPercent?: number | null
          name?: string | null
          nameHi?: string | null
          notificationChannels?: Json | null
          periodLockBy?: string | null
          periodLockDate?: string | null
          phone?: string | null
          pinCode?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          previousFinancialYear?: string | null
          previousYearBalances?: Json | null
          procurementVia5116?: boolean | null
          producerEvidence?: string | null
          producerSociety?: boolean | null
          registrationNo?: string | null
          reserveFundPct?: number | null
          sanctionedStrength?: number | null
          shortName?: string | null
          shortNameHi?: string | null
          signatories?: Json | null
          society_id?: string
          societyType?: string | null
          societyVariant?: string | null
          state?: string | null
          statutoryAppropriation?: boolean | null
          storageLossNormPct?: number | null
          subscription_notes?: string | null
          tan?: string | null
          trial_ends_at?: string | null
          upiId?: string | null
        }
        Relationships: []
      }
      society_users: {
        Row: {
          auth_id: string | null
          branch_id: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          jurisdiction: string | null
          mfa_enabled: boolean | null
          mfa_enrolled_at: string | null
          mfa_secret: string | null
          name: string
          password: string
          role: string
          society_id: string | null
        }
        Insert: {
          auth_id?: string | null
          branch_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          jurisdiction?: string | null
          mfa_enabled?: boolean | null
          mfa_enrolled_at?: string | null
          mfa_secret?: string | null
          name: string
          password: string
          role: string
          society_id?: string | null
        }
        Update: {
          auth_id?: string | null
          branch_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          jurisdiction?: string | null
          mfa_enabled?: boolean | null
          mfa_enrolled_at?: string | null
          mfa_secret?: string | null
          name?: string
          password?: string
          role?: string
          society_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "society_users_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          currentStock: number | null
          gstRate: number | null
          hsnCode: string | null
          id: string
          isActive: boolean | null
          itemCode: string | null
          jurisdiction: string | null
          name: string | null
          nameHi: string | null
          openingStock: number | null
          p4Category: string | null
          purchaseAccountId: string | null
          purchaseRate: number | null
          sacCode: string | null
          saleRate: number | null
          salesAccountId: string | null
          society_id: string
          stockGroup: string | null
          unit: string | null
        }
        Insert: {
          currentStock?: number | null
          gstRate?: number | null
          hsnCode?: string | null
          id: string
          isActive?: boolean | null
          itemCode?: string | null
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          openingStock?: number | null
          p4Category?: string | null
          purchaseAccountId?: string | null
          purchaseRate?: number | null
          sacCode?: string | null
          saleRate?: number | null
          salesAccountId?: string | null
          society_id: string
          stockGroup?: string | null
          unit?: string | null
        }
        Update: {
          currentStock?: number | null
          gstRate?: number | null
          hsnCode?: string | null
          id?: string
          isActive?: boolean | null
          itemCode?: string | null
          jurisdiction?: string | null
          name?: string | null
          nameHi?: string | null
          openingStock?: number | null
          p4Category?: string | null
          purchaseAccountId?: string | null
          purchaseRate?: number | null
          sacCode?: string | null
          saleRate?: number | null
          salesAccountId?: string | null
          society_id?: string
          stockGroup?: string | null
          unit?: string | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          amount: number | null
          batchNo: string | null
          createdAt: string | null
          date: string | null
          expiryDate: string | null
          godownId: string | null
          id: string
          itemId: string | null
          jurisdiction: string | null
          narration: string | null
          qty: number | null
          rate: number | null
          reason: string | null
          referenceNo: string | null
          responsiblePerson: string | null
          society_id: string
          type: string | null
        }
        Insert: {
          amount?: number | null
          batchNo?: string | null
          createdAt?: string | null
          date?: string | null
          expiryDate?: string | null
          godownId?: string | null
          id: string
          itemId?: string | null
          jurisdiction?: string | null
          narration?: string | null
          qty?: number | null
          rate?: number | null
          reason?: string | null
          referenceNo?: string | null
          responsiblePerson?: string | null
          society_id: string
          type?: string | null
        }
        Update: {
          amount?: number | null
          batchNo?: string | null
          createdAt?: string | null
          date?: string | null
          expiryDate?: string | null
          godownId?: string | null
          id?: string
          itemId?: string | null
          jurisdiction?: string | null
          narration?: string | null
          qty?: number | null
          rate?: number | null
          reason?: string | null
          referenceNo?: string | null
          responsiblePerson?: string | null
          society_id?: string
          type?: string | null
        }
        Relationships: []
      }
      stock_verifications: {
        Row: {
          certificate: string | null
          createdAt: string
          createdBy: string | null
          date: string
          designation: string | null
          godownId: string | null
          id: string
          lines: Json
          remarks: string | null
          society_id: string
          status: string
          verificationNo: string
          verifiedBy: string
        }
        Insert: {
          certificate?: string | null
          createdAt?: string
          createdBy?: string | null
          date: string
          designation?: string | null
          godownId?: string | null
          id: string
          lines?: Json
          remarks?: string | null
          society_id: string
          status?: string
          verificationNo: string
          verifiedBy: string
        }
        Update: {
          certificate?: string | null
          createdAt?: string
          createdBy?: string | null
          date?: string
          designation?: string | null
          godownId?: string | null
          id?: string
          lines?: Json
          remarks?: string | null
          society_id?: string
          status?: string
          verificationNo?: string
          verifiedBy?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          activated_by: string | null
          created_at: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          plan: string
          seats_limit: number | null
          society_id: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          activated_by?: string | null
          created_at?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: string
          seats_limit?: number | null
          society_id: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          activated_by?: string | null
          created_at?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: string
          seats_limit?: number | null
          society_id?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          accountId: string | null
          accountNo: string | null
          address: string | null
          addressLine1: string | null
          addressLine2: string | null
          bankName: string | null
          beneficiaryName: string | null
          branch: string | null
          city: string | null
          contactDesignation: string | null
          contactPerson: string | null
          country: string | null
          createdAt: string | null
          creditDays: number | null
          creditLimit: number | null
          discountPercent: number | null
          email: string | null
          gstin: string | null
          gstNo: string | null
          id: string
          ifsc: string | null
          isActive: boolean | null
          jurisdiction: string | null
          landline: string | null
          lateFeeRule: Json | null
          legalName: string | null
          mailingName: string | null
          mobile: string | null
          name: string | null
          nameHi: string | null
          notes: string | null
          openingBalance: number | null
          openingBalanceType: string | null
          pan: string | null
          phone: string | null
          pincode: string | null
          placeOfSupply: string | null
          registrationType: string | null
          salesRep: string | null
          society_id: string
          state: string | null
          supplierCode: string | null
          supplierType: string | null
          tcsApplicable: boolean | null
          tdsApplicable: boolean | null
          tdsSection: string | null
          tradeName: string | null
          upiId: string | null
          website: string | null
        }
        Insert: {
          accountId?: string | null
          accountNo?: string | null
          address?: string | null
          addressLine1?: string | null
          addressLine2?: string | null
          bankName?: string | null
          beneficiaryName?: string | null
          branch?: string | null
          city?: string | null
          contactDesignation?: string | null
          contactPerson?: string | null
          country?: string | null
          createdAt?: string | null
          creditDays?: number | null
          creditLimit?: number | null
          discountPercent?: number | null
          email?: string | null
          gstin?: string | null
          gstNo?: string | null
          id: string
          ifsc?: string | null
          isActive?: boolean | null
          jurisdiction?: string | null
          landline?: string | null
          lateFeeRule?: Json | null
          legalName?: string | null
          mailingName?: string | null
          mobile?: string | null
          name?: string | null
          nameHi?: string | null
          notes?: string | null
          openingBalance?: number | null
          openingBalanceType?: string | null
          pan?: string | null
          phone?: string | null
          pincode?: string | null
          placeOfSupply?: string | null
          registrationType?: string | null
          salesRep?: string | null
          society_id: string
          state?: string | null
          supplierCode?: string | null
          supplierType?: string | null
          tcsApplicable?: boolean | null
          tdsApplicable?: boolean | null
          tdsSection?: string | null
          tradeName?: string | null
          upiId?: string | null
          website?: string | null
        }
        Update: {
          accountId?: string | null
          accountNo?: string | null
          address?: string | null
          addressLine1?: string | null
          addressLine2?: string | null
          bankName?: string | null
          beneficiaryName?: string | null
          branch?: string | null
          city?: string | null
          contactDesignation?: string | null
          contactPerson?: string | null
          country?: string | null
          createdAt?: string | null
          creditDays?: number | null
          creditLimit?: number | null
          discountPercent?: number | null
          email?: string | null
          gstin?: string | null
          gstNo?: string | null
          id?: string
          ifsc?: string | null
          isActive?: boolean | null
          jurisdiction?: string | null
          landline?: string | null
          lateFeeRule?: Json | null
          legalName?: string | null
          mailingName?: string | null
          mobile?: string | null
          name?: string | null
          nameHi?: string | null
          notes?: string | null
          openingBalance?: number | null
          openingBalanceType?: string | null
          pan?: string | null
          phone?: string | null
          pincode?: string | null
          placeOfSupply?: string | null
          registrationType?: string | null
          salesRep?: string | null
          society_id?: string
          state?: string | null
          supplierCode?: string | null
          supplierType?: string | null
          tcsApplicable?: boolean | null
          tdsApplicable?: boolean | null
          tdsSection?: string | null
          tradeName?: string | null
          upiId?: string | null
          website?: string | null
        }
        Relationships: []
      }
      tds_challan_links: {
        Row: {
          challanId: string | null
          entryId: string
          jurisdiction: string | null
          society_id: string
        }
        Insert: {
          challanId?: string | null
          entryId: string
          jurisdiction?: string | null
          society_id: string
        }
        Update: {
          challanId?: string | null
          entryId?: string
          jurisdiction?: string | null
          society_id?: string
        }
        Relationships: []
      }
      tds_challans: {
        Row: {
          amount: number | null
          bankName: string | null
          bsrCode: string | null
          challanDate: string | null
          challanSerial: string | null
          createdAt: string | null
          financialYear: string | null
          id: string
          interestAmount: number
          isDeleted: boolean | null
          jurisdiction: string | null
          otherAmount: number
          quarter: string | null
          society_id: string
          status: string | null
        }
        Insert: {
          amount?: number | null
          bankName?: string | null
          bsrCode?: string | null
          challanDate?: string | null
          challanSerial?: string | null
          createdAt?: string | null
          financialYear?: string | null
          id: string
          interestAmount?: number
          isDeleted?: boolean | null
          jurisdiction?: string | null
          otherAmount?: number
          quarter?: string | null
          society_id: string
          status?: string | null
        }
        Update: {
          amount?: number | null
          bankName?: string | null
          bsrCode?: string | null
          challanDate?: string | null
          challanSerial?: string | null
          createdAt?: string | null
          financialYear?: string | null
          id?: string
          interestAmount?: number
          isDeleted?: boolean | null
          jurisdiction?: string | null
          otherAmount?: number
          quarter?: string | null
          society_id?: string
          status?: string | null
        }
        Relationships: []
      }
      tds_entries: {
        Row: {
          challanId: string | null
          createdAt: string | null
          date: string | null
          deducteeName: string | null
          deducteePan: string | null
          deducteeType: string | null
          financialYear: string | null
          grossAmount: number | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          natureOfPayment: string | null
          purchaseId: string | null
          quarter: string | null
          section: string | null
          society_id: string
          status: string | null
          tdsAmount: number | null
          tdsRate: number | null
          voucherId: string | null
        }
        Insert: {
          challanId?: string | null
          createdAt?: string | null
          date?: string | null
          deducteeName?: string | null
          deducteePan?: string | null
          deducteeType?: string | null
          financialYear?: string | null
          grossAmount?: number | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          natureOfPayment?: string | null
          purchaseId?: string | null
          quarter?: string | null
          section?: string | null
          society_id: string
          status?: string | null
          tdsAmount?: number | null
          tdsRate?: number | null
          voucherId?: string | null
        }
        Update: {
          challanId?: string | null
          createdAt?: string | null
          date?: string | null
          deducteeName?: string | null
          deducteePan?: string | null
          deducteeType?: string | null
          financialYear?: string | null
          grossAmount?: number | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          natureOfPayment?: string | null
          purchaseId?: string | null
          quarter?: string | null
          section?: string | null
          society_id?: string
          status?: string | null
          tdsAmount?: number | null
          tdsRate?: number | null
          voucherId?: string | null
        }
        Relationships: []
      }
      transport_trips: {
        Row: {
          amount: number
          collectionVoucherIds: Json
          createdAt: string
          customerId: string
          date: string
          detention: number | null
          freight: number
          fromPlace: string | null
          id: string
          isDeleted: boolean
          jurisdiction: string | null
          loading: number | null
          narration: string | null
          paidAmount: number
          society_id: string
          status: string
          toPlace: string | null
          tripNo: string
          vehicleId: string
          voucherId: string | null
        }
        Insert: {
          amount?: number
          collectionVoucherIds?: Json
          createdAt?: string
          customerId: string
          date: string
          detention?: number | null
          freight?: number
          fromPlace?: string | null
          id: string
          isDeleted?: boolean
          jurisdiction?: string | null
          loading?: number | null
          narration?: string | null
          paidAmount?: number
          society_id: string
          status?: string
          toPlace?: string | null
          tripNo: string
          vehicleId: string
          voucherId?: string | null
        }
        Update: {
          amount?: number
          collectionVoucherIds?: Json
          createdAt?: string
          customerId?: string
          date?: string
          detention?: number | null
          freight?: number
          fromPlace?: string | null
          id?: string
          isDeleted?: boolean
          jurisdiction?: string | null
          loading?: number | null
          narration?: string | null
          paidAmount?: number
          society_id?: string
          status?: string
          toPlace?: string | null
          tripNo?: string
          vehicleId?: string
          voucherId?: string | null
        }
        Relationships: []
      }
      transport_vehicle_expenses: {
        Row: {
          accountId: string
          amount: number
          bankAccountId: string | null
          createdAt: string
          date: string
          expenseNo: string
          id: string
          isDeleted: boolean
          jurisdiction: string | null
          mode: string
          narration: string | null
          society_id: string
          vehicleId: string
          voucherId: string | null
        }
        Insert: {
          accountId: string
          amount?: number
          bankAccountId?: string | null
          createdAt?: string
          date: string
          expenseNo: string
          id: string
          isDeleted?: boolean
          jurisdiction?: string | null
          mode?: string
          narration?: string | null
          society_id: string
          vehicleId: string
          voucherId?: string | null
        }
        Update: {
          accountId?: string
          amount?: number
          bankAccountId?: string | null
          createdAt?: string
          date?: string
          expenseNo?: string
          id?: string
          isDeleted?: boolean
          jurisdiction?: string | null
          mode?: string
          narration?: string | null
          society_id?: string
          vehicleId?: string
          voucherId?: string | null
        }
        Relationships: []
      }
      transport_vehicles: {
        Row: {
          assetId: string | null
          capacity: string | null
          createdAt: string
          fitnessExpiry: string | null
          id: string
          insuranceExpiry: string | null
          isDeleted: boolean
          jurisdiction: string | null
          permitExpiry: string | null
          pucExpiry: string | null
          regNo: string
          remarks: string | null
          society_id: string
          status: string
          vehicleType: string
        }
        Insert: {
          assetId?: string | null
          capacity?: string | null
          createdAt?: string
          fitnessExpiry?: string | null
          id: string
          insuranceExpiry?: string | null
          isDeleted?: boolean
          jurisdiction?: string | null
          permitExpiry?: string | null
          pucExpiry?: string | null
          regNo: string
          remarks?: string | null
          society_id: string
          status?: string
          vehicleType?: string
        }
        Update: {
          assetId?: string | null
          capacity?: string | null
          createdAt?: string
          fitnessExpiry?: string | null
          id?: string
          insuranceExpiry?: string | null
          isDeleted?: boolean
          jurisdiction?: string | null
          permitExpiry?: string | null
          pucExpiry?: string | null
          regNo?: string
          remarks?: string | null
          society_id?: string
          status?: string
          vehicleType?: string
        }
        Relationships: []
      }
      user_mfa: {
        Row: {
          email: string
          enrolled_at: string | null
          secret: string
        }
        Insert: {
          email: string
          enrolled_at?: string | null
          secret: string
        }
        Update: {
          email?: string
          enrolled_at?: string | null
          secret?: string
        }
        Relationships: []
      }
      user_mfa_recovery: {
        Row: {
          code_hash: string
          email: string
          id: number
          used_at: string | null
        }
        Insert: {
          code_hash: string
          email: string
          id?: never
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          email?: string
          id?: never
          used_at?: string | null
        }
        Relationships: []
      }
      voucher_entries: {
        Row: {
          accountId: string
          costCentreId: string | null
          cr: number
          dr: number
          id: string
          jurisdiction: string | null
          narration: string | null
          society_id: string
          voucherId: string
          workOrderId: string | null
        }
        Insert: {
          accountId: string
          costCentreId?: string | null
          cr?: number
          dr?: number
          id: string
          jurisdiction?: string | null
          narration?: string | null
          society_id: string
          voucherId: string
          workOrderId?: string | null
        }
        Update: {
          accountId?: string
          costCentreId?: string | null
          cr?: number
          dr?: number
          id?: string
          jurisdiction?: string | null
          narration?: string | null
          society_id?: string
          voucherId?: string
          workOrderId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voucher_entries_account_fkey"
            columns: ["accountId", "society_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "society_id"]
          },
          {
            foreignKeyName: "voucher_entries_voucherId_fkey"
            columns: ["voucherId"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_lines: {
        Row: {
          account_id: string
          branch_id: string | null
          cost_centre_id: string | null
          cr_minor: number
          created_at: string
          dr_minor: number
          entry_date: string
          fy_id: string
          id: string
          line_no: number
          narration: string | null
          society_id: string
          source: string
          status: string
          voucher_id: string
          work_order_id: string | null
        }
        Insert: {
          account_id: string
          branch_id?: string | null
          cost_centre_id?: string | null
          cr_minor?: number
          created_at?: string
          dr_minor?: number
          entry_date: string
          fy_id: string
          id: string
          line_no: number
          narration?: string | null
          society_id: string
          source?: string
          status?: string
          voucher_id: string
          work_order_id?: string | null
        }
        Update: {
          account_id?: string
          branch_id?: string | null
          cost_centre_id?: string | null
          cr_minor?: number
          created_at?: string
          dr_minor?: number
          entry_date?: string
          fy_id?: string
          id?: string
          line_no?: number
          narration?: string | null
          society_id?: string
          source?: string
          status?: string
          voucher_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voucher_lines_account_fkey"
            columns: ["account_id", "society_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "society_id"]
          },
          {
            foreignKeyName: "voucher_lines_fy_id_fkey"
            columns: ["fy_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_lines_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          amount: number | null
          approvalRemarks: string | null
          approvalStatus: string | null
          approvedAt: string | null
          approvedBy: string | null
          billAllocations: Json | null
          branchId: string | null
          chequeDate: string | null
          chequeNo: string | null
          clearedDate: string | null
          costCentreId: string | null
          createdAt: string | null
          createdBy: string | null
          creditAccountId: string | null
          date: string | null
          debitAccountId: string | null
          deletedAt: string | null
          deletedBy: string | null
          deletedReason: string | null
          editHistory: Json | null
          groupId: string | null
          id: string
          isCleared: boolean | null
          isDeleted: boolean | null
          jurisdiction: string | null
          lines: Json | null
          makerEmails: string[] | null
          memberId: string | null
          narration: string | null
          origin: string | null
          postedAt: string | null
          postedByEmail: string | null
          refId: string | null
          refType: string | null
          reversalOf: string | null
          reversedBy: string | null
          society_id: string
          type: string | null
          voucherNo: string | null
          workOrderId: string | null
        }
        Insert: {
          amount?: number | null
          approvalRemarks?: string | null
          approvalStatus?: string | null
          approvedAt?: string | null
          approvedBy?: string | null
          billAllocations?: Json | null
          branchId?: string | null
          chequeDate?: string | null
          chequeNo?: string | null
          clearedDate?: string | null
          costCentreId?: string | null
          createdAt?: string | null
          createdBy?: string | null
          creditAccountId?: string | null
          date?: string | null
          debitAccountId?: string | null
          deletedAt?: string | null
          deletedBy?: string | null
          deletedReason?: string | null
          editHistory?: Json | null
          groupId?: string | null
          id: string
          isCleared?: boolean | null
          isDeleted?: boolean | null
          jurisdiction?: string | null
          lines?: Json | null
          makerEmails?: string[] | null
          memberId?: string | null
          narration?: string | null
          origin?: string | null
          postedAt?: string | null
          postedByEmail?: string | null
          refId?: string | null
          refType?: string | null
          reversalOf?: string | null
          reversedBy?: string | null
          society_id: string
          type?: string | null
          voucherNo?: string | null
          workOrderId?: string | null
        }
        Update: {
          amount?: number | null
          approvalRemarks?: string | null
          approvalStatus?: string | null
          approvedAt?: string | null
          approvedBy?: string | null
          billAllocations?: Json | null
          branchId?: string | null
          chequeDate?: string | null
          chequeNo?: string | null
          clearedDate?: string | null
          costCentreId?: string | null
          createdAt?: string | null
          createdBy?: string | null
          creditAccountId?: string | null
          date?: string | null
          debitAccountId?: string | null
          deletedAt?: string | null
          deletedBy?: string | null
          deletedReason?: string | null
          editHistory?: Json | null
          groupId?: string | null
          id?: string
          isCleared?: boolean | null
          isDeleted?: boolean | null
          jurisdiction?: string | null
          lines?: Json | null
          makerEmails?: string[] | null
          memberId?: string | null
          narration?: string | null
          origin?: string | null
          postedAt?: string | null
          postedByEmail?: string | null
          refId?: string | null
          refType?: string | null
          reversalOf?: string | null
          reversedBy?: string | null
          society_id?: string
          type?: string | null
          voucherNo?: string | null
          workOrderId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_credit_account_fkey"
            columns: ["creditAccountId", "society_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "society_id"]
          },
          {
            foreignKeyName: "vouchers_debit_account_fkey"
            columns: ["debitAccountId", "society_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "society_id"]
          },
          {
            foreignKeyName: "vouchers_member_fkey"
            columns: ["memberId", "society_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "society_id"]
          },
        ]
      }
      work_orders: {
        Row: {
          clientName: string | null
          contractValue: number | null
          createdAt: string | null
          departmentId: string | null
          description: string | null
          endDate: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          society_id: string
          startDate: string | null
          status: string | null
          workOrderNo: string | null
        }
        Insert: {
          clientName?: string | null
          contractValue?: number | null
          createdAt?: string | null
          departmentId?: string | null
          description?: string | null
          endDate?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          society_id: string
          startDate?: string | null
          status?: string | null
          workOrderNo?: string | null
        }
        Update: {
          clientName?: string | null
          contractValue?: number | null
          createdAt?: string | null
          departmentId?: string | null
          description?: string | null
          endDate?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          society_id?: string
          startDate?: string | null
          status?: string | null
          workOrderNo?: string | null
        }
        Relationships: []
      }
      worker_advances: {
        Row: {
          advanceNo: string | null
          amount: number | null
          createdAt: string | null
          date: string | null
          id: string
          isDeleted: boolean | null
          jurisdiction: string | null
          mode: string | null
          narration: string | null
          recovered: number | null
          society_id: string
          status: string | null
          voucherId: string | null
          workerId: string | null
        }
        Insert: {
          advanceNo?: string | null
          amount?: number | null
          createdAt?: string | null
          date?: string | null
          id: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          mode?: string | null
          narration?: string | null
          recovered?: number | null
          society_id: string
          status?: string | null
          voucherId?: string | null
          workerId?: string | null
        }
        Update: {
          advanceNo?: string | null
          amount?: number | null
          createdAt?: string | null
          date?: string | null
          id?: string
          isDeleted?: boolean | null
          jurisdiction?: string | null
          mode?: string | null
          narration?: string | null
          recovered?: number | null
          society_id?: string
          status?: string | null
          voucherId?: string | null
          workerId?: string | null
        }
        Relationships: []
      }
      workers: {
        Row: {
          aadhaar: string | null
          bankAccountNo: string | null
          category: string | null
          createdAt: string | null
          dateOfBirth: string | null
          defaultDailyWage: number | null
          esiIp: string | null
          fatherHusbandName: string | null
          gender: string | null
          id: string
          idProofNo: string | null
          idProofType: string | null
          ifsc: string | null
          isDeleted: boolean | null
          joiningDate: string | null
          jurisdiction: string | null
          memberId: string | null
          name: string | null
          pan: string | null
          permanentAddress: string | null
          phone: string | null
          society_id: string
          status: string | null
          uan: string | null
          workerCode: string | null
          workerType: string | null
        }
        Insert: {
          aadhaar?: string | null
          bankAccountNo?: string | null
          category?: string | null
          createdAt?: string | null
          dateOfBirth?: string | null
          defaultDailyWage?: number | null
          esiIp?: string | null
          fatherHusbandName?: string | null
          gender?: string | null
          id: string
          idProofNo?: string | null
          idProofType?: string | null
          ifsc?: string | null
          isDeleted?: boolean | null
          joiningDate?: string | null
          jurisdiction?: string | null
          memberId?: string | null
          name?: string | null
          pan?: string | null
          permanentAddress?: string | null
          phone?: string | null
          society_id: string
          status?: string | null
          uan?: string | null
          workerCode?: string | null
          workerType?: string | null
        }
        Update: {
          aadhaar?: string | null
          bankAccountNo?: string | null
          category?: string | null
          createdAt?: string | null
          dateOfBirth?: string | null
          defaultDailyWage?: number | null
          esiIp?: string | null
          fatherHusbandName?: string | null
          gender?: string | null
          id?: string
          idProofNo?: string | null
          idProofType?: string | null
          ifsc?: string | null
          isDeleted?: boolean | null
          joiningDate?: string | null
          jurisdiction?: string | null
          memberId?: string | null
          name?: string | null
          pan?: string | null
          permanentAddress?: string | null
          phone?: string | null
          society_id?: string
          status?: string | null
          uan?: string | null
          workerCode?: string | null
          workerType?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _cancel_voucher_core: {
        Args: {
          p_deleted_by: string
          p_id: string
          p_reason: string
          p_sid: string
        }
        Returns: Json
      }
      _fy_balances: {
        Args: { p_as_of: string; p_sid: string }
        Returns: {
          account_id: string
          net: number
        }[]
      }
      _fy_close_post: {
        Args: {
          p_by: string
          p_date: string
          p_legs: Json
          p_narration: string
          p_no: string
          p_ref: string
          p_sid: string
        }
        Returns: string
      }
      _is_system_owned_voucher: {
        Args: { p_id: string; p_ref: string }
        Returns: string
      }
      _legs_match_voucher: {
        Args: {
          p_amount: number
          p_cr: string
          p_dr: string
          p_legs: Json
          p_vlines: Json
        }
        Returns: boolean
      }
      _mfa_assert_self: {
        Args: { p_claimed: string; p_me: string }
        Returns: undefined
      }
      _mfa_caller_email: { Args: never; Returns: string }
      _mfa_enrolled: { Args: { p_email: string }; Returns: boolean }
      _mfa_mark_session: { Args: { p_email: string }; Returns: undefined }
      _mfa_note: {
        Args: { p_email: string; p_ok: boolean }
        Returns: undefined
      }
      _mfa_throttled: { Args: { p_email: string }; Returns: boolean }
      _official_doc_no: {
        Args: {
          p_column: string
          p_provisional: string
          p_sid: string
          p_table: string
        }
        Returns: string
      }
      _partner_commission_price: {
        Args: { p_invoice_id: string }
        Returns: {
          basis: string
          code: string
          commission_paise: number
          hold_until: string
          invoice_date: string
          invoice_no: string
          kind: string
          partner_id: string
          rate_pct: number
          rule_id: number
          society_id: string
          status: string
          taxable_paise: number
        }[]
      }
      _partner_commission_record: {
        Args: { p_invoice_id: string }
        Returns: boolean
      }
      _partner_from_session: { Args: { p_session: string }; Returns: string }
      _partner_fy: { Args: { p: string }; Returns: string }
      _partner_new_code: { Args: never; Returns: string }
      _partner_norm_code: { Args: { p: string }; Returns: string }
      _partner_norm_email: { Args: { p: string }; Returns: string }
      _partner_norm_phone: { Args: { p: string }; Returns: string }
      _partner_payout_calc: {
        Args: {
          p_commission_ids: number[]
          p_partner_id: string
          p_payout_date: string
        }
        Returns: Json
      }
      _restore_leg_key: { Args: { p_legs: Json }; Returns: Json }
      _restore_voucher_legs: {
        Args: { v: Database["public"]["Tables"]["vouchers"]["Row"] }
        Returns: Json
      }
      _s4_note_direct_write: {
        Args: {
          p_op: string
          p_rows: number
          p_society_id: string
          p_table: string
        }
        Returns: undefined
      }
      _voucher_flip_legs: { Args: { p_lines: Json }; Returns: Json }
      activate_order: {
        Args: {
          p_amount_paise?: number
          p_order_id: string
          p_payment_id: string
        }
        Returns: Json
      }
      admin_activate_subscription: {
        Args: { p_months?: number; p_plan: string; p_society_id: string }
        Returns: undefined
      }
      admin_commission_cancel: {
        Args: { p_id: number; p_reason: string }
        Returns: Json
      }
      admin_commission_rule_add: {
        Args: {
          p_effective_from: string
          p_first_year_pct: number
          p_hold_days: number
          p_note: string
          p_renewal_pct: number
          p_renewal_years: number
        }
        Returns: Json
      }
      admin_commission_rules_list: {
        Args: never
        Returns: {
          created_at: string
          created_by: string
          effective_from: string
          first_year_pct: number
          hold_days: number
          id: number
          note: string | null
          renewal_pct: number
          renewal_years: number
        }[]
        SetofOptions: {
          from: "*"
          to: "partner_commission_rules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_commission_sync: { Args: never; Returns: Json }
      admin_commissions_list: {
        Args: never
        Returns: {
          basis: string
          cancel_reason: string
          cancelled_at: string
          cancelled_by: string
          code: string
          commission_paise: number
          eligible: boolean
          hold_until: string
          id: number
          invoice_date: string
          invoice_no: string
          kind: string
          partner_id: string
          partner_name: string
          rate_pct: number
          society_id: string
          society_name: string
          status: string
          taxable_paise: number
        }[]
      }
      admin_detail_request_decide: {
        Args: { p_decision: string; p_id: number; p_note: string }
        Returns: Json
      }
      admin_detail_requests_list: {
        Args: never
        Returns: {
          account_name: string
          account_no: string
          created_at: string
          current_account_no: string
          current_pan: string
          current_upi_id: string
          gstin: string
          id: number
          ifsc: string
          pan: string
          pan_name: string
          partner_code: string
          partner_id: string
          partner_name: string
          upi_id: string
        }[]
      }
      admin_email_health: { Args: never; Returns: Json }
      admin_email_log: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          delivery_status: string
          last_error: string
          recipient: string
          sent_at: string
          society_id: string
          society_name: string
          status: string
          template_key: string
        }[]
      }
      admin_email_suppression: {
        Args: never
        Returns: {
          created_at: string
          detail: string | null
          email: string
          reason: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_suppression"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_feedback_list: {
        Args: { p_email: string; p_password: string }
        Returns: {
          created_at: string
          email: string | null
          id: string
          is_public: boolean
          jurisdiction: string | null
          message: string | null
          name: string | null
          page_url: string | null
          rating: number | null
          society_id: string | null
          society_name: string | null
          status: string
          type: string
          user_email: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "feedback"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_feedback_set_public: {
        Args: {
          p_email: string
          p_id: string
          p_is_public: boolean
          p_password: string
        }
        Returns: undefined
      }
      admin_feedback_set_status: {
        Args: {
          p_email: string
          p_id: string
          p_password: string
          p_status: string
        }
        Returns: undefined
      }
      admin_list_invoices: {
        Args: { p_from: string; p_to: string }
        Returns: {
          buyer_address: string | null
          buyer_gstin: string | null
          buyer_name: string
          buyer_state_code: string
          cgst_paise: number
          created_at: string
          email_error: string | null
          emailed_at: string | null
          emailed_to: string | null
          fy: string
          gst_rate_pct: number
          id: string
          igst_paise: number
          invoice_date: string
          invoice_no: string
          kind: string
          order_id: string
          payment_id: string | null
          place_of_supply: string
          plan: string
          sac: string
          seller_address: string
          seller_gstin: string
          seller_name: string
          seller_state_code: string
          seq: number
          sgst_paise: number
          society_id: string
          taxable_paise: number
          total_paise: number
        }[]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_pending_invoices: {
        Args: never
        Returns: {
          amount: number
          invoice_error: string
          invoice_tried_at: string
          is_test: boolean
          kind: string
          order_id: string
          paid_at: string
          plan: string
          society_id: string
          society_name: string
        }[]
      }
      admin_list_subscriptions: {
        Args: never
        Returns: {
          activated_by: string | null
          created_at: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          plan: string
          seats_limit: number | null
          society_id: string
          source: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_partner_decide: {
        Args: { p_id: string; p_note: string; p_status: string }
        Returns: Json
      }
      admin_partner_payment_details_get: {
        Args: { p_partner_id: string }
        Returns: Json
      }
      admin_partner_payment_details_set: {
        Args: {
          p_account_name: string
          p_account_no: string
          p_gstin: string
          p_ifsc: string
          p_pan: string
          p_pan_name: string
          p_partner_id: string
          p_upi_id: string
        }
        Returns: Json
      }
      admin_partner_rotate_token: { Args: { p_id: string }; Returns: Json }
      admin_partner_set_email: {
        Args: { p_email: string; p_id: string }
        Returns: Json
      }
      admin_partner_welcome_info: { Args: { p_id: string }; Returns: Json }
      admin_partners_list: {
        Args: never
        Returns: {
          admin_note: string
          category: string
          code: string
          created_at: string
          decided_at: string
          decided_by: string
          declaration_version: string
          district: string
          email: string
          id: string
          name: string
          note: string
          phone: string
          societies_count: number
          state: string
          status: string
          token: string
        }[]
      }
      admin_payout_preview: {
        Args: { p_partner_id: string; p_payout_date: string }
        Returns: Json
      }
      admin_payout_record: {
        Args: {
          p_commission_ids: number[]
          p_expected_net_paise: number
          p_method: string
          p_note: string
          p_partner_id: string
          p_payout_date: string
          p_utr: string
        }
        Returns: Json
      }
      admin_payouts_list: {
        Args: never
        Returns: {
          base_paise: number
          clawback_paise: number
          code: string
          commission_count: number
          created_at: string
          created_by: string
          credit_paise: number
          fy: string
          id: number
          method: string
          net_paise: number
          note: string
          pan_at_payout: string
          partner_id: string
          partner_name: string
          payout_date: string
          section_ref: string
          tds_paise: number
          tds_rate_pct: number
          utr: string
        }[]
      }
      admin_referral_events: {
        Args: { p_society_id: string }
        Returns: {
          action: string
          actor: string
          created_at: string
          id: number
          new_code: string
          new_partner_name: string
          old_code: string
          old_partner_name: string
          reason: string
          source: string
        }[]
      }
      admin_referral_set: {
        Args: { p_code: string; p_reason: string; p_society_id: string }
        Returns: Json
      }
      admin_referrals_list: {
        Args: never
        Returns: {
          attributed_at: string
          attributed_by: string
          code: string
          has_paid: boolean
          partner_id: string
          partner_name: string
          society_id: string
          society_name: string
          source: string
        }[]
      }
      admin_tds_rule_add: {
        Args: {
          p_effective_from: string
          p_fy_threshold_paise: number
          p_no_pan_rate_pct: number
          p_note: string
          p_rate_pct: number
          p_section_ref: string
          p_source_ref: string
        }
        Returns: Json
      }
      admin_tds_rules_list: {
        Args: never
        Returns: {
          created_at: string
          created_by: string
          effective_from: string
          fy_threshold_paise: number
          id: number
          no_pan_rate_pct: number
          note: string | null
          rate_pct: number
          section_ref: string
          source_ref: string
        }[]
        SetofOptions: {
          from: "*"
          to: "partner_tds_rules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_unsuppress_email: { Args: { p_email: string }; Returns: boolean }
      app_add_society_user: {
        Args: {
          p_email: string
          p_is_active?: boolean
          p_name: string
          p_password: string
          p_role: string
          p_society_id: string
        }
        Returns: string
      }
      app_mfa_admin_reset: {
        Args: { p_admin_email: string; p_target_email: string }
        Returns: boolean
      }
      app_mfa_disable: {
        Args: { p_code: string; p_email: string }
        Returns: boolean
      }
      app_mfa_enroll: {
        Args: { p_code: string; p_email: string; p_secret: string }
        Returns: boolean
      }
      app_mfa_gen_recovery: {
        Args: { p_code: string; p_email: string }
        Returns: string[]
      }
      app_register_admin: {
        Args: {
          p_email: string
          p_name: string
          p_password: string
          p_society_id: string
        }
        Returns: string
      }
      app_reset_society_user_password: {
        Args: { p_password: string; p_su_id: string }
        Returns: boolean
      }
      app_set_my_password: { Args: { p_password: string }; Returns: boolean }
      app_totp_matches: {
        Args: {
          p_at: number
          p_code: string
          p_secret: string
          p_window?: number
        }
        Returns: boolean
      }
      app_update_society_user_email: {
        Args: { p_new_email: string; p_su_id: string }
        Returns: string
      }
      app_verify_mfa: {
        Args: { p_code: string; p_email: string }
        Returns: boolean
      }
      app_verify_recovery: {
        Args: { p_code: string; p_email: string }
        Returns: boolean
      }
      approve_voucher: {
        Args: { p_approved_by?: string; p_id: string; p_lines: Json }
        Returns: Json
      }
      assign_missing_account_codes: {
        Args: { p_apply?: boolean; p_society_id?: string }
        Returns: {
          account_id: string
          new_code: string
          soc: string
        }[]
      }
      attach_referral_at_signup: {
        Args: { p_code: string; p_society_id: string; p_source: string }
        Returns: Json
      }
      backup_staleness: {
        Args: { p_days?: number }
        Returns: {
          last_backup_at: string
          live_vouchers: number
          society_id: string
        }[]
      }
      base32_decode: { Args: { p_in: string }; Returns: string }
      cancel_stock_document: {
        Args: { p_by?: string; p_id: string; p_kind: string; p_reason?: string }
        Returns: Json
      }
      cancel_voucher: {
        Args: { p_deleted_by?: string; p_id: string; p_reason?: string }
        Returns: Json
      }
      claim_email_health_alert: { Args: { p_site?: Json }; Returns: Json }
      claim_outbox: {
        Args: { p_daily_cap?: number; p_limit?: number }
        Returns: {
          attempts: number
          channel: string
          created_at: string
          delivery_event_at: string | null
          delivery_status: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          locale: string
          locked_until: string | null
          payload: Json
          provider_message_id: string | null
          recipient: string
          scheduled_at: string
          sent_at: string | null
          society_id: string | null
          status: string
          template_key: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      close_financial_year: {
        Args: {
          p_authority: string
          p_closing_stock_minor?: number
          p_fy_label: string
        }
        Returns: Json
      }
      complete_outbox: {
        Args: {
          p_error?: string
          p_id: string
          p_ok: boolean
          p_provider_id?: string
          p_retryable?: boolean
        }
        Returns: string
      }
      compliance_reminder_targets: {
        Args: never
        Returns: {
          filed_ids: string[]
          gstin: boolean
          has_employees: boolean
          society_id: string
          society_name: string
          state: string
          tan: boolean
        }[]
      }
      confirm_email_verification: { Args: { p_token: string }; Returns: Json }
      current_user_society_ids: { Args: never; Returns: string[] }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      edit_voucher: {
        Args: { p_lines: Json; p_producer?: string; p_voucher: Json }
        Returns: Json
      }
      email_health: { Args: never; Returns: Json }
      email_unsubscribe_token: { Args: { p_email: string }; Returns: string }
      enqueue_compliance_due: {
        Args: {
          p_day: string
          p_items: Json
          p_pending_count?: number
          p_society_id: string
        }
        Returns: number
      }
      enqueue_notification: {
        Args: {
          p_idempotency_key: string
          p_locale?: string
          p_payload: Json
          p_recipient: string
          p_scheduled_at?: string
          p_society_id: string
          p_template_key: string
        }
        Returns: string
      }
      enqueue_weekly_digest: {
        Args: { p_compliance_due: number; p_day: string; p_society_id: string }
        Returns: number
      }
      get_all_societies: {
        Args: never
        Returns: {
          created_at: string
          district: string
          id: string
          is_locked: boolean
          name: string
          plan: string
          plan_expires_at: string
          registration_no: string
          society_type: string
          state: string
          subscription_notes: string
          trial_ends_at: string
        }[]
      }
      get_current_society_id: { Args: never; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      get_error_log: {
        Args: { p_limit?: number }
        Returns: {
          actor_name: string
          created_at: string
          id: string
          message: string
          society_id: string
          source: string
          url: string
        }[]
      }
      get_society_user_counts: {
        Args: never
        Returns: {
          society_id: string
          user_count: number
        }[]
      }
      increment_blog_view: { Args: { p_slug: string }; Returns: number }
      is_platform_admin: { Args: never; Returns: boolean }
      is_society_admin: { Args: { p_society_id: string }; Returns: boolean }
      is_society_user_manager: {
        Args: { p_society_id: string }
        Returns: boolean
      }
      issue_certificate: {
        Args: {
          p_cert_no: string
          p_email: string
          p_holder_name: string
          p_parts_passed: number
          p_society_name: string
        }
        Returns: undefined
      }
      issue_invoice: {
        Args: { p_calc: Json; p_order_id: string }
        Returns: Json
      }
      jwt_branch_id: { Args: never; Returns: string }
      jwt_branch_is_head_office: { Args: never; Returns: boolean }
      jwt_branch_ok: { Args: { row_branch: string }; Returns: boolean }
      jwt_can_delete: { Args: never; Returns: boolean }
      jwt_can_read_party_pii: {
        Args: { p_entity_type: string }
        Returns: boolean
      }
      jwt_can_read_pii: { Args: never; Returns: boolean }
      jwt_can_write: { Args: never; Returns: boolean }
      jwt_can_write_members: { Args: never; Returns: boolean }
      jwt_mfa_pending: { Args: never; Returns: boolean }
      ledger_drift: {
        Args: { p_sid?: string }
        Returns: {
          entries_abs_minor: number
          entries_accounts: number
          journal_abs_minor: number
          journal_accounts: number
          society_id: string
        }[]
      }
      link_voucher_reversal: {
        Args: { p_original_id: string; p_reversal_id: string }
        Returns: Json
      }
      log_backup_staleness: { Args: never; Returns: number }
      log_ledger_drift: { Args: never; Returns: number }
      member_portal_end_sessions: {
        Args: { p_user: string }
        Returns: undefined
      }
      member_portal_login_begin: { Args: { p_key: string }; Returns: Json }
      member_portal_login_success: {
        Args: { p_key: string }
        Returns: undefined
      }
      member_portal_own_photo_path: { Args: never; Returns: string }
      member_portal_snapshot: { Args: never; Returns: Json }
      merge_accounts: {
        Args: { p_by?: string; p_keep: string; p_remove: string }
        Returns: Json
      }
      my_email_preferences: { Args: never; Returns: Json }
      my_email_verification: { Args: never; Returns: Json }
      next_document_number: {
        Args: { p_book: string; p_fy: string; p_society_id: string }
        Returns: number
      }
      notify_society_name: { Args: { p_society_id: string }; Returns: string }
      parent_group_plan: {
        Args: never
        Returns: {
          add_child: boolean
          eligible: boolean
          head_id: string
          reason: string
          society_id: string
        }[]
      }
      partner_apply: {
        Args: {
          p_category: string
          p_declared_not_proxy: boolean
          p_declared_not_public_servant: boolean
          p_district: string
          p_email: string
          p_name: string
          p_note: string
          p_phone: string
          p_state: string
        }
        Returns: Json
      }
      partner_commissions: { Args: { p_token: string }; Returns: Json }
      partner_dashboard: { Args: { p_token: string }; Returns: Json }
      partner_details_request: {
        Args: {
          p_account_name: string
          p_account_no: string
          p_gstin: string
          p_ifsc: string
          p_pan: string
          p_pan_name: string
          p_session: string
          p_upi_id: string
        }
        Returns: Json
      }
      partner_login_issue: { Args: { p_email: string }; Returns: Json }
      partner_login_verify: {
        Args: { p_code: string; p_email: string }
        Returns: Json
      }
      partner_logout: { Args: { p_session: string }; Returns: Json }
      partner_payouts: { Args: { p_token: string }; Returns: Json }
      partner_portal: { Args: { p_session: string }; Returns: Json }
      partner_status: { Args: { p_token: string }; Returns: Json }
      pay_list_runs: {
        Args: never
        Returns: {
          created_at: string
          currency: string
          payslip_count: number
          period: string
          period_month: string
          run_id: string
          run_no: string
          state: string
          total_net_minor: number
        }[]
      }
      pay_payslip_lines: {
        Args: { p_payslip_id: string }
        Returns: {
          code: string
          computed_minor: number
          currency: string
          kind: string
          name: Json
          seq: number
        }[]
      }
      pay_run_payslips: {
        Args: { p_run_id: string }
        Returns: {
          currency: string
          deductions_minor: number
          employee_code: string
          employee_name: Json
          gross_minor: number
          lop_days: number
          net_minor: number
          paid_days: number
          payslip_id: string
          payslip_no: string
          status: string
        }[]
      }
      plan_allows: {
        Args: { p_feature: string; p_society_id: string }
        Returns: boolean
      }
      platform_admin_identity: { Args: never; Returns: boolean }
      platform_admin_mfa_disable: { Args: { p_code: string }; Returns: boolean }
      platform_admin_mfa_enroll: {
        Args: { p_code: string; p_secret: string }
        Returns: boolean
      }
      platform_admin_mfa_gen_recovery: {
        Args: { p_code: string }
        Returns: string[]
      }
      platform_admin_mfa_status: { Args: never; Returns: boolean }
      platform_admin_mfa_verify: { Args: { p_code: string }; Returns: boolean }
      platform_admin_verify_recovery: {
        Args: { p_code: string }
        Returns: boolean
      }
      post_stock_document: {
        Args: {
          p_doc: Json
          p_event: Json
          p_kind: string
          p_lines: Json
          p_movements: Json
          p_voucher: Json
        }
        Returns: Json
      }
      post_voucher: {
        Args: { p_event: Json; p_lines: Json; p_voucher: Json }
        Returns: Json
      }
      posting_service_on: { Args: { p_society_id: string }; Returns: boolean }
      procurement_commit_transaction: {
        Args: { p_payload: Json }
        Returns: Json
      }
      public_reviews: {
        Args: never
        Returns: {
          created_at: string
          id: string
          message: string
          name: string
          rating: number
        }[]
      }
      record_email_event: {
        Args: {
          p_detail?: string
          p_provider_id: string
          p_recipients: string[]
          p_type: string
        }
        Returns: Json
      }
      referral_code_check: { Args: { p_code: string }; Returns: boolean }
      refresh_subscription_status: { Args: never; Returns: number }
      register_society: {
        Args: {
          p_accounts: Json
          p_email: string
          p_name: string
          p_password: string
          p_settings: Json
          p_society: Json
          p_society_id: string
        }
        Returns: Json
      }
      reject_voucher: {
        Args: { p_id: string; p_reason: string; p_rejected_by?: string }
        Returns: Json
      }
      request_email_verification: { Args: { p_locale?: string }; Returns: Json }
      restore_commit: {
        Args: {
          p_chunks: number
          p_manifest_hash: string
          p_mode: string
          p_revived?: Json
          p_run: string
        }
        Returns: Json
      }
      restore_stage: {
        Args: { p_ops: Json; p_run: string; p_seq: number }
        Returns: Json
      }
      save_pending_voucher: {
        Args: { p_lines: Json; p_voucher: Json }
        Returns: Json
      }
      set_my_email_locale: { Args: { p_locale: string }; Returns: Json }
      set_my_weekly_digest: { Args: { p_on: boolean }; Returns: Json }
      set_voucher_cleared: {
        Args: { p_cleared: boolean; p_cleared_date?: string; p_id: string }
        Returns: Json
      }
      society_email_log: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          delivery_status: string
          last_error: string
          recipient: string
          sent_at: string
          status: string
          template_key: string
        }[]
      }
      society_empty_tables: {
        Args: { p_society_id: string; p_tables: string[] }
        Returns: string[]
      }
      society_has_users: { Args: { p_society_id: string }; Returns: boolean }
      subscription_writable: { Args: { p_sid: string }; Returns: boolean }
      sync_account_opening_event: {
        Args: { p_account_id: string; p_target_minor?: number }
        Returns: Json
      }
      unsubscribe_by_token: { Args: { p_token: string }; Returns: Json }
      update_society_subscription: {
        Args: {
          p_is_locked: boolean
          p_notes: string
          p_plan: string
          p_plan_expires_at: string
          p_society_id: string
        }
        Returns: undefined
      }
      update_stock_document: {
        Args: {
          p_by?: string
          p_doc: Json
          p_event: Json
          p_id: string
          p_kind: string
          p_lines: Json
          p_movements: Json
          p_reason?: string
          p_voucher: Json
        }
        Returns: Json
      }
      verify_certificate: {
        Args: { p_cert_no: string; p_name: string }
        Returns: {
          holder_name: string
          issued_at: string
        }[]
      }
      voucher_edit_capabilities: { Args: never; Returns: Json }
      weekly_digest_counts: {
        Args: { p_day: string; p_society_id: string }
        Returns: Json
      }
      weekly_digest_targets: {
        Args: { p_day: string }
        Returns: {
          counts: Json
          filed_ids: string[]
          gstin: boolean
          has_employees: boolean
          society_id: string
          state: string
          tan: boolean
        }[]
      }
      withdraw_voucher: {
        Args: { p_deleted_by?: string; p_id: string; p_reason?: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

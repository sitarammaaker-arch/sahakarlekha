import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider, useData } from "@/contexts/DataContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Pages — lazy-loaded so each route ships as its own chunk (keeps the initial
// bundle small; heavy libs like jsPDF/html2canvas/recharts/xlsx load on demand).
const LandingPage = lazy(() => import("./pages/LandingPage"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const FAQ = lazy(() => import("./pages/FAQ"));
const UserGuide = lazy(() => import("./pages/UserGuide"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CashBook = lazy(() => import("./pages/CashBook"));
const BankBook = lazy(() => import("./pages/BankBook"));
const Vouchers = lazy(() => import("./pages/Vouchers"));
const Ledger = lazy(() => import("./pages/Ledger"));
const Members = lazy(() => import("./pages/Members"));
const MemberApplication = lazy(() => import("./pages/MemberApplication"));
const TrialBalance = lazy(() => import("./pages/TrialBalance"));
const ProfitLoss = lazy(() => import("./pages/ProfitLoss"));
const TradingAccount = lazy(() => import("./pages/TradingAccount"));
const ReceiptsPayments = lazy(() => import("./pages/ReceiptsPayments"));
const BalanceSheet = lazy(() => import("./pages/BalanceSheet"));
const Reports = lazy(() => import("./pages/Reports"));
const SocietySetup = lazy(() => import("./pages/SocietySetup"));
const ShareRegister = lazy(() => import("./pages/ShareRegister"));
const LoanRegister = lazy(() => import("./pages/LoanRegister"));
const AssetRegister = lazy(() => import("./pages/AssetRegister"));
const DepreciationSchedule = lazy(() => import("./pages/DepreciationSchedule"));
const AuditRegister = lazy(() => import("./pages/AuditRegister"));
const DayBook = lazy(() => import("./pages/DayBook"));
const LedgerHeads = lazy(() => import("./pages/LedgerHeads"));
const Inventory = lazy(() => import("./pages/Inventory"));
const SaleManagement = lazy(() => import("./pages/SaleManagement"));
const SaleRegister = lazy(() => import("./pages/SaleRegister"));
const PurchaseManagement = lazy(() => import("./pages/PurchaseManagement"));
const PurchaseRegister = lazy(() => import("./pages/PurchaseRegister"));
const SalaryManagement = lazy(() => import("./pages/SalaryManagement"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Customers = lazy(() => import("./pages/Customers"));
const DeletedVouchers = lazy(() => import("./pages/DeletedVouchers"));
const BankReconciliation = lazy(() => import("./pages/BankReconciliation"));
const ReserveFund = lazy(() => import("./pages/ReserveFund"));
const ProfitDistribution = lazy(() => import("./pages/ProfitDistribution"));
const LoanInterest = lazy(() => import("./pages/LoanInterest"));
const CompoundVoucher = lazy(() => import("./pages/CompoundVoucher"));
const VoucherApproval = lazy(() => import("./pages/VoucherApproval"));
const MeetingRegister = lazy(() => import("./pages/MeetingRegister"));
const NominationRegister = lazy(() => import("./pages/NominationRegister"));
const Form1MemberList = lazy(() => import("./pages/Form1MemberList"));
const AuditCertificate = lazy(() => import("./pages/AuditCertificate"));
const BackupRestore = lazy(() => import("./pages/BackupRestore"));
const GstSummary = lazy(() => import("./pages/GstSummary"));
const AgingAnalysis = lazy(() => import("./pages/AgingAnalysis"));
const StockValuation = lazy(() => import("./pages/StockValuation"));
const ClosingStockReport = lazy(() => import("./pages/ClosingStockReport"));
const BudgetModule = lazy(() => import("./pages/BudgetModule"));
const TdsForm16A = lazy(() => import("./pages/TdsForm16A"));
const TdsRegister = lazy(() => import("./pages/TdsRegister"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const EWayBill = lazy(() => import("./pages/EWayBill"));
const HsnMaster = lazy(() => import("./pages/HsnMaster"));
const KccLoan = lazy(() => import("./pages/KccLoan"));
const ElectionModule = lazy(() => import("./pages/ElectionModule"));
const BoardOfDirectors = lazy(() => import("./pages/BoardOfDirectors"));
const OpeningBalances = lazy(() => import("./pages/OpeningBalances"));
const Register = lazy(() => import("./pages/Register"));
const MultiSocietyConsolidation = lazy(() => import("./pages/MultiSocietyConsolidation"));
const NabardReport = lazy(() => import("./pages/NabardReport"));
const FederationReport = lazy(() => import("./pages/FederationReport"));
const RecoverablesRegister = lazy(() => import("./pages/RecoverablesRegister"));
const KachiAaratRegister = lazy(() => import("./pages/KachiAaratRegister"));
const AuditSchedules = lazy(() => import("./pages/AuditSchedules"));
const UniversalImporter = lazy(() => import("./pages/UniversalImporter"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsConditions = lazy(() => import("./pages/TermsConditions"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
import { SuperAdminRoute } from "@/components/SuperAdminRoute";

import { preloadHindiFont } from '@/lib/fontLoader';

const queryClient = new QueryClient();

// Start loading Hindi font in background so it's ready when user generates a PDF
preloadHindiFont();

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { isLoading } = useData();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">डेटा लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  return <MainLayout><ErrorBoundary>{children}</ErrorBoundary></MainLayout>;
};

// Public Route wrapper (redirects to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Lightweight fallback shown while a route chunk is being fetched.
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/contact" element={<ContactUs />} />
      <Route path="/about" element={<AboutUs />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsConditions />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/guide" element={<UserGuide />} />
      <Route path="/help" element={<UserGuide />} />
      <Route path="/pricing" element={<Pricing />} />

      {/* Protected Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/cash-book" element={<ProtectedRoute><CashBook /></ProtectedRoute>} />
      <Route path="/bank-book" element={<ProtectedRoute><BankBook /></ProtectedRoute>} />
      <Route path="/vouchers" element={<ProtectedRoute><Vouchers /></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute><Ledger /></ProtectedRoute>} />
      <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
      <Route path="/member-application" element={<ProtectedRoute><MemberApplication /></ProtectedRoute>} />
      <Route path="/trial-balance" element={<ProtectedRoute><TrialBalance /></ProtectedRoute>} />
      <Route path="/trading-account" element={<ProtectedRoute><TradingAccount /></ProtectedRoute>} />
      <Route path="/profit-loss" element={<ProtectedRoute><ProfitLoss /></ProtectedRoute>} />
      <Route path="/receipts-payments" element={<ProtectedRoute><ReceiptsPayments /></ProtectedRoute>} />
      <Route path="/balance-sheet" element={<ProtectedRoute><BalanceSheet /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/society-setup" element={<ProtectedRoute><SocietySetup /></ProtectedRoute>} />
      <Route path="/share-register" element={<ProtectedRoute><ShareRegister /></ProtectedRoute>} />
      <Route path="/loan-register" element={<ProtectedRoute><LoanRegister /></ProtectedRoute>} />
      <Route path="/asset-register" element={<ProtectedRoute><AssetRegister /></ProtectedRoute>} />
      <Route path="/depreciation-schedule" element={<ProtectedRoute><DepreciationSchedule /></ProtectedRoute>} />
      <Route path="/audit-register" element={<ProtectedRoute><AuditRegister /></ProtectedRoute>} />
      <Route path="/day-book" element={<ProtectedRoute><DayBook /></ProtectedRoute>} />
      <Route path="/ledger-heads" element={<ProtectedRoute><LedgerHeads /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><SaleManagement /></ProtectedRoute>} />
      <Route path="/sale-register" element={<ProtectedRoute><SaleRegister /></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute><PurchaseManagement /></ProtectedRoute>} />
      <Route path="/purchase-register" element={<ProtectedRoute><PurchaseRegister /></ProtectedRoute>} />
      <Route path="/salary" element={<ProtectedRoute><SalaryManagement /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/deleted-vouchers" element={<ProtectedRoute><DeletedVouchers /></ProtectedRoute>} />
      <Route path="/bank-reconciliation" element={<ProtectedRoute><BankReconciliation /></ProtectedRoute>} />
      <Route path="/reserve-fund" element={<ProtectedRoute><ReserveFund /></ProtectedRoute>} />
      <Route path="/profit-distribution" element={<ProtectedRoute><ProfitDistribution /></ProtectedRoute>} />
      <Route path="/loan-interest" element={<ProtectedRoute><LoanInterest /></ProtectedRoute>} />
      <Route path="/compound-voucher" element={<ProtectedRoute><CompoundVoucher /></ProtectedRoute>} />
      <Route path="/voucher-approval" element={<ProtectedRoute><VoucherApproval /></ProtectedRoute>} />
      <Route path="/meeting-register" element={<ProtectedRoute><MeetingRegister /></ProtectedRoute>} />
      <Route path="/nomination-register" element={<ProtectedRoute><NominationRegister /></ProtectedRoute>} />
      <Route path="/form1-member-list" element={<ProtectedRoute><Form1MemberList /></ProtectedRoute>} />
      <Route path="/audit-certificate" element={<ProtectedRoute><AuditCertificate /></ProtectedRoute>} />
      <Route path="/audit-schedules" element={<ProtectedRoute><AuditSchedules /></ProtectedRoute>} />
      <Route path="/backup-restore" element={<ProtectedRoute><BackupRestore /></ProtectedRoute>} />
      <Route path="/gst-summary" element={<ProtectedRoute><GstSummary /></ProtectedRoute>} />
      <Route path="/hsn-master" element={<ProtectedRoute><HsnMaster /></ProtectedRoute>} />
      <Route path="/aging-analysis" element={<ProtectedRoute><AgingAnalysis /></ProtectedRoute>} />
      <Route path="/stock-valuation" element={<ProtectedRoute><StockValuation /></ProtectedRoute>} />
      <Route path="/closing-stock-report" element={<ProtectedRoute><ClosingStockReport /></ProtectedRoute>} />
      <Route path="/budget-module" element={<ProtectedRoute><BudgetModule /></ProtectedRoute>} />
      <Route path="/tds-form16a" element={<ProtectedRoute><TdsForm16A /></ProtectedRoute>} />
      <Route path="/tds-register" element={<ProtectedRoute><TdsRegister /></ProtectedRoute>} />
      <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/eway-bill" element={<ProtectedRoute><EWayBill /></ProtectedRoute>} />
      <Route path="/kcc-loan" element={<ProtectedRoute><KccLoan /></ProtectedRoute>} />
      <Route path="/election-module" element={<ProtectedRoute><ElectionModule /></ProtectedRoute>} />
      <Route path="/board-of-directors" element={<ProtectedRoute><BoardOfDirectors /></ProtectedRoute>} />
      <Route path="/opening-balances" element={<ProtectedRoute><OpeningBalances /></ProtectedRoute>} />
      <Route path="/multi-society-consolidation" element={<ProtectedRoute><MultiSocietyConsolidation /></ProtectedRoute>} />
      <Route path="/nabard-report" element={<ProtectedRoute><NabardReport /></ProtectedRoute>} />
      <Route path="/federation-report" element={<ProtectedRoute><FederationReport /></ProtectedRoute>} />
      <Route path="/recoverables" element={<ProtectedRoute><RecoverablesRegister /></ProtectedRoute>} />
      <Route path="/kachi-aarat" element={<ProtectedRoute><KachiAaratRegister /></ProtectedRoute>} />
      <Route path="/universal-importer" element={<ProtectedRoute><UniversalImporter /></ProtectedRoute>} />

      {/* Super Admin (Platform Owner) */}
      <Route path="/super-admin" element={<SuperAdminRoute><MainLayout><SuperAdminDashboard /></MainLayout></SuperAdminRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <DataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
        </DataProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

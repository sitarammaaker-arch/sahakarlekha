import { lazy, Suspense, ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider, useData } from "@/contexts/DataContext";
import { LabourProvider } from "@/contexts/LabourDataContext";
import { HousingProvider } from "@/contexts/HousingDataContext";
import { DairyProvider } from "@/contexts/DairyDataContext";
import { MarketingProvider } from "@/contexts/MarketingDataContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { CapabilityGuard } from "@/components/CapabilityGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { usePageTracking } from "@/lib/analytics";

// Auto-recover from stale-chunk errors after a new deploy. When the app has stayed
// open across a deploy, an old hashed chunk filename can 404 on the CDN and the
// dynamic import() rejects → blank screen until a manual refresh. Here we reload the
// page ONCE (sessionStorage-guarded against loops) to fetch the fresh index.html +
// chunk map, so the user never has to refresh by hand. The flag resets on the next
// successful chunk load, so a later deploy can recover the same way.
function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    const KEY = 'sl_chunk_reloaded';
    try {
      const mod = await factory();
      sessionStorage.removeItem(KEY);
      return mod;
    } catch (err) {
      if (sessionStorage.getItem(KEY) !== '1') {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // hold the fallback until reload
      }
      throw err; // already retried once — let the ErrorBoundary show a message
    }
  });
}

// Pages — lazy-loaded so each route ships as its own chunk (keeps the initial
// bundle small; heavy libs like jsPDF/html2canvas/recharts/xlsx load on demand).
const LandingPage = lazyWithRetry(() => import("./pages/LandingPage"));
const ContactUs = lazyWithRetry(() => import("./pages/ContactUs"));
const AboutUs = lazyWithRetry(() => import("./pages/AboutUs"));
const FAQ = lazyWithRetry(() => import("./pages/FAQ"));
const UserGuide = lazyWithRetry(() => import("./pages/UserGuide"));
const GuideHub = lazyWithRetry(() => import("./pages/GuideHub"));
const GuideChapter = lazyWithRetry(() => import("./pages/GuideChapter"));
const HelpHub = lazyWithRetry(() => import("./pages/HelpHub"));
const HelpArticle = lazyWithRetry(() => import("./pages/HelpArticle"));
const CookbookHub = lazyWithRetry(() => import("./pages/CookbookHub"));
const CookbookEntry = lazyWithRetry(() => import("./pages/CookbookEntry"));
const SiteSearch = lazyWithRetry(() => import("./pages/SiteSearch"));
const AskAssistant = lazyWithRetry(() => import("./pages/AskAssistant"));
const GuideQuizPage = lazyWithRetry(() => import("./pages/GuideQuizPage"));
const GuideCertificate = lazyWithRetry(() => import("./pages/GuideCertificate"));
const GuideVerify = lazyWithRetry(() => import("./pages/GuideVerify"));
const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const SoftwareLanding = lazyWithRetry(() => import("./pages/SoftwareLanding"));
const StateLanding = lazyWithRetry(() => import("./pages/StateLanding"));
const BlogIndex = lazyWithRetry(() => import("./pages/BlogIndex"));
const BlogPost = lazyWithRetry(() => import("./pages/BlogPost"));
const Glossary = lazyWithRetry(() => import("./pages/Glossary"));
const GlossaryTerm = lazyWithRetry(() => import("./pages/GlossaryTerm"));
const CalculatorHub = lazyWithRetry(() => import("./pages/CalculatorHub"));
const CalculatorPage = lazyWithRetry(() => import("./pages/CalculatorPage"));
const Login = lazyWithRetry(() => import("./pages/Login"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const CashBook = lazyWithRetry(() => import("./pages/CashBook"));
const BankBook = lazyWithRetry(() => import("./pages/BankBook"));
const Vouchers = lazyWithRetry(() => import("./pages/Vouchers"));
const Ledger = lazyWithRetry(() => import("./pages/Ledger"));
const Members = lazyWithRetry(() => import("./pages/Members"));
const MemberApplication = lazyWithRetry(() => import("./pages/MemberApplication"));
const TrialBalance = lazyWithRetry(() => import("./pages/TrialBalance"));
const BillsOutstanding = lazyWithRetry(() => import("./pages/BillsOutstanding"));
const ProfitLoss = lazyWithRetry(() => import("./pages/ProfitLoss"));
const TradingAccount = lazyWithRetry(() => import("./pages/TradingAccount"));
const ReceiptsPayments = lazyWithRetry(() => import("./pages/ReceiptsPayments"));
const BalanceSheet = lazyWithRetry(() => import("./pages/BalanceSheet"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const SocietySetup = lazyWithRetry(() => import("./pages/SocietySetup"));
const ShareRegister = lazyWithRetry(() => import("./pages/ShareRegister"));
const LoanRegister = lazyWithRetry(() => import("./pages/LoanRegister"));
const MilkCollection = lazyWithRetry(() => import("./pages/MilkCollection"));
const AssetRegister = lazyWithRetry(() => import("./pages/AssetRegister"));
const DepreciationSchedule = lazyWithRetry(() => import("./pages/DepreciationSchedule"));
const AuditRegister = lazyWithRetry(() => import("./pages/AuditRegister"));
const DayBook = lazyWithRetry(() => import("./pages/DayBook"));
const LedgerHeads = lazyWithRetry(() => import("./pages/LedgerHeads"));
const Inventory = lazyWithRetry(() => import("./pages/Inventory"));
const SaleManagement = lazyWithRetry(() => import("./pages/SaleManagement"));
const ReceivePayment = lazyWithRetry(() => import("./pages/ReceivePayment"));
const SaleRegister = lazyWithRetry(() => import("./pages/SaleRegister"));
const PurchaseManagement = lazyWithRetry(() => import("./pages/PurchaseManagement"));
const MakePayment = lazyWithRetry(() => import("./pages/MakePayment"));
const PurchaseRegister = lazyWithRetry(() => import("./pages/PurchaseRegister"));
const SalaryManagement = lazyWithRetry(() => import("./pages/SalaryManagement"));
const Suppliers = lazyWithRetry(() => import("./pages/Suppliers"));
const Customers = lazyWithRetry(() => import("./pages/Customers"));
const DeletedVouchers = lazyWithRetry(() => import("./pages/DeletedVouchers"));
const BankReconciliation = lazyWithRetry(() => import("./pages/BankReconciliation"));
const ReserveFund = lazyWithRetry(() => import("./pages/ReserveFund"));
const ProfitDistribution = lazyWithRetry(() => import("./pages/ProfitDistribution"));
const LoanInterest = lazyWithRetry(() => import("./pages/LoanInterest"));
const CompoundVoucher = lazyWithRetry(() => import("./pages/CompoundVoucher"));
const VoucherApproval = lazyWithRetry(() => import("./pages/VoucherApproval"));
const MeetingRegister = lazyWithRetry(() => import("./pages/MeetingRegister"));
const NominationRegister = lazyWithRetry(() => import("./pages/NominationRegister"));
const Form1MemberList = lazyWithRetry(() => import("./pages/Form1MemberList"));
const AuditCertificate = lazyWithRetry(() => import("./pages/AuditCertificate"));
const BackupRestore = lazyWithRetry(() => import("./pages/BackupRestore"));
const GstSummary = lazyWithRetry(() => import("./pages/GstSummary"));
const AgingAnalysis = lazyWithRetry(() => import("./pages/AgingAnalysis"));
const StockValuation = lazyWithRetry(() => import("./pages/StockValuation"));
const ClosingStockReport = lazyWithRetry(() => import("./pages/ClosingStockReport"));
const BudgetModule = lazyWithRetry(() => import("./pages/BudgetModule"));
const TdsForm16A = lazyWithRetry(() => import("./pages/TdsForm16A"));
const TdsRegister = lazyWithRetry(() => import("./pages/TdsRegister"));
const UserManagement = lazyWithRetry(() => import("./pages/UserManagement"));
const Features = lazyWithRetry(() => import("./pages/Features"));
const ProcurementLots = lazyWithRetry(() => import("./pages/ProcurementLots"));
const ProcurementMasters = lazyWithRetry(() => import("./pages/marketing/ProcurementMasters"));
const AgencyReceipts = lazyWithRetry(() => import("./pages/marketing/AgencyReceipts"));
const ProcurementRegisters = lazyWithRetry(() => import("./pages/marketing/ProcurementRegisters"));
const FlatsRegister = lazyWithRetry(() => import("./pages/FlatsRegister"));
const MaintenanceBilling = lazyWithRetry(() => import("./pages/MaintenanceBilling"));
const ChargeHeads = lazyWithRetry(() => import("./pages/ChargeHeads"));
const MemberStatement = lazyWithRetry(() => import("./pages/MemberStatement"));
const FundStatement = lazyWithRetry(() => import("./pages/FundStatement"));
const OutstandingRegister = lazyWithRetry(() => import("./pages/OutstandingRegister"));
const Complaints = lazyWithRetry(() => import("./pages/Complaints"));
const Parking = lazyWithRetry(() => import("./pages/Parking"));
const TransferRegister = lazyWithRetry(() => import("./pages/TransferRegister"));
const ShareNominationRegister = lazyWithRetry(() => import("./pages/ShareNominationRegister"));
const Insurance = lazyWithRetry(() => import("./pages/Insurance"));
const Amc = lazyWithRetry(() => import("./pages/Amc"));
const LegalDocuments = lazyWithRetry(() => import("./pages/LegalDocuments"));
const Buildings = lazyWithRetry(() => import("./pages/Buildings"));
const RateCharts = lazyWithRetry(() => import("./pages/dairy/RateCharts"));
const FarmerSettlement = lazyWithRetry(() => import("./pages/dairy/FarmerSettlement"));
const DairyRegisters = lazyWithRetry(() => import("./pages/dairy/DairyRegisters"));
const MilkDispatch = lazyWithRetry(() => import("./pages/dairy/MilkDispatch"));
const DairyInputs = lazyWithRetry(() => import("./pages/dairy/DairyInputs"));
const DairyDistribution = lazyWithRetry(() => import("./pages/dairy/DairyDistribution"));
const WorkOrders = lazyWithRetry(() => import("./pages/WorkOrders"));
const MusterRoll = lazyWithRetry(() => import("./pages/MusterRoll"));
const WorkerMaster = lazyWithRetry(() => import("./pages/WorkerMaster"));
const DepartmentMaster = lazyWithRetry(() => import("./pages/DepartmentMaster"));
const DepartmentBills = lazyWithRetry(() => import("./pages/DepartmentBills"));
const WorkerAdvances = lazyWithRetry(() => import("./pages/WorkerAdvances"));
const WorkOrderProfit = lazyWithRetry(() => import("./pages/WorkOrderProfit"));
const WageRegister = lazyWithRetry(() => import("./pages/WageRegister"));
const WorkerLedger = lazyWithRetry(() => import("./pages/WorkerLedger"));
const AdvanceRegister = lazyWithRetry(() => import("./pages/AdvanceRegister"));
const PfEsi = lazyWithRetry(() => import("./pages/PfEsi"));
const WageSlip = lazyWithRetry(() => import("./pages/WageSlip"));
const EWayBill = lazyWithRetry(() => import("./pages/EWayBill"));
const HsnMaster = lazyWithRetry(() => import("./pages/HsnMaster"));
const KccLoan = lazyWithRetry(() => import("./pages/KccLoan"));
const ElectionModule = lazyWithRetry(() => import("./pages/ElectionModule"));
const BoardOfDirectors = lazyWithRetry(() => import("./pages/BoardOfDirectors"));
const OpeningBalances = lazyWithRetry(() => import("./pages/OpeningBalances"));
const Register = lazyWithRetry(() => import("./pages/Register"));
const MultiSocietyConsolidation = lazyWithRetry(() => import("./pages/MultiSocietyConsolidation"));
const NabardReport = lazyWithRetry(() => import("./pages/NabardReport"));
const FederationReport = lazyWithRetry(() => import("./pages/FederationReport"));
const RecoverablesRegister = lazyWithRetry(() => import("./pages/RecoverablesRegister"));
const KachiAaratRegister = lazyWithRetry(() => import("./pages/KachiAaratRegister"));
const AuditSchedules = lazyWithRetry(() => import("./pages/AuditSchedules"));
const UniversalImporter = lazyWithRetry(() => import("./pages/UniversalImporter"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const TermsConditions = lazyWithRetry(() => import("./pages/TermsConditions"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const SuperAdminDashboard = lazyWithRetry(() => import("./pages/SuperAdminDashboard"));
const SuperAdminFeedback = lazyWithRetry(() => import("./pages/SuperAdminFeedback"));
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

  return <MainLayout><CapabilityGuard><ErrorBoundary>{children}</ErrorBoundary></CapabilityGuard></MainLayout>;
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
  usePageTracking();
  return (
    <ErrorBoundary>
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
      <Route path="/guide" element={<GuideHub />} />
      <Route path="/guide/quick-start" element={<UserGuide />} />
      <Route path="/guide/certificate" element={<GuideCertificate />} />
      <Route path="/guide/verify" element={<GuideVerify />} />
      <Route path="/guide/quiz/:partId" element={<GuideQuizPage />} />
      <Route path="/guide/:slug" element={<GuideChapter />} />
      <Route path="/help" element={<HelpHub />} />
      <Route path="/help/:slug" element={<HelpArticle />} />
      <Route path="/cookbook" element={<CookbookHub />} />
      <Route path="/cookbook/:slug" element={<CookbookEntry />} />
      <Route path="/search" element={<SiteSearch />} />
      <Route path="/ask" element={<AskAssistant />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/software" element={<SoftwareLanding />} />
      <Route path="/software/:type" element={<SoftwareLanding />} />
      <Route path="/cooperative-software/:state" element={<StateLanding />} />
      <Route path="/blog" element={<BlogIndex />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/glossary" element={<Glossary />} />
      <Route path="/glossary/:slug" element={<GlossaryTerm />} />
      <Route path="/tools" element={<CalculatorHub />} />
      <Route path="/tools/:slug" element={<CalculatorPage />} />

      {/* Protected Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/cash-book" element={<ProtectedRoute><CashBook /></ProtectedRoute>} />
      <Route path="/bank-book" element={<ProtectedRoute><BankBook /></ProtectedRoute>} />
      <Route path="/vouchers" element={<ProtectedRoute><Vouchers /></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute><Ledger /></ProtectedRoute>} />
      <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
      <Route path="/member-application" element={<ProtectedRoute><MemberApplication /></ProtectedRoute>} />
      <Route path="/trial-balance" element={<ProtectedRoute><TrialBalance /></ProtectedRoute>} />
      <Route path="/bills-outstanding" element={<ProtectedRoute><BillsOutstanding /></ProtectedRoute>} />
      <Route path="/trading-account" element={<ProtectedRoute><TradingAccount /></ProtectedRoute>} />
      <Route path="/profit-loss" element={<ProtectedRoute><ProfitLoss /></ProtectedRoute>} />
      <Route path="/receipts-payments" element={<ProtectedRoute><ReceiptsPayments /></ProtectedRoute>} />
      <Route path="/balance-sheet" element={<ProtectedRoute><BalanceSheet /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/society-setup" element={<ProtectedRoute><SocietySetup /></ProtectedRoute>} />
      <Route path="/share-register" element={<ProtectedRoute><ShareRegister /></ProtectedRoute>} />
      <Route path="/loan-register" element={<ProtectedRoute><LoanRegister /></ProtectedRoute>} />
      <Route path="/milk-collection" element={<ProtectedRoute><MilkCollection /></ProtectedRoute>} />
      <Route path="/asset-register" element={<ProtectedRoute><AssetRegister /></ProtectedRoute>} />
      <Route path="/depreciation-schedule" element={<ProtectedRoute><DepreciationSchedule /></ProtectedRoute>} />
      <Route path="/audit-register" element={<ProtectedRoute><AuditRegister /></ProtectedRoute>} />
      <Route path="/day-book" element={<ProtectedRoute><DayBook /></ProtectedRoute>} />
      <Route path="/ledger-heads" element={<ProtectedRoute><LedgerHeads /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><SaleManagement /></ProtectedRoute>} />
      <Route path="/receive-payment" element={<ProtectedRoute><ReceivePayment /></ProtectedRoute>} />
      <Route path="/sale-register" element={<ProtectedRoute><SaleRegister /></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute><PurchaseManagement /></ProtectedRoute>} />
      <Route path="/make-payment" element={<ProtectedRoute><MakePayment /></ProtectedRoute>} />
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
      <Route path="/features" element={<ProtectedRoute><Features /></ProtectedRoute>} />
      <Route path="/procurement-lots" element={<ProtectedRoute><ProcurementLots /></ProtectedRoute>} />
      <Route path="/procurement-masters" element={<ProtectedRoute><ProcurementMasters /></ProtectedRoute>} />
      <Route path="/agency-receipts" element={<ProtectedRoute><AgencyReceipts /></ProtectedRoute>} />
      <Route path="/procurement-registers" element={<ProtectedRoute><ProcurementRegisters /></ProtectedRoute>} />
      <Route path="/eway-bill" element={<ProtectedRoute><EWayBill /></ProtectedRoute>} />
      <Route path="/kcc-loan" element={<ProtectedRoute><KccLoan /></ProtectedRoute>} />
      <Route path="/election-module" element={<ProtectedRoute><ElectionModule /></ProtectedRoute>} />
      <Route path="/board-of-directors" element={<ProtectedRoute><BoardOfDirectors /></ProtectedRoute>} />
      <Route path="/flats-register" element={<ProtectedRoute><FlatsRegister /></ProtectedRoute>} />
      <Route path="/maintenance-billing" element={<ProtectedRoute><MaintenanceBilling /></ProtectedRoute>} />
      <Route path="/charge-heads" element={<ProtectedRoute><ChargeHeads /></ProtectedRoute>} />
      <Route path="/member-statement" element={<ProtectedRoute><MemberStatement /></ProtectedRoute>} />
      <Route path="/fund-statement" element={<ProtectedRoute><FundStatement /></ProtectedRoute>} />
      <Route path="/outstanding-register" element={<ProtectedRoute><OutstandingRegister /></ProtectedRoute>} />
      <Route path="/complaints" element={<ProtectedRoute><Complaints /></ProtectedRoute>} />
      <Route path="/parking" element={<ProtectedRoute><Parking /></ProtectedRoute>} />
      <Route path="/transfer-register" element={<ProtectedRoute><TransferRegister /></ProtectedRoute>} />
      <Route path="/share-nomination-register" element={<ProtectedRoute><ShareNominationRegister /></ProtectedRoute>} />
      <Route path="/insurance" element={<ProtectedRoute><Insurance /></ProtectedRoute>} />
      <Route path="/amc" element={<ProtectedRoute><Amc /></ProtectedRoute>} />
      <Route path="/legal-documents" element={<ProtectedRoute><LegalDocuments /></ProtectedRoute>} />
      <Route path="/buildings" element={<ProtectedRoute><Buildings /></ProtectedRoute>} />
      <Route path="/dairy-rate-charts" element={<ProtectedRoute><RateCharts /></ProtectedRoute>} />
      <Route path="/farmer-settlement" element={<ProtectedRoute><FarmerSettlement /></ProtectedRoute>} />
      <Route path="/dairy-registers" element={<ProtectedRoute><DairyRegisters /></ProtectedRoute>} />
      <Route path="/milk-dispatch" element={<ProtectedRoute><MilkDispatch /></ProtectedRoute>} />
      <Route path="/dairy-inputs" element={<ProtectedRoute><DairyInputs /></ProtectedRoute>} />
      <Route path="/dairy-distribution" element={<ProtectedRoute><DairyDistribution /></ProtectedRoute>} />
      <Route path="/work-orders" element={<ProtectedRoute><WorkOrders /></ProtectedRoute>} />
      <Route path="/muster-roll" element={<ProtectedRoute><MusterRoll /></ProtectedRoute>} />
      <Route path="/worker-master" element={<ProtectedRoute><WorkerMaster /></ProtectedRoute>} />
      <Route path="/department-master" element={<ProtectedRoute><DepartmentMaster /></ProtectedRoute>} />
      <Route path="/department-bills" element={<ProtectedRoute><DepartmentBills /></ProtectedRoute>} />
      <Route path="/worker-advances" element={<ProtectedRoute><WorkerAdvances /></ProtectedRoute>} />
      <Route path="/work-order-profit" element={<ProtectedRoute><WorkOrderProfit /></ProtectedRoute>} />
      <Route path="/wage-register" element={<ProtectedRoute><WageRegister /></ProtectedRoute>} />
      <Route path="/worker-ledger" element={<ProtectedRoute><WorkerLedger /></ProtectedRoute>} />
      <Route path="/advance-register" element={<ProtectedRoute><AdvanceRegister /></ProtectedRoute>} />
      <Route path="/pf-esi" element={<ProtectedRoute><PfEsi /></ProtectedRoute>} />
      <Route path="/wage-slip" element={<ProtectedRoute><WageSlip /></ProtectedRoute>} />
      <Route path="/opening-balances" element={<ProtectedRoute><OpeningBalances /></ProtectedRoute>} />
      <Route path="/multi-society-consolidation" element={<ProtectedRoute><MultiSocietyConsolidation /></ProtectedRoute>} />
      <Route path="/nabard-report" element={<ProtectedRoute><NabardReport /></ProtectedRoute>} />
      <Route path="/federation-report" element={<ProtectedRoute><FederationReport /></ProtectedRoute>} />
      <Route path="/recoverables" element={<ProtectedRoute><RecoverablesRegister /></ProtectedRoute>} />
      <Route path="/kachi-aarat" element={<ProtectedRoute><KachiAaratRegister /></ProtectedRoute>} />
      <Route path="/universal-importer" element={<ProtectedRoute><UniversalImporter /></ProtectedRoute>} />

      {/* Super Admin (Platform Owner) */}
      <Route path="/super-admin" element={<SuperAdminRoute><MainLayout><SuperAdminDashboard /></MainLayout></SuperAdminRoute>} />
      <Route path="/super-admin/feedback" element={<SuperAdminRoute><MainLayout><SuperAdminFeedback /></MainLayout></SuperAdminRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <DataProvider>
        <LabourProvider>
        <HousingProvider>
        <DairyProvider>
        <MarketingProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
        </MarketingProvider>
        </DairyProvider>
        </HousingProvider>
        </LabourProvider>
        </DataProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

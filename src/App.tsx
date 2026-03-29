import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { MainLayout } from "@/components/layout/MainLayout";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CashBook from "./pages/CashBook";
import BankBook from "./pages/BankBook";
import Vouchers from "./pages/Vouchers";
import Ledger from "./pages/Ledger";
import Members from "./pages/Members";
import TrialBalance from "./pages/TrialBalance";
import ProfitLoss from "./pages/ProfitLoss";
import TradingAccount from "./pages/TradingAccount";
import ReceiptsPayments from "./pages/ReceiptsPayments";
import BalanceSheet from "./pages/BalanceSheet";
import Reports from "./pages/Reports";
import SocietySetup from "./pages/SocietySetup";
import ShareRegister from "./pages/ShareRegister";
import LoanRegister from "./pages/LoanRegister";
import AssetRegister from "./pages/AssetRegister";
import AuditRegister from "./pages/AuditRegister";
import DayBook from "./pages/DayBook";
import LedgerHeads from "./pages/LedgerHeads";
import Inventory from "./pages/Inventory";
import SaleManagement from "./pages/SaleManagement";
import PurchaseManagement from "./pages/PurchaseManagement";
import SalaryManagement from "./pages/SalaryManagement";
import Suppliers from "./pages/Suppliers";
import Customers from "./pages/Customers";
import DeletedVouchers from "./pages/DeletedVouchers";
import BankReconciliation from "./pages/BankReconciliation";
import ReserveFund from "./pages/ReserveFund";
import ProfitDistribution from "./pages/ProfitDistribution";
import LoanInterest from "./pages/LoanInterest";
import CompoundVoucher from "./pages/CompoundVoucher";
import VoucherApproval from "./pages/VoucherApproval";
import MeetingRegister from "./pages/MeetingRegister";
import NominationRegister from "./pages/NominationRegister";
import Form1MemberList from "./pages/Form1MemberList";
import AuditCertificate from "./pages/AuditCertificate";
import BackupRestore from "./pages/BackupRestore";
import GstSummary from "./pages/GstSummary";
import AgingAnalysis from "./pages/AgingAnalysis";
import StockValuation from "./pages/StockValuation";
import BudgetModule from "./pages/BudgetModule";
import TdsForm16A from "./pages/TdsForm16A";
import UserManagement from "./pages/UserManagement";
import EWayBill from "./pages/EWayBill";
import KccLoan from "./pages/KccLoan";
import ElectionModule from "./pages/ElectionModule";
import OpeningBalances from "./pages/OpeningBalances";
import Register from "./pages/Register";
import MultiSocietyConsolidation from "./pages/MultiSocietyConsolidation";
import NabardReport from "./pages/NabardReport";
import FederationReport from "./pages/FederationReport";
import NotFound from "./pages/NotFound";

import { preloadHindiFont } from '@/lib/fontLoader';

const queryClient = new QueryClient();

// Start loading Hindi font in background so it's ready when user generates a PDF
preloadHindiFont();

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <MainLayout>{children}</MainLayout>;
};

// Public Route wrapper (redirects to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      
      {/* Protected Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/cash-book" element={<ProtectedRoute><CashBook /></ProtectedRoute>} />
      <Route path="/bank-book" element={<ProtectedRoute><BankBook /></ProtectedRoute>} />
      <Route path="/vouchers" element={<ProtectedRoute><Vouchers /></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute><Ledger /></ProtectedRoute>} />
      <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
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
      <Route path="/audit-register" element={<ProtectedRoute><AuditRegister /></ProtectedRoute>} />
      <Route path="/day-book" element={<ProtectedRoute><DayBook /></ProtectedRoute>} />
      <Route path="/ledger-heads" element={<ProtectedRoute><LedgerHeads /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><SaleManagement /></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute><PurchaseManagement /></ProtectedRoute>} />
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
      <Route path="/backup-restore" element={<ProtectedRoute><BackupRestore /></ProtectedRoute>} />
      <Route path="/gst-summary" element={<ProtectedRoute><GstSummary /></ProtectedRoute>} />
      <Route path="/aging-analysis" element={<ProtectedRoute><AgingAnalysis /></ProtectedRoute>} />
      <Route path="/stock-valuation" element={<ProtectedRoute><StockValuation /></ProtectedRoute>} />
      <Route path="/budget-module" element={<ProtectedRoute><BudgetModule /></ProtectedRoute>} />
      <Route path="/tds-form16a" element={<ProtectedRoute><TdsForm16A /></ProtectedRoute>} />
      <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/eway-bill" element={<ProtectedRoute><EWayBill /></ProtectedRoute>} />
      <Route path="/kcc-loan" element={<ProtectedRoute><KccLoan /></ProtectedRoute>} />
      <Route path="/election-module" element={<ProtectedRoute><ElectionModule /></ProtectedRoute>} />
      <Route path="/opening-balances" element={<ProtectedRoute><OpeningBalances /></ProtectedRoute>} />
      <Route path="/multi-society-consolidation" element={<ProtectedRoute><MultiSocietyConsolidation /></ProtectedRoute>} />
      <Route path="/nabard-report" element={<ProtectedRoute><NabardReport /></ProtectedRoute>} />
      <Route path="/federation-report" element={<ProtectedRoute><FederationReport /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
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

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
import Register from "./pages/Register";
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

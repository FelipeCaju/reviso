import { isPlatformOwner } from "@/lib/platformAccess";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Appointments from '@/pages/Appointments';
import Quotes from '@/pages/Quotes';
import QuoteEditor from '@/pages/QuoteEditor';
import WorkOrders from '@/pages/WorkOrders';
import WorkOrderEditor from '@/pages/WorkOrderEditor';
import Reports from '@/pages/Reports';
import Customers from '@/pages/Customers';
import CustomerDetail from '@/pages/CustomerDetail';
import CustomerForm from '@/pages/CustomerForm';
import Vehicles from '@/pages/Vehicles';
import VehicleDetail from '@/pages/VehicleDetail';
import VehicleForm from '@/pages/VehicleForm';
import Materials from '@/pages/Materials';
import Services from '@/pages/Services';
import Settings from '@/pages/Settings';
import AdminOnboarding from '@/pages/AdminOnboarding';
import Suppliers from '@/pages/Suppliers';
import SupplierDetail from '@/pages/SupplierDetail';
import PurchaseRequests from '@/pages/PurchaseRequests';
import PurchaseRequestEditor from '@/pages/PurchaseRequestEditor';
import PurchaseOrders from '@/pages/PurchaseOrders';
import Expenses from '@/pages/Expenses';
import Finance from '@/pages/Finance';
import FinanceReports from '@/pages/FinanceReports';
import Support from '@/pages/Support';
import WorkshopOnboarding from '@/pages/WorkshopOnboarding';
import DemoExpired from '@/components/DemoExpired';
import { useDemoStatus } from '@/hooks/useDemoStatus';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, needsOnboarding, needsProfileCompletion, user } = useAuth();
  const { isDemo, isExpired } = useDemoStatus();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <Login />;
    }
  }

  // User self-registered but hasn't set up their workshop yet
  if (needsOnboarding) return <UserNotRegisteredError />;

  // User has a workshop but mandatory profile data is missing
  if (needsProfileCompletion) return <WorkshopOnboarding />;

  // Demo expired — show contact card
  if (isDemo && isExpired) return <DemoExpired />;

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
      <Route path="/reset-password" element={<Navigate to="/login" replace />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={isPlatformOwner(user) && !user?.workshop_id ? <Navigate to="/admin" replace /> : <Dashboard />} />
          <Route path="/agenda" element={<Appointments />} />
          <Route path="/orcamentos" element={<Quotes />} />
          <Route path="/orcamentos/novo" element={<QuoteEditor />} />
          <Route path="/orcamentos/:id" element={<QuoteEditor />} />
          <Route path="/os" element={<WorkOrders />} />
          <Route path="/os/novo" element={<WorkOrderEditor />} />
          <Route path="/os/:id" element={<WorkOrderEditor />} />
          <Route path="/relatorios" element={<Reports />} />
          <Route path="/clientes" element={<Customers />} />
          <Route path="/clientes/novo" element={<CustomerForm />} />
          <Route path="/clientes/:id" element={<CustomerDetail />} />
          <Route path="/clientes/:id/editar" element={<CustomerForm />} />
          <Route path="/veiculos" element={<Vehicles />} />
          <Route path="/veiculos/novo" element={<VehicleForm />} />
          <Route path="/veiculos/:id" element={<VehicleDetail />} />
          <Route path="/veiculos/:id/editar" element={<VehicleForm />} />
          <Route path="/materiais" element={<Materials />} />
          <Route path="/servicos" element={<Services />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/suporte" element={<Support />} />
          <Route path="/fornecedores" element={<Suppliers />} />
          <Route path="/fornecedores/:id" element={<SupplierDetail />} />
          <Route path="/compras" element={<PurchaseRequests />} />
          <Route path="/compras/nova" element={<PurchaseRequestEditor />} />
          <Route path="/compras/:id" element={<PurchaseRequestEditor />} />
          <Route path="/pedidos" element={<PurchaseOrders />} />
          <Route path="/despesas" element={<Expenses />} />
          <Route path="/financeiro" element={<Finance />} />
          <Route path="/relatorios-financeiros" element={<FinanceReports />} />
          <Route path="/admin" element={isPlatformOwner(user) ? <AdminOnboarding /> : <Navigate to="/" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
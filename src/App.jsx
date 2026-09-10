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
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
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

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
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
          <Route path="/admin" element={<AdminOnboarding />} />
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
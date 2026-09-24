import { isPlatformOwner as hasPlatformAccess, canAccessPage } from "@/lib/platformAccess";
import { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Users,
  Car,
  Package,
  Wrench,
  ClipboardList,
  BarChart3,
  Settings as SettingsIcon,
  Building2,
  Plus,
  LogOut,
  Menu,
  X,
  Truck,
  ShoppingCart,
  Receipt,
  Wallet,
  LifeBuoy,
  Landmark,
  FileCheck2,
  FileInput,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import QuickSearch from "@/components/QuickSearch";
import { Image as ImgCmp } from "@/components/ui/image";
import DemoBanner from "@/components/DemoBanner";
import { useDemoStatus } from "@/hooks/useDemoStatus";

const SIDEBAR_LOGO_URL = "https://media.base44.com/images/public/6aa29ae2c83b44fa65bdbaa2/a428f7140_NovoProjeto.png";
const APP_BUILD_LABEL = __APP_BUILD_LABEL__;

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, roles: ["admin", "user"] },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, roles: ["admin", "user"] },
  { to: "/orcamentos", label: "Orçamentos", icon: FileText, roles: ["admin"] },
  { to: "/os", label: "Ordens de Serviço", icon: ClipboardList, roles: ["admin", "user"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["admin", "user"] },
  { to: "/veiculos", label: "Veículos", icon: Car, roles: ["admin", "user"] },
  { to: "/materiais", label: "Materiais", icon: Package, roles: ["admin"] },
  { to: "/servicos", label: "Serviços", icon: Wrench, roles: ["admin"] },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck, roles: ["admin"] },
  { to: "/compras", label: "Compras", icon: ShoppingCart, roles: ["admin"] },
  { to: "/despesas", label: "Despesas", icon: Receipt, roles: ["admin"] },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, roles: ["admin"] },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["admin"] },
  { to: "/documentos-fiscais", label: "Documentos de Saída", icon: FileCheck2, roles: ["admin"], fiscal: true, end: true },
  { to: "/documentos-fiscais/entrada", label: "Documentos de Entrada", icon: FileInput, roles: ["admin"], fiscal: true },
];

const NAV_SECONDARY = [
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon, roles: ["admin"] },
  { to: "/fiscal", label: "Configurações Fiscais", icon: Landmark, roles: ["admin"], fiscal: true },
  { to: "/suporte", label: "Suporte", icon: LifeBuoy, roles: ["admin", "user"] },
  { to: "/admin", label: "Nova Oficina", icon: Building2, roles: ["admin"] },
];

const MOBILE_BOTTOM_NAV = [
  { to: "/", label: "Início", icon: LayoutDashboard, end: true, roles: ["admin", "user"] },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, roles: ["admin", "user"] },
  { to: "/orcamentos", label: "Orçamento", icon: FileText, roles: ["admin"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["admin", "user"] },
];

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary/15 text-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, workshop, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isDemo, hoursRemaining } = useDemoStatus();

  const handleLogout = () => logout();

  const userRole = user?.role || "user";
  const isPlatformOwner = hasPlatformAccess(user) && !user?.workshop_id;
  const visibleNav = isPlatformOwner
    ? [{ to: "/admin", label: "Nova Oficina", icon: Building2, end: true }]
    : isDemo
      ? NAV.filter((item) => !item.fiscal || workshop?.fiscal_module_enabled)
      : NAV.filter((item) => (!item.roles || item.roles.includes(userRole)) && (!item.fiscal || workshop?.fiscal_module_enabled));
  const visibleSecondary = isPlatformOwner
    ? []
    : NAV_SECONDARY.filter((item) => canAccessPage(item.to, user, isDemo) && (!item.fiscal || workshop?.fiscal_module_enabled));
  const visibleBottomNav = isPlatformOwner
    ? [{ to: "/admin", label: "Nova Oficina", icon: Building2, end: true }]
    : isDemo
      ? MOBILE_BOTTOM_NAV
      : MOBILE_BOTTOM_NAV.filter((item) => !item.roles || item.roles.includes(userRole));
  const canCreateQuote = userRole === "admin" && !isPlatformOwner;

  if (!canAccessPage(location.pathname, user, isDemo)) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
          <ImgCmp src={SIDEBAR_LOGO_URL} alt="Revisô" fittingType="fit" className="w-9 h-9 shrink-0 rounded-lg" />
          <div className="font-heading font-semibold leading-tight text-white">
            <div className="text-sm">Revisô</div>
            <div className="text-xs text-sidebar-foreground font-normal">Gestão Mecânica</div>
          </div>
        </div>
        <div className="px-3 pt-3 pb-2 space-y-2">
          <QuickSearch />
          {canCreateQuote && (
            <Button onClick={() => navigate("/orcamentos/novo")} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Novo Orçamento
            </Button>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5">
          {visibleNav.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
          <div className="pt-2 mt-2 border-t border-sidebar-border space-y-0.5">
            {visibleSecondary.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </div>
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
              {(user?.full_name || user?.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate text-white">{user?.full_name || "Usuário"}</div>
              <div className="text-[11px] text-sidebar-foreground truncate">{user?.email}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:text-white hover:bg-sidebar-accent" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
          <div className="px-2 pt-2 text-[9px] text-sidebar-foreground/70">{APP_BUILD_LABEL}</div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-3 h-14">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-1 text-white rounded-lg hover:bg-sidebar-accent shrink-0"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <ImgCmp src={SIDEBAR_LOGO_URL} alt="Revisô" fittingType="fit" className="w-8 h-8 shrink-0 rounded-lg" />
          <div className="flex-1 min-w-0">
            <QuickSearch />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="lg:ml-60 pb-20 lg:pb-8 min-h-screen">
        <div className="px-4 lg:px-6 py-4 lg:py-6 max-w-7xl mx-auto">
          {isDemo && <DemoBanner hoursRemaining={hoursRemaining} />}
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="flex">
          {visibleBottomNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Mobile lateral drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-72 max-w-[80vw] bg-sidebar flex flex-col h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 h-16 border-b border-sidebar-border shrink-0">
              <div className="flex items-center gap-2.5">
                <ImgCmp src={SIDEBAR_LOGO_URL} alt="Revisô" fittingType="fit" className="w-9 h-9 rounded-lg" />
                <div className="font-heading font-semibold leading-tight text-white">
                  <div className="text-sm">Revisô</div>
                  <div className="text-xs text-sidebar-foreground font-normal">Gestão Mecânica</div>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 text-sidebar-foreground hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {canCreateQuote && (
                <Button
                  onClick={() => {
                    setDrawerOpen(false);
                    navigate("/orcamentos/novo");
                  }}
                  className="w-full mb-3"
                >
                  <Plus className="w-4 h-4 mr-2" /> Novo Orçamento
                </Button>
              )}
              <div className="space-y-0.5">
                {visibleNav.map((item) => (
                  <NavItem key={item.to} item={item} onNavigate={() => setDrawerOpen(false)} />
                ))}
              </div>
              <div className="pt-2 mt-2 border-t border-sidebar-border space-y-0.5">
                {visibleSecondary.map((item) => (
                  <NavItem key={item.to} item={item} onNavigate={() => setDrawerOpen(false)} />
                ))}
              </div>
            </div>
            <div className="p-3 border-t border-sidebar-border shrink-0">
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                  {(user?.full_name || user?.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate text-white">{user?.full_name || "Usuário"}</div>
                  <div className="text-[11px] text-sidebar-foreground truncate">{user?.email}</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:text-white hover:bg-sidebar-accent" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </Button>
              <div className="px-2 pt-2 text-[9px] text-sidebar-foreground/70">{APP_BUILD_LABEL}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

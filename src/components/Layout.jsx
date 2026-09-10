import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import QuickSearch from "@/components/QuickSearch";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, roles: ["admin", "user"] },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, roles: ["admin", "user"] },
  { to: "/orcamentos", label: "Orçamentos", icon: FileText, roles: ["admin"] },
  { to: "/os", label: "Ordens de Serviço", icon: ClipboardList, roles: ["admin", "user"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["admin", "user"] },
  { to: "/veiculos", label: "Veículos", icon: Car, roles: ["admin", "user"] },
  { to: "/materiais", label: "Materiais", icon: Package, roles: ["admin"] },
  { to: "/servicos", label: "Serviços", icon: Wrench, roles: ["admin"] },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["admin"] },
];

const NAV_SECONDARY = [
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon, roles: ["admin"] },
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleLogout = () => logout();

  const userRole = user?.role || "user";
  const isPlatformOwner = userRole === "admin" && !user?.workshop_id;
  const visibleNav = isPlatformOwner
    ? [{ to: "/admin", label: "Nova Oficina", icon: Building2, end: true }]
    : NAV.filter((item) => !item.roles || item.roles.includes(userRole));
  const visibleSecondary = isPlatformOwner ? [] : NAV_SECONDARY.filter((item) => !item.roles || item.roles.includes(userRole));
  const canCreateQuote = userRole === "admin" && !isPlatformOwner;
  const hasMore = visibleNav.length > 5 || visibleSecondary.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            OF
          </div>
          <div className="font-heading font-semibold leading-tight text-white">
            <div className="text-sm">Oficina</div>
            <div className="text-xs text-sidebar-foreground font-normal">Gestão</div>
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
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-3 h-14">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
            OF
          </div>
          <div className="flex-1 min-w-0">
            <QuickSearch />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="md:ml-60 pb-20 md:pb-8 min-h-screen">
        <div className="px-4 md:px-6 py-4 md:py-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className={`grid ${hasMore ? "grid-cols-6" : "grid-cols-5"}`}>
          {visibleNav.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
          {hasMore && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
            >
              <Menu className="w-5 h-5" />
              Mais
            </button>
          )}
        </div>
      </nav>

      {/* Mobile "Mais" sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setMoreOpen(false)}>
          <div
            className="w-full bg-background rounded-t-2xl p-4 pb-8 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Mais opções</div>
              <button onClick={() => setMoreOpen(false)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              {visibleNav.slice(5).map((item) => (
                <NavItem key={item.to} item={item} onNavigate={() => setMoreOpen(false)} />
              ))}
              {visibleSecondary.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={() => setMoreOpen(false)} />
              ))}
              {canCreateQuote && (
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    navigate("/orcamentos/novo");
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary hover:bg-accent w-full"
                >
                  <Plus className="w-4 h-4" /> Novo Orçamento
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent w-full"
              >
                <LogOut className="w-4 h-4" /> Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
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
  Plus,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import QuickSearch from "@/components/QuickSearch";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/orcamentos", label: "Orçamentos", icon: FileText },
  { to: "/os", label: "Ordens de Serviço", icon: ClipboardList },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/veiculos", label: "Veículos", icon: Car },
  { to: "/materiais", label: "Materiais", icon: Package },
  { to: "/servicos", label: "Serviços", icon: Wrench },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

const NAV_SECONDARY = [
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon },
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
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
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

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
            OF
          </div>
          <div className="font-heading font-semibold leading-tight">
            <div className="text-sm">Oficina</div>
            <div className="text-xs text-muted-foreground font-normal">Gestão</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
          <div className="pt-2 mt-2 border-t border-border space-y-1">
            {NAV_SECONDARY.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </div>
        </nav>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold">
              {(user?.full_name || user?.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{user?.full_name || "Usuário"}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2 px-3 h-14">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
            OF
          </div>
          <div className="flex-1 min-w-0">
            <QuickSearch />
          </div>
        </div>
      </header>

      {/* Desktop top search bar */}
      <header className="hidden md:block sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="ml-60 px-6 h-16 flex items-center gap-4">
          <div className="flex-1 max-w-xl">
            <QuickSearch />
          </div>
          <Button onClick={() => navigate("/orcamentos/novo")} className="ml-auto">
            <Plus className="w-4 h-4 mr-2" /> Novo Orçamento
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="md:ml-60 pb-20 md:pb-8 min-h-screen">
        <div className="px-4 md:px-6 py-4 md:py-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background border-t border-border">
        <div className="grid grid-cols-6">
          {NAV.slice(0, 5).map((item) => {
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
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
          >
            <Menu className="w-5 h-5" />
            Mais
          </button>
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
              {NAV.slice(5).map((item) => (
                <NavItem key={item.to} item={item} onNavigate={() => setMoreOpen(false)} />
              ))}
              {NAV_SECONDARY.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={() => setMoreOpen(false)} />
              ))}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  navigate("/orcamentos/novo");
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary hover:bg-accent w-full"
              >
                <Plus className="w-4 h-4" /> Novo Orçamento
              </button>
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
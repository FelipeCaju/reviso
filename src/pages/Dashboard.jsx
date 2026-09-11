import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { todayISO, addDaysISO, formatDate, normalizePlate, vehicleDescription, formatCurrency } from "@/lib/format";
import { AppointmentStatusBadge, appointmentTypeInfo } from "@/components/StatusBadge";

export default function Dashboard() {
  const navigate = useNavigate();
  const [today, setToday] = useState([]);
  const [tomorrow, setTomorrow] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const t = todayISO();
        const tm = addDaysISO(1);
        const [todayAppts, tomorrowAppts, allQuotes, allWO, settingsList, allTx] = await Promise.all([
          base44.entities.Appointment.filter({ scheduled_date: t }, "scheduled_time", 50),
          base44.entities.Appointment.filter({ scheduled_date: tm }, "scheduled_time", 50),
          base44.entities.Quote.list("-date", 200),
          base44.entities.WorkOrder.list("-entry_date", 200),
          base44.entities.WorkshopSetting.list("-updated_date", 1),
          base44.entities.FinancialTransaction.list("-date", 1000),
        ]);
        setToday(todayAppts);
        setTomorrow(tomorrowAppts);
        setQuotes(allQuotes);
        setWorkOrders(allWO);
        setSettings(settingsList[0] || null);
        setTransactions(allTx);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const capacityFor = (dateStr) => {
    if (!settings) return 8;
    const day = new Date(dateStr + "T00:00:00").getDay(); // 0=Dom..6=Sáb
    const map = [
      settings.capacity_sunday, settings.capacity_monday, settings.capacity_tuesday,
      settings.capacity_wednesday, settings.capacity_thursday, settings.capacity_friday,
      settings.capacity_saturday,
    ];
    return map[day] ?? settings.default_capacity ?? 8;
  };

  const todayCap = capacityFor(todayISO());
  const activeToday = today.filter((a) => !["cancelado", "nao_compareceu"].includes(a.status));

  const waitingApproval = quotes.filter((q) => q.status === "aguardando_aprovacao").length;
  const approvedWaitingSched = quotes.filter((q) => q.status === "aprovado" || q.status === "aguardando_agendamento").length;
  const openWO = workOrders.filter((w) => ["aberta", "aguardando_pecas"].includes(w.status)).length;
  const execWO = workOrders.filter((w) => w.status === "em_execucao").length;
  const readyWO = workOrders.filter((w) => w.status === "finalizada").length;

  const now = new Date();
  const monthWO = workOrders.filter((w) => {
    const d = new Date(w.entry_date);
    return w.status === "finalizada" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthRevenue = monthWO.reduce((s, w) => s + (w.total || 0), 0);

  // Financial indicators
  const monthTx = transactions.filter((t) => {
    const d = new Date(t.date);
    return t.status === "ativo" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthEntradas = monthTx.filter((t) => t.type === "entrada").reduce((s, t) => s + (t.amount || 0), 0);
  const monthSaidas = monthTx.filter((t) => t.type === "saida").reduce((s, t) => s + (t.amount || 0), 0);
  const monthResultado = monthEntradas - monthSaidas;
  const aReceber = workOrders
    .filter((w) => w.total > 0 && w.payment_status !== "pago" && w.payment_status !== "isento_cancelado" && w.status !== "cancelada")
    .reduce((s, w) => s + ((w.total || 0) - (w.paid_amount || 0)), 0);

  const withTime = activeToday.filter((a) => a.scheduled_time).sort((a, b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || ""));
  const noTime = activeToday.filter((a) => !a.scheduled_time);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{formatDate(todayISO())}</p>
      </div>

      {/* Capacity highlight */}
      <button
        onClick={() => navigate("/agenda")}
        className="w-full rounded-2xl bg-sidebar border border-sidebar-border border-l-4 border-l-primary p-5 text-left hover:shadow-lg transition flex items-center justify-between"
      >
        <div>
          <div className="text-sm text-sidebar-foreground">Hoje na Oficina</div>
          <div className="text-3xl font-bold mt-1 text-white">{activeToday.length} / {todayCap}</div>
          <div className="text-sm text-sidebar-foreground mt-1">veículos agendados</div>
        </div>
        <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-2xl shrink-0">🔧</div>
      </button>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Aguardando Aprovação" value={waitingApproval} accent="amber" onClick={() => navigate("/orcamentos?status=aguardando_aprovacao")} />
        <Stat label="Aprovados p/ Agendar" value={approvedWaitingSched} accent="emerald" onClick={() => navigate("/orcamentos?status=aprovado")} />
        <Stat label="OS Abertas" value={openWO} accent="slate" onClick={() => navigate("/os")} />
        <Stat label="OS em Execução" value={execWO} accent="teal" onClick={() => navigate("/os")} />
        <Stat label="Veículos Prontos" value={readyWO} accent="emerald" onClick={() => navigate("/os")} />
        <Stat label="OS Finalizadas (mês)" value={monthWO.length} accent="slate" />
        <Stat label="Faturamento (mês)" value={formatCurrency(monthRevenue)} accent="amber" />
      </div>

      {/* Financial indicators */}
      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Financeiro do Mês</h2>
          <Button size="sm" variant="outline" onClick={() => navigate("/financeiro")}>Ver Financeiro</Button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Recebido" value={formatCurrency(monthEntradas)} accent="emerald" />
          <Stat label="A Receber" value={formatCurrency(aReceber)} accent="amber" />
          <Stat label="Saídas" value={formatCurrency(monthSaidas)} accent="slate" />
          <Stat label="Resultado" value={formatCurrency(monthResultado)} accent={monthResultado >= 0 ? "emerald" : "amber"} />
        </div>
      </div>

      {/* Today list */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 bg-accent/40 border-b border-border">
          <h2 className="font-semibold text-sm">Hoje na Oficina</h2>
          <span className="text-xs font-medium text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border">{activeToday.length}/{todayCap}</span>
        </div>
        {activeToday.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum veículo agendado para hoje.</div>
        ) : (
          <div>
            {withTime.map((a) => (
              <button key={a.id} onClick={() => navigate("/agenda")} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-accent/30 border-b border-border transition">
                <div className="text-sm font-mono font-medium w-12 shrink-0 text-primary">{a.scheduled_time}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{a.customer_name_snapshot}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.vehicle_description_snapshot} · {normalizePlate(a.plate_snapshot)}</div>
                </div>
                <AppointmentStatusBadge status={a.status} />
              </button>
            ))}
            {noTime.length > 0 && withTime.length > 0 && (
              <div className="px-4 py-1.5 text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">Sem horário</div>
            )}
            {noTime.map((a) => (
              <button key={a.id} onClick={() => navigate("/agenda")} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-accent/30 border-b border-border last:border-0 transition">
                <div className="text-xs text-muted-foreground w-12 shrink-0">—</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{a.customer_name_snapshot}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.vehicle_description_snapshot} · {normalizePlate(a.plate_snapshot)}</div>
                </div>
                <AppointmentStatusBadge status={a.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tomorrow */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 bg-accent/40 border-b border-border">
          <h2 className="font-semibold text-sm">Amanhã</h2>
          <span className="text-xs font-medium text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border">{tomorrow.length}/{capacityFor(addDaysISO(1))}</span>
        </div>
        {tomorrow.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum veículo previsto.</div>
        ) : (
          <div>
            {tomorrow.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                <div className="text-xs font-mono w-12 shrink-0 text-primary">{a.scheduled_time || "—"}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{a.customer_name_snapshot}</div>
                  <div className="text-xs text-muted-foreground truncate">{normalizePlate(a.plate_snapshot)}</div>
                </div>
                <span className="text-xs text-muted-foreground">{appointmentTypeInfo[a.type]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, onClick, wide, accent = "slate" }) {
  const Comp = onClick ? "button" : "div";
  const accentBorder = {
    amber: "border-l-amber-500",
    emerald: "border-l-emerald-500",
    teal: "border-l-teal-500",
    slate: "border-l-slate-400",
  }[accent];
  return (
    <Comp
      onClick={onClick}
      className={`text-left rounded-xl bg-card border border-border border-l-4 ${accentBorder} p-3.5 ${onClick ? "hover:shadow-md hover:-translate-y-0.5" : ""} transition-all ${wide ? "col-span-2" : ""}`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg md:text-xl font-bold mt-1 text-foreground">{value}</div>
    </Comp>
  );
}
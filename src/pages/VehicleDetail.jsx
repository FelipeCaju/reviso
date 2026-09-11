import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Car, FileText, CalendarDays, ClipboardList, Plus, History, User,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  normalizePlate, vehicleDescription, vehicleTypeLabel, formatCurrency, formatDate, formatDateTime,
} from "@/lib/format";
import { QuoteStatusBadge } from "@/components/StatusBadge";

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [owners, setOwners] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const v = await base44.entities.Vehicle.get(id);
        setVehicle(v);
        const [o, q, w, a] = await Promise.all([
          base44.entities.VehicleOwner.filter({ vehicle_id: id }, "-start_date", 50),
          base44.entities.Quote.filter({ vehicle_id: id }, "-date", 100),
          base44.entities.WorkOrder.filter({ vehicle_id: id }, "-entry_date", 100),
          base44.entities.Appointment.filter({ vehicle_id: id }, "-scheduled_date", 50),
        ]);
        setOwners(o); setQuotes(q); setWorkOrders(w); setAppointments(a);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;
  if (!vehicle) return <div className="text-center py-16">Veículo não encontrado.</div>;

  // Build unified history (prontuário) — only quotes that were NOT converted to OS
  const osQuoteIds = new Set(workOrders.map((w) => w.quote_id).filter(Boolean));
  const standaloneQuotes = quotes.filter((q) => !osQuoteIds.has(q.id) && q.status !== "convertido_os");
  const history = [
    ...standaloneQuotes.map((q) => ({ kind: "quote", date: q.date, id: q.id, number: q.number, title: `Orçamento #${q.number}`, total: q.total, status: q.status, owner: q.customer_name_snapshot, mileage: q.mileage })),
    ...workOrders.map((w) => ({ kind: "os", date: w.entry_date, id: w.id, number: w.number, title: `OS #${w.number}`, total: w.total, status: w.status, owner: w.customer_name_snapshot, mileage: w.mileage_in })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const nextAppt = appointments.find((a) => ["agendado", "confirmado"].includes(a.status));
  const lastMaintenance = workOrders.find((w) => ["finalizada", "pronta_retirada", "entregue"].includes(w.status));

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/veiculos")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Veículos
      </button>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-2xl shrink-0">
            {vehicle.type === "moto" ? "🏍️" : vehicle.type === "caminhao" ? "🚚" : "🚗"}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-heading font-semibold truncate">{vehicleDescription(vehicle)}</h1>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{normalizePlate(vehicle.plate)}</span>
              {vehicle.year_model && <span>{vehicle.year_model}</span>}
              {vehicle.color && <span>{vehicle.color}</span>}
              {vehicle.fuel && <span>{vehicle.fuel}</span>}
            </div>
            <div className="mt-1 text-sm">
              <span className="text-muted-foreground">Proprietário atual: </span>
              <span className="font-medium">{owners.find((o) => o.active)?.customer_name_snapshot || "—"}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div><div className="text-xs text-muted-foreground">Tipo</div><div>{vehicleTypeLabel[vehicle.type]}</div></div>
          <div><div className="text-xs text-muted-foreground">Km atual</div><div>{Number(vehicle.mileage || 0).toLocaleString("pt-BR")} km</div></div>
          <div><div className="text-xs text-muted-foreground">Chassi</div><div className="truncate">{vehicle.chassis || "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Renavam</div><div className="truncate">{vehicle.renavam || "—"}</div></div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Button variant="outline" onClick={() => navigate(`/orcamentos/novo?veiculo=${id}`)}>
          <FileText className="w-4 h-4 mr-2" /> Orçamento
        </Button>
        <Button variant="outline" onClick={() => navigate(`/agenda?veiculo=${id}`)}>
          <CalendarDays className="w-4 h-4 mr-2" /> Agendamento
        </Button>
        <Button variant="outline" onClick={() => navigate(`/veiculos/${id}/editar`)}>
          <Plus className="w-4 h-4 mr-2" /> Editar
        </Button>
      </div>

      {/* Next appointment / last maintenance */}
      <div className="grid sm:grid-cols-2 gap-2">
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Próximo Agendamento</div>
          <div className="mt-1 text-sm font-medium">{nextAppt ? `${formatDate(nextAppt.scheduled_date)} ${nextAppt.scheduled_time || ""}` : "Nenhum"}</div>
          {nextAppt && <div className="text-xs text-muted-foreground">{nextAppt.reason || ""}</div>}
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> Última Manutenção</div>
          <div className="mt-1 text-sm font-medium">{lastMaintenance ? `${formatDate(lastMaintenance.entry_date)}` : "Nenhuma"}</div>
          {lastMaintenance && <div className="text-xs text-muted-foreground">{Number(lastMaintenance.mileage_in || 0).toLocaleString("pt-BR")} km · {formatCurrency(lastMaintenance.total)}</div>}
        </CardContent></Card>
      </div>

      {/* Owner history */}
      <Section title="Histórico de Proprietários" icon={User}>
        {owners.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">Sem registro de proprietários.</div>
        ) : owners.map((o) => (
          <div key={o.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
            <div>
              <div className="font-medium text-sm">{o.customer_name_snapshot || "—"}</div>
              <div className="text-xs text-muted-foreground">
                Desde {formatDate(o.start_date)} {o.end_date ? `até ${formatDate(o.end_date)}` : "(atual)"}
              </div>
            </div>
            {o.active && <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Atual</span>}
          </div>
        ))}
      </Section>

      {/* Full history (prontuário) */}
      <Section title="Histórico Completo (Prontuário)" icon={History} count={history.length}>
        <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">Últimos 5 atendimentos</div>
        {history.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum histórico registrado.</div>
        ) : history.map((h) => (
          h.kind === "quote" ? (
            <Link key={`q-${h.id}`} to={`/orcamentos/${h.id}`} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-accent border-b border-border last:border-0">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{h.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(h.date)} · {h.mileage ? `${Number(h.mileage).toLocaleString("pt-BR")} km · ` : ""}{h.owner || ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-medium">{formatCurrency(h.total)}</div>
                <QuoteStatusBadge status={h.status} />
              </div>
            </Link>
          ) : (
            <div key={`w-${h.id}`} className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border last:border-0">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{h.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(h.date)} · {h.mileage ? `${Number(h.mileage).toLocaleString("pt-BR")} km · ` : ""}{h.owner || ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-medium">{formatCurrency(h.total)}</div>
                <span className="text-xs text-muted-foreground capitalize">{h.status?.replace(/_/g, " ")}</span>
              </div>
            </div>
          )
        ))}
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, count, children }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-medium text-sm">{title}</h2>
        {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}
      </div>
      {children}
    </div>
  );
}
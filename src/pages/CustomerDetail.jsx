import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Plus, Car, FileText, CalendarDays, ClipboardList, Phone, Mail, MapPin,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { normalizePlate, vehicleDescription, formatCurrency, formatDate, vehicleTypeLabel } from "@/lib/format";
import { QuoteStatusBadge, AppointmentStatusBadge } from "@/components/StatusBadge";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [c, v, q, a, w] = await Promise.all([
          base44.entities.Customer.get(id),
          base44.entities.Vehicle.filter({ current_owner_id: id }, "-updated_date", 100),
          base44.entities.Quote.filter({ customer_id: id }, "-date", 100),
          base44.entities.Appointment.filter({ customer_id: id }, "-scheduled_date", 100),
          base44.entities.WorkOrder.filter({ customer_id: id }, "-entry_date", 100),
        ]);
        setCustomer(c);
        setVehicles(v); setQuotes(q); setAppointments(a); setWorkOrders(w);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;
  if (!customer) return <div className="text-center py-16">Cliente não encontrado.</div>;

  const totalSpent = workOrders
    .filter((w) => w.status === "finalizada" || w.status === "pronta_retirada" || w.status === "entregue")
    .reduce((s, w) => s + (w.total || 0), 0);
  const lastVisit = workOrders[0]?.entry_date;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/clientes")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Clientes
      </button>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-heading font-semibold truncate">{customer.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {customer.phone}</span>}
              {customer.whatsapp && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {customer.whatsapp}</span>}
              {customer.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {customer.email}</span>}
            </div>
            {customer.address && (
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                {[customer.address, customer.number, customer.neighborhood, customer.city, customer.state].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
          {!customer.active && <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">Inativo</span>}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Button variant="outline" onClick={() => navigate(`/orcamentos/novo?cliente=${id}`)}>
          <FileText className="w-4 h-4 mr-2" /> Orçamento
        </Button>
        <Button variant="outline" onClick={() => navigate(`/agenda/novo?cliente=${id}`)}>
          <CalendarDays className="w-4 h-4 mr-2" /> Agendamento
        </Button>
        <Button variant="outline" onClick={() => navigate(`/veiculos/novo?proprietario=${id}`)}>
          <Car className="w-4 h-4 mr-2" /> Veículo
        </Button>
        <Button variant="outline" onClick={() => navigate(`/clientes/${id}/editar`)}>
          <Plus className="w-4 h-4 mr-2" /> Editar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Veículos</div>
          <div className="text-lg font-semibold">{vehicles.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Orçamentos</div>
          <div className="text-lg font-semibold">{quotes.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">OS</div>
          <div className="text-lg font-semibold">{workOrders.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Total Gasto</div>
          <div className="text-lg font-semibold">{formatCurrency(totalSpent)}</div>
        </CardContent></Card>
      </div>

      {/* Vehicles */}
      <Section title="Veículos" icon={Car} count={vehicles.length}>
        {vehicles.map((v) => (
          <Link key={v.id} to={`/veiculos/${v.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent border-b border-border last:border-0">
            <div className="text-2xl">{vehicleTypeLabel[v.type] === "Moto" ? "🏍️" : "🚗"}</div>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{vehicleDescription(v)}</div>
              <div className="text-xs text-muted-foreground">{normalizePlate(v.plate)}</div>
            </div>
          </Link>
        ))}
      </Section>

      {/* Upcoming appointment */}
      {appointments.find((a) => ["agendado", "confirmado"].includes(a.status)) && (
        <Section title="Próximo Agendamento" icon={CalendarDays}>
          {(() => {
            const next = appointments.find((a) => ["agendado", "confirmado"].includes(a.status));
            return (
              <div className="px-4 py-3">
                <div className="font-medium">{formatDate(next.scheduled_date)} {next.scheduled_time || ""}</div>
                <div className="text-sm text-muted-foreground">{next.reason || "—"}</div>
                <AppointmentStatusBadge status={next.status} />
              </div>
            );
          })()}
        </Section>
      )}

      {/* Quotes history */}
      <Section title="Orçamentos" icon={FileText} count={quotes.length}>
        {quotes.map((q) => (
          <Link key={q.id} to={`/orcamentos/${q.id}`} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-accent border-b border-border last:border-0">
            <div className="min-w-0">
              <div className="font-medium truncate">#{q.number} · {q.plate_snapshot}</div>
              <div className="text-xs text-muted-foreground">{formatDate(q.date)} · {formatCurrency(q.total)}</div>
            </div>
            <QuoteStatusBadge status={q.status} />
          </Link>
        ))}
      </Section>

      {/* Work orders history */}
      <Section title="Ordens de Serviço" icon={ClipboardList} count={workOrders.length}>
        {workOrders.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border last:border-0">
            <div className="min-w-0">
              <div className="font-medium truncate">#{w.number} · {w.plate_snapshot}</div>
              <div className="text-xs text-muted-foreground">{formatDate(w.entry_date)} · {formatCurrency(w.total)}</div>
            </div>
            <span className="text-xs text-muted-foreground capitalize">{w.status?.replace(/_/g, " ")}</span>
          </div>
        ))}
      </Section>

      {lastVisit && (
        <div className="text-xs text-muted-foreground px-1">Último atendimento: {formatDate(lastVisit)}</div>
      )}
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
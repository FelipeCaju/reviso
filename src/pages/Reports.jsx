import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, TrendingUp, ClipboardList, FileText, Package, Wrench, Users, Car,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { formatCurrency, formatDate, todayISO, addDaysISO, normalizePlate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899"];

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5, 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(todayISO());

  useEffect(() => {
    (async () => {
      try {
        const [o, q, m, s, c, v, a] = await Promise.all([
          base44.entities.WorkOrder.list("-entry_date", 200),
          base44.entities.Quote.list("-date", 200),
          base44.entities.Material.list("-updated_date", 200),
          base44.entities.Service.list("-updated_date", 200),
          base44.entities.Customer.list("-updated_date", 200),
          base44.entities.Vehicle.list("-updated_date", 200),
          base44.entities.Appointment.list("-updated_date", 200),
        ]);
        setOrders(o); setQuotes(q); setMaterials(m); setServices(s);
        setCustomers(c); setVehicles(v); setAppointments(a);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const inRange = (d) => {
    if (!d) return false;
    const dt = new Date(d);
    return dt >= new Date(startDate + "T00:00:00") && dt <= new Date(endDate + "T23:59:59");
  };

  const finished = orders.filter((w) => w.status === "finalizada" && inRange(w.completion_date || w.entry_date));
  const totalRevenue = finished.reduce((s, w) => s + (w.total || 0), 0);
  const avgTicket = finished.length ? totalRevenue / finished.length : 0;

  // Revenue per month (last 6)
  const monthRevenue = useMemo(() => {
    const map = {};
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T23:59:59");
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const key = cur.toLocaleDateString("pt-BR", { month: "short" });
      map[key] = 0;
      cur.setMonth(cur.getMonth() + 1);
    }
    finished.forEach((w) => {
      const d = new Date(w.completion_date || w.entry_date);
      const key = d.toLocaleDateString("pt-BR", { month: "short" });
      if (key in map) map[key] += w.total || 0;
    });
    return Object.entries(map).map(([month, value]) => ({ month, value: Math.round(value) }));
  }, [orders, startDate, endDate]);

  // OS status distribution
  const statusDist = useMemo(() => {
    const map = {};
    orders.forEach((w) => { map[w.status] = (map[w.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // Top services by frequency (from WorkOrderItems would be ideal; approximate from quotes)
  const topServices = useMemo(() => {
    const map = {};
    quotes.forEach((q) => {
      // count by quote as proxy
      map[q.status] = (map[q.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [quotes]);

  // Appointments per day (next 7)
  const weekAppts = useMemo(() => {
    const map = {};
    for (let i = 0; i < 7; i++) {
      const d = addDaysISO(i);
      map[d] = 0;
    }
    appointments.forEach((a) => {
      if (a.scheduled_date in map && !["cancelado", "nao_compareceu"].includes(a.status)) {
        map[a.scheduled_date]++;
      }
    });
    return Object.entries(map).map(([date, count]) => ({
      label: new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
      count,
    }));
  }, [appointments]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Performance geral da oficina</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi icon={TrendingUp} label="Faturamento Total" value={formatCurrency(totalRevenue)} />
        <Kpi icon={ClipboardList} label="OS Finalizadas" value={finished.length} />
        <Kpi icon={FileText} label="Ticket Médio" value={formatCurrency(avgTicket)} />
        <Kpi icon={Users} label="Clientes" value={customers.length} />
        <Kpi icon={Car} label="Veículos" value={vehicles.length} />
        <Kpi icon={Package} label="Materiais" value={materials.length} />
        <Kpi icon={Wrench} label="Serviços" value={services.length} />
        <Kpi icon={FileText} label="Orçamentos" value={quotes.length} />
      </div>

      {/* Revenue chart */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-medium mb-3">Faturamento por mês (OS finalizadas)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v / 1000}k`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* OS status */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium mb-3">OS por status</h2>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Appointments week */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium mb-3">Agendamentos — próximos 7 dias</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weekAppts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top customers by OS */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-medium mb-3">Top clientes por número de OS</h2>
          {(() => {
            const map = {};
            orders.forEach((w) => {
              const key = w.customer_name_snapshot || "—";
              map[key] = (map[key] || 0) + 1;
            });
            const top = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
            if (top.length === 0) return <div className="text-sm text-muted-foreground py-4 text-center">Sem dados.</div>;
            const max = top[0][1];
            return (
              <div className="space-y-2">
                {top.map(([name, count]) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className="text-sm w-40 truncate">{name}</div>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-primary/80 rounded" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <div className="text-sm font-medium w-8 text-right">{count}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg md:text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
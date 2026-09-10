import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ClipboardList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { WorkOrderStatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, normalizePlate, todayISO } from "@/lib/format";

export default function WorkOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.WorkOrder.list("-entry_date", 500);
        setOrders(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return orders.filter((w) => {
      if (statusFilter && w.status !== statusFilter) return false;
      if (!s) return true;
      return (
        (w.number || "").toLowerCase().includes(s) ||
        (w.customer_name_snapshot || "").toLowerCase().includes(s) ||
        normalizePlate(w.plate_snapshot || "").toLowerCase().includes(s) ||
        (w.vehicle_description_snapshot || "").toLowerCase().includes(s)
      );
    });
  }, [orders, q, statusFilter]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">{orders.length} no total</p>
        </div>
        <Button onClick={() => navigate("/os/novo")}>
          <Plus className="w-4 h-4 mr-2" /> Nova OS
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-10 h-11" placeholder="Buscar por número, cliente, placa..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <ClipboardList className="w-8 h-8 opacity-40" />
          Nenhuma ordem de serviço encontrada.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((w) => (
            <button
              key={w.id}
              onClick={() => navigate(`/os/${w.id}`)}
              className="w-full text-left rounded-xl border border-border bg-card p-3 hover:bg-accent transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">#{w.number}</div>
                <WorkOrderStatusBadge status={w.status} />
              </div>
              <div className="mt-1 text-sm font-medium truncate">{w.customer_name_snapshot}</div>
              <div className="text-xs text-muted-foreground truncate">
                {w.vehicle_description_snapshot} · {normalizePlate(w.plate_snapshot)}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDate(w.entry_date)}</span>
                <span className="font-medium text-foreground">{formatCurrency(w.total)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
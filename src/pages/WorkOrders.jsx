import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ClipboardList, Bell, CreditCard } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { WorkOrderStatusBadge } from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, normalizePlate, todayISO } from "@/lib/format";

const PAY_BADGE = {
  nao_pago: { label: "Não Pago", color: "bg-amber-100 text-amber-700" },
  parcialmente_pago: { label: "Parcial", color: "bg-orange-100 text-orange-700" },
  pago: { label: "Pago", color: "bg-emerald-100 text-emerald-700" },
  isento_cancelado: { label: "Isento", color: "bg-slate-100 text-slate-600" },
};

export default function WorkOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [notifiedFilter, setNotifiedFilter] = useState("");

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
      if (payFilter === "pago" && w.payment_status !== "pago") return false;
      if (payFilter === "nao_pago" && w.payment_status === "pago") return false;
      if (payFilter === "parcial" && w.payment_status !== "parcialmente_pago") return false;
      if (notifiedFilter === "sim" && !w.customer_notified) return false;
      if (notifiedFilter === "nao" && w.customer_notified) return false;
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

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status OS" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Todos status</SelectItem>
            <SelectItem value="aberta">Aberta</SelectItem>
            <SelectItem value="em_execucao">Em Execução</SelectItem>
            <SelectItem value="finalizada">Finalizada</SelectItem>
            <SelectItem value="pronta_retirada">Pronta Retirada</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={payFilter} onValueChange={setPayFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Pagamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Pagamento: todos</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="nao_pago">Não Pago</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
          </SelectContent>
        </Select>
        <Select value={notifiedFilter} onValueChange={setNotifiedFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Notificado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Notificação: todos</SelectItem>
            <SelectItem value="sim">Notificado</SelectItem>
            <SelectItem value="nao">Não Notificado</SelectItem>
          </SelectContent>
        </Select>
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
                <div className="flex items-center gap-1">
                  {w.customer_notified && <Bell className="w-3.5 h-3.5 text-blue-600" />}
                  <WorkOrderStatusBadge status={w.status} />
                </div>
              </div>
              <div className="mt-1 text-sm font-medium truncate">{w.customer_name_snapshot}</div>
              <div className="text-xs text-muted-foreground truncate">
                {w.vehicle_description_snapshot} · {normalizePlate(w.plate_snapshot)}
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{formatDate(w.entry_date)}</span>
                <div className="flex items-center gap-1.5">
                  {w.total > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PAY_BADGE[w.payment_status]?.color || "bg-slate-100"}`}>
                      {PAY_BADGE[w.payment_status]?.label || w.payment_status}
                    </span>
                  )}
                  <span className="text-sm font-medium text-foreground">{formatCurrency(w.total)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
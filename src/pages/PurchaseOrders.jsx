import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { markPurchaseOrderPaid } from "@/lib/finance";
import { toast } from "@/components/ui/use-toast";
import { receivePurchaseOrder } from "@/lib/inboundFiscal";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const STATUS_INFO = {
  rascunho: { label: "Rascunho", color: "bg-slate-100 text-slate-700" },
  pedido_realizado: { label: "Pedido Realizado", color: "bg-blue-100 text-blue-700" },
  parcialmente_recebido: { label: "Parcial Recebido", color: "bg-orange-100 text-orange-700" },
  recebido: { label: "Recebido", color: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

const PAY_STATUS = {
  nao_pago: { label: "Não Pago", color: "text-amber-600" },
  parcialmente_pago: { label: "Parcial", color: "text-orange-600" },
  pago: { label: "Pago", color: "text-emerald-600" },
  cancelado: { label: "Cancelado", color: "text-muted-foreground" },
};

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "outro", label: "Outro" },
];

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [payOpen, setPayOpen] = useState(null);
  const [payMethod, setPayMethod] = useState("dinheiro");
  const [payDate, setPayDate] = useState(formatDate(new Date()));

  const load = async () => {
    setLoading(true);
    try {
      const [data, allItems] = await Promise.all([
        base44.entities.PurchaseOrder.list("-date", 500),
        base44.entities.PurchaseOrderItem.list("-updated_date", 1000),
      ]);
      setOrders(data);
      setItems(allItems);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = orders.filter((o) => {
    const s = q.toLowerCase();
    return !s || (o.number || "").toLowerCase().includes(s) || (o.supplier_name_snapshot || "").toLowerCase().includes(s);
  });

  const markReceived = async (order) => {
    try {
      await receivePurchaseOrder(order.id);
      await load();
      toast({ title: "Pedido recebido e estoque movimentado" });
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const doPay = async () => {
    if (!payOpen) return;
    try {
      await markPurchaseOrderPaid(payOpen, payMethod, payDate);
      setPayOpen(null);
      await load();
      toast({ title: "Pedido marcado como pago" });
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Pedidos de Compra</h1>
          <p className="text-sm text-muted-foreground">{orders.length} no total</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar pedido..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <Package className="w-8 h-8 opacity-40" />
          Nenhum pedido de compra.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const orderItems = items.filter((i) => i.order_id === o.id);
            const isExpanded = expanded === o.id;
            return (
              <div key={o.id} className="rounded-xl border border-border bg-card p-3">
                <button
                  onClick={() => setExpanded(isExpanded ? null : o.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">Pedido #{o.number}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_INFO[o.status]?.color || "bg-slate-100"}`}>
                      {STATUS_INFO[o.status]?.label || o.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium truncate">{o.supplier_name_snapshot || "—"}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(o.date)} {o.expected_delivery ? `· Entrega: ${formatDate(o.expected_delivery)}` : ""}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">{formatCurrency(o.total)}</span>
                    <span className={`text-xs font-medium ${PAY_STATUS[o.payment_status]?.color}`}>
                      {PAY_STATUS[o.payment_status]?.label || o.payment_status}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-border space-y-2">
                    {orderItems.length > 0 && (
                      <div className="space-y-1">
                        {orderItems.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="truncate">{it.quantity}x {it.description}</span>
                            <span className="font-medium">{formatCurrency(it.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1.5 flex-wrap">
                      {o.status !== "recebido" && o.status !== "cancelado" && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => markReceived(o)}>
                          Marcar Recebido
                        </Button>
                      )}
                      {o.payment_status !== "pago" && o.payment_status !== "cancelado" && o.status !== "cancelado" && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setPayOpen(o)}>
                          Marcar Pago
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar Pedido como Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">Pedido #{payOpen?.number} — {payOpen?.supplier_name_snapshot} — {formatCurrency(payOpen?.total || 0)}</div>
            <div className="space-y-1.5">
              <Label>Forma de Pagamento</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data do Pagamento</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={doPay}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

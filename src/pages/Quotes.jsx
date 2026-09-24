import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, FileText, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { withWorkshop } from "@/lib/workshop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { QuoteStatusBadge, QuoteWhatsAppSentBadge } from "@/components/StatusBadge";
import { normalizePlate, formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunhos" },
  { value: "aguardando_aprovacao", label: "Aguardando Aprovação" },
  { value: "aprovado", label: "Aprovados" },
  { value: "parcialmente_aprovado", label: "Parciais" },
  { value: "aguardando_agendamento", label: "Aguardando Agendamento" },
  { value: "agendado", label: "Agendados" },
  { value: "recusado", label: "Recusados" },
  { value: "cancelado", label: "Cancelados" },
];

export default function Quotes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(searchParams.get("status") || "todos");
  const [actionQuote, setActionQuote] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await base44.entities.Quote.list("-date", 500));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createWorkOrder = async (quote) => {
    const existing = await base44.entities.WorkOrder.filter({ quote_id: quote.id }, "-created_date", 1);
    if (existing[0]) return existing[0];

    const [quoteItems, workOrders] = await Promise.all([
      base44.entities.QuoteItem.filter({ quote_id: quote.id }, "-updated_date", 300),
      base44.entities.WorkOrder.list("-created_date", 500),
    ]);
    const numbers = workOrders.map((order) => parseInt((order.number || "0").replace(/\D/g, ""), 10)).filter(Number.isFinite);
    const number = String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(5, "0");
    const order = await base44.entities.WorkOrder.create(withWorkshop({
      number,
      customer_id: quote.customer_id,
      customer_name_snapshot: quote.customer_name_snapshot,
      vehicle_id: quote.vehicle_id,
      plate_snapshot: quote.plate_snapshot,
      vehicle_description_snapshot: quote.vehicle_description_snapshot,
      mileage_in: quote.mileage || 0,
      entry_date: new Date().toISOString(),
      expected_delivery: quote.forecast || "",
      customer_report: quote.customer_report || "",
      diagnosis: quote.diagnosis || "",
      internal_notes: quote.notes || "",
      status: "aberta",
      subtotal_parts: quote.subtotal_parts || 0,
      subtotal_labor: quote.subtotal_labor || 0,
      socorro: quote.socorro || 0,
      discount: quote.discount || 0,
      total: quote.total || 0,
      quote_id: quote.id,
    }));
    if (quoteItems.length) {
      await base44.entities.WorkOrderItem.bulkCreate(quoteItems.map((item) => withWorkshop({
        type: item.type, description: item.description, quantity: item.quantity, unit: item.unit || "un",
        unit_price: item.unit_price, discount: item.discount, total: item.total,
        material_id: item.material_id || "", service_id: item.service_id || "",
        added_after_approval: false, approval_status: "aprovado", work_order_id: order.id,
      })));
    }
    return order;
  };

  const approve = async () => {
    if (!actionQuote?.quote) return;
    setProcessing(true);
    try {
      const quote = actionQuote.quote;
      const order = await createWorkOrder(quote);
      await base44.entities.Quote.update(quote.id, {
        status: "convertido_os", approval_date: new Date().toISOString(),
        approval_method: quote.whatsapp_sent_at ? "whatsapp" : "email",
        approval_notes: "Aprovado pelo cliente e convertido em Ordem de Serviço.", work_order_id: order.id,
      });
      toast({ title: `Orçamento aprovado — OS #${order.number} criada.` });
      setActionQuote(null);
      navigate(`/os/${order.id}`);
    } catch (error) {
      toast({ title: "Erro ao criar a Ordem de Serviço", description: error.message, variant: "destructive" });
    } finally { setProcessing(false); }
  };

  const reject = async () => {
    if (!actionQuote?.quote) return;
    setProcessing(true);
    try {
      const quote = actionQuote.quote;
      await base44.entities.Quote.update(quote.id, {
        status: "recusado", approval_date: new Date().toISOString(),
        approval_method: quote.whatsapp_sent_at ? "whatsapp" : "email", approval_notes: rejectReason,
      });
      setItems((current) => current.map((item) => item.id === quote.id ? { ...item, status: "recusado", approval_notes: rejectReason } : item));
      toast({ title: "Orçamento reprovado" });
      setActionQuote(null); setRejectReason("");
    } catch (error) {
      toast({ title: "Erro ao reprovar orçamento", description: error.message, variant: "destructive" });
    } finally { setProcessing(false); }
  };

  const filtered = items.filter((it) => {
    const s = q.toLowerCase();
    const matchQ = !s || (it.number || "").toLowerCase().includes(s) ||
      normalizePlate(it.plate_snapshot).toLowerCase().includes(s) ||
      (it.customer_name_snapshot || "").toLowerCase().includes(s);
    const matchF = filter === "todos" || it.status === filter;
    return matchQ && matchF;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">{items.length} no total</p>
        </div>
        <Button onClick={() => navigate("/orcamentos/novo")} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Novo
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar nº, placa, cliente..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum orçamento encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((it) => {
            const canDecide = (it.whatsapp_sent_at || it.email_sent_at) && !["convertido_os", "recusado", "cancelado"].includes(it.status);
            return (
            <div
              key={it.id}
              className="w-full text-left rounded-xl border border-border bg-card p-3 hover:bg-accent transition"
            >
              <div onClick={() => navigate(`/orcamentos/${it.id}`)} className="cursor-pointer">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">#{it.number}</div>
                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                  {it.whatsapp_sent_at && <QuoteWhatsAppSentBadge />}
                  <QuoteStatusBadge status={it.status} />
                </div>
              </div>
              <div className="mt-1 text-sm font-medium truncate">{it.customer_name_snapshot || "—"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {it.vehicle_description_snapshot} · {normalizePlate(it.plate_snapshot)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{formatDate(it.date)}</div>
              </div>
              {canDecide && (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8" onClick={() => setActionQuote({ type: "approve", quote: it })}><Check className="mr-1 h-3.5 w-3.5" />Aprovar</Button>
                    <Button size="sm" variant="destructive" className="h-8" onClick={() => setActionQuote({ type: "reject", quote: it })}><X className="mr-1 h-3.5 w-3.5" />Reprovar</Button>
                  </div>
                  <span className="text-xs font-medium text-foreground">{formatCurrency(it.total)}</span>
                </div>
              )}
              {!canDecide && <div className="mt-1 text-right text-xs font-medium text-foreground">{formatCurrency(it.total)}</div>}
            </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!actionQuote} onOpenChange={(open) => !open && setActionQuote(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{actionQuote?.type === "approve" ? "Aprovar orçamento" : "Reprovar orçamento"}</DialogTitle></DialogHeader>
          {actionQuote?.type === "approve" ? (
            <p className="text-sm text-muted-foreground">Ao confirmar, o orçamento será aprovado e uma Ordem de Serviço com os mesmos itens será criada automaticamente.</p>
          ) : (
            <div className="space-y-2"><Label>Motivo da reprovação <span className="text-muted-foreground">(opcional)</span></Label><Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Ex.: cliente optou por não realizar o serviço" /></div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionQuote(null)}>Cancelar</Button>
            <Button variant={actionQuote?.type === "approve" ? "default" : "destructive"} onClick={actionQuote?.type === "approve" ? approve : reject} disabled={processing}>{actionQuote?.type === "approve" ? "Aprovar e criar OS" : "Confirmar reprovação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

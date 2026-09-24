import { useEffect, useState } from "react";
import { CreditCard, Plus, X, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CurrencyInput from "@/components/CurrencyInput";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { formatCurrency, formatDateTime, todayISO } from "@/lib/format";
import { registerOSPayment, cancelOSPayment, calcPaymentStatus } from "@/lib/finance";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
];

const PAY_STATUS_INFO = {
  nao_pago: { label: "Não Pago", color: "bg-amber-100 text-amber-700" },
  parcialmente_pago: { label: "Parcialmente Pago", color: "bg-orange-100 text-orange-700" },
  pago: { label: "Pago", color: "bg-emerald-100 text-emerald-700" },
  isento_cancelado: { label: "Isento/Cancelado", color: "bg-slate-100 text-slate-600" },
};

export default function OSPayments({ workOrderId, wo, total, onPaymentsChange, onWorkOrderUpdate }) {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("dinheiro");
  const [payDate, setPayDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = async () => {
    if (!workOrderId) return;
    setLoading(true);
    try {
      const data = await base44.entities.Payment.filter({ work_order_id: workOrderId }, "-date", 100);
      setPayments(data);
      onPaymentsChange?.(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [workOrderId]);

  const liveTotal = total != null ? total : (wo?.total || 0);
  const { status: payStatus, paid, balance } = calcPaymentStatus(liveTotal, payments);

  const addPayment = async () => {
    if (!amount || amount <= 0) return;
    setSaving(true);
    try {
      await registerOSPayment({
        workOrderId,
        amount,
        method,
        date: new Date(payDate).toISOString(),
        notes,
        user,
        wo,
      });
      // Update WO payment status
      const newPaid = paid + amount;
      const newStatus = newPaid >= liveTotal ? "pago" : "parcialmente_pago";
      await base44.entities.WorkOrder.update(workOrderId, {
        payment_status: newStatus,
        paid_amount: newPaid,
      });
      onWorkOrderUpdate?.({ payment_status: newStatus, paid_amount: newPaid });
      setOpen(false);
      setAmount(0); setNotes("");
      await load();
      toast({ title: "Pagamento registrado" });
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const doCancel = async () => {
    if (!cancelOpen) return;
    try {
      await cancelOSPayment(cancelOpen, cancelReason, user);
      // Recalculate WO payment status
      const remaining = payments.filter((p) => p.id !== cancelOpen.id && p.status === "ativo");
      const newPaid = remaining.reduce((s, p) => s + (p.amount || 0), 0);
      const newStatus = newPaid >= liveTotal ? "pago" : newPaid > 0 ? "parcialmente_pago" : "nao_pago";
      await base44.entities.WorkOrder.update(workOrderId, {
        payment_status: newStatus,
        paid_amount: newPaid,
      });
      onWorkOrderUpdate?.({ payment_status: newStatus, paid_amount: newPaid });
      setCancelOpen(null);
      setCancelReason("");
      await load();
      toast({ title: "Pagamento cancelado (estornado)" });
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-sm flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Pagamentos
        </h2>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PAY_STATUS_INFO[payStatus]?.color}`}>
          {PAY_STATUS_INFO[payStatus]?.label || payStatus}
        </span>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="font-semibold">{formatCurrency(liveTotal)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Pago</div>
          <div className="font-semibold text-emerald-600">{formatCurrency(paid)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Saldo</div>
          <div className="font-semibold text-amber-600">{formatCurrency(balance)}</div>
        </div>
      </div>

      {/* Lista de pagamentos */}
      {payments.length > 0 && (
        <div className="space-y-1.5">
          {payments.map((p) => (
            <div key={p.id} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${p.status === "cancelado" ? "bg-red-50/50 line-through opacity-60" : "bg-accent/30"}`}>
              <div className="min-w-0">
                <div className="font-medium">{formatCurrency(p.amount)} — {PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method}</div>
                <div className="text-xs text-muted-foreground">{formatDateTime(p.date)} {p.registered_by ? `· ${p.registered_by}` : ""}</div>
                {p.status === "cancelado" && <div className="text-xs text-red-600">Cancelado: {p.cancel_reason || "—"}</div>}
              </div>
              {p.status === "ativo" && (
                <button onClick={() => setCancelOpen(p)} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full h-11" onClick={() => { setPayDate(todayISO()); setOpen(true); }} disabled={balance <= 0.01 && payStatus === "pago"}>
        <Plus className="w-4 h-4 mr-2" /> Registrar Pagamento
      </Button>

      {/* Add payment dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Saldo pendente: {formatCurrency(balance)}</div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <CurrencyInput value={amount} onValueChange={setAmount} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de Pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.slice(0, 4).map((item) => (
                  <Button key={item.value} type="button" variant={method === item.value ? "default" : "outline"} className="h-10 text-xs" onClick={() => setMethod(item.value)}>
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Data do Pagamento</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={addPayment} disabled={saving || !amount}>
              {saving ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={!!cancelOpen} onOpenChange={(o) => !o && setCancelOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar / Estornar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>O pagamento será cancelado (estornado), mas o histórico será preservado.</span>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo do Cancelamento</Label>
              <Textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex: lançado por engano" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Voltar</Button></DialogClose>
            <Button variant="destructive" onClick={doCancel}>Confirmar Cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

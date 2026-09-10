import { useEffect, useState } from "react";
import { Plus, Pencil, Search, Receipt, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { withWorkshop } from "@/lib/workshop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { markExpensePaid } from "@/lib/finance";
import { toast } from "@/components/ui/use-toast";

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "outro", label: "Outro" },
];

const EMPTY = {
  description: "", category: "", supplier_id: "", beneficiary: "", amount: 0,
  date: todayISO(), due_date: "", payment_date: "", status: "pendente",
  payment_method: "", notes: "", type: "eventual", is_recurring: false,
  recurrence_period: "mensal", recurrence_day: 1, recurrence_start: todayISO(), recurrence_end: "",
};

export default function Expenses() {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [payOpen, setPayOpen] = useState(null);
  const [payMethod, setPayMethod] = useState("dinheiro");
  const [payDate, setPayDate] = useState(todayISO());

  const load = async () => {
    setLoading(true);
    try {
      const [data, sups, sl] = await Promise.all([
        base44.entities.Expense.list("-date", 500),
        base44.entities.Supplier.list("-updated_date", 500),
        base44.entities.WorkshopSetting.list("-updated_date", 1),
      ]);
      setItems(data);
      setSuppliers(sups);
      setSettings(sl[0] || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const categories = settings?.expense_categories || ["Água", "Energia", "Internet", "Aluguel", "Funcionários", "Impostos", "Contabilidade", "Material de limpeza", "Combustível", "Ferramentas", "Manutenção", "Alimentação", "Compras", "Outros"];

  // Separar templates recorrentes das instâncias geradas
  const recurringTemplates = items.filter((e) => e.is_recurring);
  const regularExpenses = items.filter((e) => !e.is_recurring);

  const filtered = regularExpenses.filter((e) => {
    const s = q.toLowerCase();
    if (statusFilter && e.status !== statusFilter) return false;
    if (typeFilter && e.type !== typeFilter) return false;
    if (!s) return true;
    return (e.description || "").toLowerCase().includes(s) || (e.category || "").toLowerCase().includes(s) || (e.beneficiary || "").toLowerCase().includes(s);
  });

  const openNew = () => { setForm(EMPTY); setEditingId(null); setOpen(true); };
  const openEdit = (e) => { setForm({ ...e }); setEditingId(e.id); setOpen(true); };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    try {
      const payload = { ...form, month_key: form.is_recurring ? "" : (form.date || todayISO()).slice(0, 7) };
      if (editingId) await base44.entities.Expense.update(editingId, payload);
      else await base44.entities.Expense.create(withWorkshop(payload));
      setOpen(false);
      await load();
      toast({ title: "Despesa salva" });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const doMarkPaid = async () => {
    if (!payOpen) return;
    try {
      await markExpensePaid(payOpen, payMethod, payDate);
      setPayOpen(null);
      await load();
      toast({ title: "Despesa marcada como paga" });
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const totalGeral = filtered.filter((e) => e.status === "pago").reduce((s, e) => s + (e.amount || 0), 0);
  const totalPendente = filtered.filter((e) => e.status === "pendente").reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Despesas</h1>
          <p className="text-sm text-muted-foreground">Pago: {formatCurrency(totalGeral)} · Pendente: {formatCurrency(totalPendente)}</p>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Nova
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Todos</SelectItem>
            <SelectItem value="fixa">Fixa</SelectItem>
            <SelectItem value="eventual">Eventual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Despesas recorrentes (templates) */}
      {recurringTemplates.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
          <div className="text-sm font-medium text-blue-900">Despesas Recorrentes (modelos)</div>
          <div className="space-y-1.5">
            {recurringTemplates.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-card p-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{e.description}</div>
                  <div className="text-xs text-muted-foreground">{e.category} · {e.recurrence_period} · venc. dia {e.recurrence_day}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-sm font-medium">{formatCurrency(e.amount)}</div>
                  <button onClick={() => openEdit(e)} className="p-1 rounded hover:bg-accent"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma despesa encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <div key={e.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{e.description}</span>
                    {e.type === "fixa" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">FIXA</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[e.category, e.beneficiary].filter(Boolean).join(" · ") || "—"}
                    {" · "}
                    {formatDate(e.date)}
                    {e.due_date && ` · Venc: ${formatDate(e.due_date)}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold">{formatCurrency(e.amount)}</div>
                  <div className={`text-xs ${e.status === "pago" ? "text-emerald-600" : e.status === "vencido" ? "text-red-600" : e.status === "cancelado" ? "text-muted-foreground" : "text-amber-600"}`}>
                    {e.status}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2">
                {e.status === "pendente" && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => { setPayOpen(e); setPayDate(todayISO()); }}>
                    Marcar Paga
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-8" onClick={() => openEdit(e)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Beneficiário</Label>
                <Input value={form.beneficiary} onChange={(e) => set("beneficiary", e.target.value)} placeholder="Nome ou fornecedor" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vencimento</Label>
                <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={form.is_recurring} onCheckedChange={(v) => set("is_recurring", v)} />
              <Label className="cursor-pointer" onClick={() => set("is_recurring", !form.is_recurring)}>Despesa recorrente (gera instâncias mensais)</Label>
            </div>
            {form.is_recurring && (
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-accent/30 p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Periodicidade</Label>
                  <Select value={form.recurrence_period} onValueChange={(v) => set("recurrence_period", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dia Venc.</Label>
                  <Input type="number" value={form.recurrence_day} onChange={(e) => set("recurrence_day", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Início</Label>
                  <Input type="date" value={form.recurrence_start} onChange={(e) => set("recurrence_start", e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={save} disabled={saving || !form.description.trim() || !form.amount}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como Paga</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">{payOpen?.description} — {formatCurrency(payOpen?.amount || 0)}</div>
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
            <Button onClick={doMarkPaid}>Confirmar Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
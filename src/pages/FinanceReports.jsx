import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, TrendingUp, TrendingDown, FileText, Truck, Receipt, ClipboardList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = ["#f59e0b", "#10b981", "#06b6d4", "#6366f1", "#ec4899", "#8b5cf6", "#ef4444"];

const PERIODS = [
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
];

function getPeriodRange(period) {
  const now = new Date();
  const start = new Date(now);
  if (period === "mes") { start.setDate(1); start.setHours(0, 0, 0, 0); }
  else if (period === "ano") { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
  return { start, end: now };
}

export default function FinanceReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("mes");
  const [transactions, setTransactions] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [tx, wo, q, po, exp, pays, sups] = await Promise.all([
          base44.entities.FinancialTransaction.list("-date", 2000),
          base44.entities.WorkOrder.list("-entry_date", 500),
          base44.entities.Quote.list("-date", 500),
          base44.entities.PurchaseOrder.list("-date", 500),
          base44.entities.Expense.list("-date", 500),
          base44.entities.Payment.list("-date", 500),
          base44.entities.Supplier.list("-updated_date", 500),
        ]);
        setTransactions(tx); setWorkOrders(wo); setQuotes(q); setOrders(po);
        setExpenses(exp); setPayments(pays); setSuppliers(sups);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { start, end } = getPeriodRange(period);
  const inRange = (d) => { const dt = new Date(d); return dt >= start && dt <= end; };

  // Financial summary
  const activeTx = transactions.filter((t) => t.status === "ativo" && inRange(t.date));
  const entradas = activeTx.filter((t) => t.type === "entrada");
  const saidas = activeTx.filter((t) => t.type === "saida");
  const totalEntradas = entradas.reduce((s, t) => s + (t.amount || 0), 0);
  const totalSaidas = saidas.reduce((s, t) => s + (t.amount || 0), 0);
  const saldo = totalEntradas - totalSaidas;

  // OS report
  const woInPeriod = workOrders.filter((w) => inRange(w.entry_date));
  const woFinished = woInPeriod.filter((w) => w.status === "finalizada" || w.status === "pronta_retirada" || w.status === "entregue");
  const woTotal = woInPeriod.reduce((s, w) => s + (w.total || 0), 0);
  const woPaid = woInPeriod.reduce((s, w) => s + (w.paid_amount || 0), 0);
  const woPending = woTotal - woPaid;
  const woSocorro = woInPeriod.reduce((s, w) => s + (w.socorro || 0), 0);
  const woParts = woInPeriod.reduce((s, w) => s + (w.subtotal_parts || 0), 0);
  const woLabor = woInPeriod.reduce((s, w) => s + (w.subtotal_labor || 0), 0);

  // Quote report
  const quotesInPeriod = quotes.filter((q) => inRange(q.date));
  const quotesApproved = quotesInPeriod.filter((q) => q.status === "aprovado" || q.status === "parcialmente_aprovado");
  const quotesConverted = quotesInPeriod.filter((q) => q.status === "convertido_os");
  const quotesRejected = quotesInPeriod.filter((q) => q.status === "recusado");
  const quotesWaiting = quotesInPeriod.filter((q) => q.status === "aguardando_aprovacao");
  const quotesWaitingSched = quotesInPeriod.filter((q) => q.status === "aprovado" || q.status === "aguardando_agendamento");
  const quotesTotal = quotesInPeriod.reduce((s, q) => s + (q.total || 0), 0);
  const conversionRate = quotesInPeriod.length ? (quotesConverted.length / quotesInPeriod.length) * 100 : 0;

  // Supplier report
  const ordersBySupplier = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const key = o.supplier_id || "none";
      if (!map[key]) map[key] = { supplier_id: key, name: o.supplier_name_snapshot || "—", count: 0, total: 0, paid: 0, pending: 0 };
      map[key].count++;
      map[key].total += o.total || 0;
      if (o.payment_status === "pago") map[key].paid += o.total || 0;
      else if (o.payment_status !== "cancelado") map[key].pending += o.total || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [orders]);

  // Expense report
  const expensesInPeriod = expenses.filter((e) => inRange(e.date) && e.status !== "cancelado");
  const expensesPaid = expensesInPeriod.filter((e) => e.status === "pago");
  const expensesTotal = expensesPaid.reduce((s, e) => s + (e.amount || 0), 0);
  const expensesFixas = expensesPaid.filter((e) => e.type === "fixa").reduce((s, e) => s + (e.amount || 0), 0);
  const expensesEventuais = expensesPaid.filter((e) => e.type === "eventual").reduce((s, e) => s + (e.amount || 0), 0);
  const expensesByCategory = useMemo(() => {
    const map = {};
    expensesPaid.forEach((e) => {
      const cat = e.category || "Outros";
      map[cat] = (map[cat] || 0) + (e.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expensesPaid]);

  // Entradas por forma de pagamento (pie)
  const entradasByMethod = useMemo(() => {
    const map = {};
    const labels = { dinheiro: "Dinheiro", pix: "Pix", cartao_debito: "Cartão Déb.", cartao_credito: "Cartão Créd.", outro: "Outro" };
    entradas.forEach((t) => {
      const key = labels[t.payment_method] || "Outro";
      map[key] = (map[key] || 0) + (t.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [entradas]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Relatórios Financeiros</h1>
          <p className="text-sm text-muted-foreground">Análise gerencial do período</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${period === p.value ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2 text-emerald-700"><TrendingUp className="w-4 h-4" /><span className="text-sm font-medium">Entradas</span></div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(totalEntradas)}</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <div className="flex items-center gap-2 text-red-700"><TrendingDown className="w-4 h-4" /><span className="text-sm font-medium">Saídas</span></div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(totalSaidas)}</div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /><span className="text-sm font-medium">Saldo Operacional</span></div>
          <div className={`text-2xl font-bold mt-1 ${saldo >= 0 ? "text-primary" : "text-amber-600"}`}>{formatCurrency(saldo)}</div>
        </div>
      </div>

      {/* Entradas por forma de pagamento */}
      {entradasByMethod.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium mb-3">Entradas por Forma de Pagamento</h2>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={entradasByMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {entradasByMethod.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Relatório de OS */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-medium flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Relatório de Ordens de Serviço</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><div className="text-xs text-muted-foreground">Qtd OS</div><div className="text-lg font-bold">{woInPeriod.length}</div></div>
            <div><div className="text-xs text-muted-foreground">Valor Total</div><div className="text-lg font-bold">{formatCurrency(woTotal)}</div></div>
            <div><div className="text-xs text-muted-foreground">Recebido</div><div className="text-lg font-bold text-emerald-600">{formatCurrency(woPaid)}</div></div>
            <div><div className="text-xs text-muted-foreground">Pendente</div><div className="text-lg font-bold text-amber-600">{formatCurrency(woPending)}</div></div>
            <div><div className="text-xs text-muted-foreground">Socorro</div><div className="text-sm font-medium">{formatCurrency(woSocorro)}</div></div>
            <div><div className="text-xs text-muted-foreground">Peças</div><div className="text-sm font-medium">{formatCurrency(woParts)}</div></div>
            <div><div className="text-xs text-muted-foreground">Mão de Obra</div><div className="text-sm font-medium">{formatCurrency(woLabor)}</div></div>
          </div>
        </CardContent>
      </Card>

      {/* Relatório de Orçamentos */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4" /> Relatório de Orçamentos</h2>
          <div className="text-xs text-muted-foreground">Valores de orçamento são PREVISÃO/POTENCIAL — não receita efetiva.</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><div className="text-xs text-muted-foreground">Criados</div><div className="text-lg font-bold">{quotesInPeriod.length}</div></div>
            <div><div className="text-xs text-muted-foreground">Valor Orçado</div><div className="text-lg font-bold">{formatCurrency(quotesTotal)}</div></div>
            <div><div className="text-xs text-muted-foreground">Aprovados</div><div className="text-sm font-medium text-emerald-600">{quotesApproved.length}</div></div>
            <div><div className="text-xs text-muted-foreground">Convertidos</div><div className="text-sm font-medium text-primary">{quotesConverted.length}</div></div>
            <div><div className="text-xs text-muted-foreground">Recusados</div><div className="text-sm font-medium text-red-600">{quotesRejected.length}</div></div>
            <div><div className="text-xs text-muted-foreground">Aguardando</div><div className="text-sm font-medium text-amber-600">{quotesWaiting.length}</div></div>
            <div><div className="text-xs text-muted-foreground">Aguard. Agend.</div><div className="text-sm font-medium">{quotesWaitingSched.length}</div></div>
            <div><div className="text-xs text-muted-foreground">Taxa Conversão</div><div className="text-sm font-bold">{conversionRate.toFixed(1)}%</div></div>
          </div>
        </CardContent>
      </Card>

      {/* Relatório de Fornecedores */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-medium flex items-center gap-2"><Truck className="w-4 h-4" /> Relatório de Fornecedores</h2>
          {ordersBySupplier.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">Sem compras registradas.</div>
          ) : (
            <div className="space-y-1.5">
              {ordersBySupplier.slice(0, 10).map((s) => (
                <div key={s.supplier_id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.count} pedido(s) · Pago: {formatCurrency(s.paid)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{formatCurrency(s.total)}</div>
                    {s.pending > 0 && <div className="text-xs text-amber-600">Pendente: {formatCurrency(s.pending)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relatório de Despesas */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-medium flex items-center gap-2"><Receipt className="w-4 h-4" /> Relatório de Despesas</h2>
          <div className="grid grid-cols-3 gap-3">
            <div><div className="text-xs text-muted-foreground">Total Pago</div><div className="text-lg font-bold">{formatCurrency(expensesTotal)}</div></div>
            <div><div className="text-xs text-muted-foreground">Fixas</div><div className="text-sm font-medium">{formatCurrency(expensesFixas)}</div></div>
            <div><div className="text-xs text-muted-foreground">Eventuais</div><div className="text-sm font-medium">{formatCurrency(expensesEventuais)}</div></div>
          </div>
          {expensesByCategory.length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-muted-foreground mb-2">Principais categorias:</div>
              <div className="space-y-1">
                {expensesByCategory.slice(0, 6).map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="font-medium">{formatCurrency(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
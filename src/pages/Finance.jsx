import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { generateRecurringExpenses } from "@/lib/finance";

const PERIODS = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
  { value: "personalizado", label: "Personalizado" },
];

function getPeriodRange(period) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  if (period === "hoje") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "semana") {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (period === "mes") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === "ano") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

export default function Finance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("mes");
  const [transactions, setTransactions] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filterScope, setFilterScope] = useState("cliente");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [customStart, setCustomStart] = useState(todayISO());
  const [customEnd, setCustomEnd] = useState(todayISO());

  useEffect(() => {
    (async () => {
      try {
        // Gerar despesas recorrentes do mês atual
        await generateRecurringExpenses();

        const [tx, wo, exp, pays, custs, sups] = await Promise.all([
          base44.entities.FinancialTransaction.list("-date", 1000),
          base44.entities.WorkOrder.list("-entry_date", 500),
          base44.entities.Expense.list("-date", 500),
          base44.entities.Payment.list("-date", 500),
          base44.entities.Customer.list("-updated_date", 500),
          base44.entities.Supplier.list("-updated_date", 500),
        ]);
        setTransactions(tx);
        setWorkOrders(wo);
        setExpenses(exp);
        setPayments(pays);
        setCustomers(custs);
        setSuppliers(sups);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { start, end } = period === "personalizado"
    ? { start: new Date(customStart + "T00:00:00"), end: new Date(customEnd + "T23:59:59") }
    : getPeriodRange(period);

  const inRange = (dateStr) => {
    const d = new Date(dateStr);
    return d >= start && d <= end;
  };

  const activeTx = transactions.filter((t) => {
    if (t.status !== "ativo" || !inRange(t.date)) return false;
    if (filterScope === "cliente") {
      if (!t.customer_id || (filterCustomer && t.customer_id !== filterCustomer)) return false;
    } else if (!t.supplier_id || (filterSupplier && t.supplier_id !== filterSupplier)) return false;
    return true;
  });
  const entradas = activeTx.filter((t) => t.type === "entrada");
  const saidas = activeTx.filter((t) => t.type === "saida");
  const totalEntradas = entradas.reduce((s, t) => s + (t.amount || 0), 0);
  const totalSaidas = saidas.reduce((s, t) => s + (t.amount || 0), 0);
  const saldo = totalEntradas - totalSaidas;

  // Breakdown por forma de pagamento (entradas)
  const byMethod = useMemo(() => {
    const map = {};
    entradas.forEach((t) => {
      const key = t.payment_method || "outro";
      map[key] = (map[key] || 0) + (t.amount || 0);
    });
    return map;
  }, [entradas]);

  // Saídas por fornecedor na consulta de fornecedores; por origem nas demais consultas.
  const saidasDetalhadas = useMemo(() => {
    const map = {};
    saidas.forEach((t) => {
      const key = filterScope === "fornecedor"
        ? suppliers.find((supplier) => supplier.id === t.supplier_id)?.name || t.supplier_name_snapshot || "Fornecedor"
        : t.origin_type || "outro";
      map[key] = (map[key] || 0) + (t.amount || 0);
    });
    return map;
  }, [saidas, filterScope, suppliers]);

  // A receber: OS com saldo pendente
  const aReceber = useMemo(() => {
    return workOrders
      .filter((w) => w.total > 0 && w.payment_status !== "pago" && w.payment_status !== "isento_cancelado" && w.status !== "cancelada" && (!filterCustomer || w.customer_id === filterCustomer))
      .map((w) => {
        const woPayments = payments.filter((p) => p.work_order_id === w.id && p.status === "ativo");
        const paid = woPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const balance = (w.total || 0) - paid;
        return { ...w, paid, balance };
      })
      .filter((w) => w.balance > 0.01);
  }, [workOrders, payments, filterCustomer]);

  const totalAReceber = aReceber.reduce((s, w) => s + w.balance, 0);

  // A pagar: despesas pendentes + pedidos não pagos
  const despesasPendentes = filterScope === "fornecedor"
    ? expenses.filter((e) => (e.status === "pendente" || e.status === "vencido") && e.supplier_id && (!filterSupplier || e.supplier_id === filterSupplier))
    : [];
  const totalAPagar = despesasPendentes.reduce((s, e) => s + (e.amount || 0), 0);

  const methodLabels = { dinheiro: "Dinheiro", pix: "Pix", cartao_debito: "Cartão Débito", cartao_credito: "Cartão Crédito", outro: "Outro" };
  const originLabels = { os: "OS / Clientes", pedido: "Fornecedores", despesa: "Despesas", outro: "Outros" };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Controle gerencial da oficina</p>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 items-center">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${period === p.value ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-accent"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range + filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {period === "personalizado" && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">De</label>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Até</label>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-9" />
            </div>
          </>
        )}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Consultar por</label>
          <div className="flex h-9 rounded-md border border-input p-0.5">
            <button type="button" onClick={() => { setFilterScope("cliente"); setFilterSupplier(""); }} className={`flex-1 rounded text-xs font-medium ${filterScope === "cliente" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>Cliente</button>
            <button type="button" onClick={() => { setFilterScope("fornecedor"); setFilterCustomer(""); }} className={`flex-1 rounded text-xs font-medium ${filterScope === "fornecedor" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>Fornecedor</button>
          </div>
        </div>
        {filterScope === "cliente" ? (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Cliente</label>
            <Select value={filterCustomer || "todos"} onValueChange={(v) => setFilterCustomer(v === "todos" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todos clientes" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos clientes</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Fornecedor</label>
            <Select value={filterSupplier || "todos"} onValueChange={(v) => setFilterSupplier(v === "todos" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todos fornecedores" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos fornecedores</SelectItem>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Resumo principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">Entradas</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-700">{formatCurrency(totalEntradas)}</div>
          <div className="text-xs text-muted-foreground mt-1">{entradas.length} recebimentos</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <div className="flex items-center gap-2 text-red-700">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm font-medium">Saídas</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-red-700">{formatCurrency(totalSaidas)}</div>
          <div className="text-xs text-muted-foreground mt-1">{saidas.length} pagamentos</div>
        </div>
        <div className={`rounded-xl border p-4 ${saldo >= 0 ? "border-primary/30 bg-primary/5" : "border-amber-300 bg-amber-50/50"}`}>
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">Saldo do Período</span>
          </div>
          <div className={`text-2xl font-bold mt-1 ${saldo >= 0 ? "text-primary" : "text-amber-700"}`}>{formatCurrency(saldo)}</div>
          <div className="text-xs text-muted-foreground mt-1">Resultado operacional</div>
        </div>
      </div>

      {/* A receber e A pagar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium">A Receber</span>
            </div>
            <span className="text-lg font-bold text-emerald-600">{formatCurrency(totalAReceber)}</span>
          </div>
          {aReceber.length === 0 ? (
            <div className="text-sm text-muted-foreground py-3 text-center">Nada a receber.</div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {aReceber.slice(0, 8).map((w) => (
                <button key={w.id} onClick={() => navigate(`/os/${w.id}`)} className="flex w-full items-center justify-between gap-2 text-left py-1.5 hover:bg-accent/30 rounded px-2 -mx-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">#{w.number} · {w.customer_name_snapshot}</div>
                    <div className="text-xs text-muted-foreground">Total: {formatCurrency(w.total)} · Pago: {formatCurrency(w.paid)}</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-600 shrink-0">{formatCurrency(w.balance)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium">A Pagar</span>
            </div>
            <span className="text-lg font-bold text-red-600">{formatCurrency(totalAPagar)}</span>
          </div>
          {despesasPendentes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-3 text-center">Nada a pagar.</div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {despesasPendentes.slice(0, 8).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{e.description}</div>
                    <div className="text-xs text-muted-foreground">{e.category} {e.due_date ? `· Venc: ${formatDate(e.due_date)}` : ""}</div>
                  </div>
                  <div className="text-sm font-semibold text-red-600 shrink-0">{formatCurrency(e.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detalhamento de entradas por forma de pagamento */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-sm font-medium">Entradas por Forma de Pagamento</h2>
          {Object.keys(byMethod).length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">Sem recebimentos no período.</div>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([method, value]) => (
                <div key={method} className="flex items-center justify-between gap-2">
                  <span className="text-sm">{methodLabels[method] || method}</span>
                  <span className="text-sm font-medium">{formatCurrency(value)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalhamento de saídas */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-sm font-medium">{filterScope === "fornecedor" ? "Saídas por Fornecedor" : "Saídas por Origem"}</h2>
          {Object.keys(saidasDetalhadas).length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">Sem saídas no período.</div>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(saidasDetalhadas).sort((a, b) => b[1] - a[1]).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-sm">{filterScope === "fornecedor" ? label : originLabels[label] || label}</span>
                  <span className="text-sm font-medium">{formatCurrency(value)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

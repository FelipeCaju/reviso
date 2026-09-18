import { useEffect, useState, useMemo } from "react";
import { FileDown, Mail, Send, Printer, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";
import { addSectionTitle, createStyledDocument, finalizeStyledDocument } from "@/lib/pdf";

const METHOD_LABELS = {
  dinheiro: "Dinheiro", pix: "Pix", cartao_debito: "Cartão Déb.",
  cartao_credito: "Cartão Créd.", outro: "Outro",
};
const STATUS_LABELS = {
  nao_pago: "Não pago", parcialmente_pago: "Parcialmente pago",
  pago: "Pago", isento_cancelado: "Isento",
  pendente: "Pendente", vencido: "Vencido",
};

function SectionTitle({ children }) {
  return <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 border-b border-slate-300 pb-1">{children}</h3>;
}

function TotalsRow({ label, value, positive, negative }) {
  return (
    <tr className="border-t-2 border-slate-400 bg-slate-50">
      <td className="px-2 py-1.5 text-sm font-bold">{label}</td>
      <td className={`px-2 py-1.5 text-right text-sm font-bold ${positive ? "text-emerald-600" : negative ? "text-red-600" : ""}`}>{value}</td>
    </tr>
  );
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [saving, setSaving] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(todayISO());
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterScope, setFilterScope] = useState("cliente");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [reportType, setReportType] = useState("simples");

  useEffect(() => {
    (async () => {
      try {
        const [sl, pays, tx, wo, exp, po, poi, custs, sups] = await Promise.all([
          base44.entities.WorkshopSetting.list("-updated_date", 1),
          base44.entities.Payment.list("-date", 2000),
          base44.entities.FinancialTransaction.list("-date", 2000),
          base44.entities.WorkOrder.list("-entry_date", 500),
          base44.entities.Expense.list("-date", 500),
          base44.entities.PurchaseOrder.list("-date", 500),
          base44.entities.PurchaseOrderItem.list("-created_date", 2000),
          base44.entities.Customer.list("-updated_date", 500),
          base44.entities.Supplier.list("-updated_date", 500),
        ]);
        setSettings(sl[0] || null);
        setPayments(pays); setTransactions(tx); setWorkOrders(wo);
        setExpenses(exp); setPurchaseOrders(po); setPurchaseOrderItems(poi); setCustomers(custs); setSuppliers(sups);
        try { setCurrentUser(await base44.auth.me()); } catch {}
      } finally { setLoading(false); }
    })();
  }, []);

  // WorkOrder number lookup
  const woNumberMap = useMemo(() => {
    const m = {};
    workOrders.forEach((w) => { m[w.id] = w.number || ""; });
    return m;
  }, [workOrders]);

  const poNumberMap = useMemo(() => {
    const m = {};
    purchaseOrders.forEach((o) => { m[o.id] = o.number || ""; });
    return m;
  }, [purchaseOrders]);

  const inRange = (d) => {
    if (!d) return false;
    const dt = new Date(d);
    return dt >= new Date(startDate + "T00:00:00") && dt <= new Date(endDate + "T23:59:59");
  };

  const methodMatches = (m) => {
    if (!filterMethod) return true;
    if (filterMethod === "cartao") return m === "cartao_debito" || m === "cartao_credito";
    return m === filterMethod;
  };

  // Entradas: individual Payment records (real money received)
  const entradas = useMemo(() => payments.filter((p) => {
    if (p.status !== "ativo" || !inRange(p.date)) return false;
    if (filterScope !== "cliente" || !p.customer_id) return false;
    if (filterCustomer && p.customer_id !== filterCustomer) return false;
    if (!methodMatches(p.method)) return false;
    return true;
  }).map((p) => ({
    date: p.date,
    cliente: p.customer_name_snapshot || "—",
    referencia: woNumberMap[p.work_order_id] ? `OS #${woNumberMap[p.work_order_id]}` : "—",
    forma: METHOD_LABELS[p.method] || "—",
    formaKey: p.method,
    valor: p.amount || 0,
  })).sort((a, b) => new Date(a.date) - new Date(b.date)),
  [payments, startDate, endDate, filterScope, filterCustomer, filterMethod, woNumberMap]);

  // Saídas: paid Expenses + FinancialTransaction (saida, pedido)
  const saidas = useMemo(() => {
    const expSaidas = expenses.filter((e) => {
      if (e.status !== "pago") return false;
      if (filterScope !== "fornecedor" || !e.supplier_id) return false;
      const d = e.payment_date || e.date;
      if (!inRange(d)) return false;
      if (filterSupplier && e.supplier_id !== filterSupplier) return false;
      if (!methodMatches(e.payment_method)) return false;
      return true;
    }).map((e) => ({
      date: e.payment_date || e.date,
      descricao: suppliers.find((s) => s.id === e.supplier_id)?.name || e.beneficiary || e.description || "Fornecedor",
      referencia: "Despesa",
      forma: METHOD_LABELS[e.payment_method] || "—",
      formaKey: e.payment_method,
      valor: e.amount || 0,
      categoria: e.category || "Outros",
      tipo: e.type === "fixa" ? "Despesas fixas" : "Despesas eventuais",
    }));

    const pedidosSaidas = transactions.filter((t) => {
      if (t.type !== "saida" || t.status !== "ativo" || t.origin_type !== "pedido") return false;
      if (filterScope !== "fornecedor" || !t.supplier_id) return false;
      if (!inRange(t.date)) return false;
      if (filterSupplier && t.supplier_id !== filterSupplier) return false;
      if (!methodMatches(t.payment_method)) return false;
      return true;
    }).map((t) => ({
      date: t.date,
      descricao: t.supplier_name_snapshot || t.description || "Compra",
      referencia: poNumberMap[t.origin_id] ? `Pedido #${poNumberMap[t.origin_id]}` : "Pedido",
      forma: METHOD_LABELS[t.payment_method] || "—",
      formaKey: t.payment_method,
      valor: t.amount || 0,
      categoria: "Fornecedores",
      tipo: "Fornecedores",
    }));

    return [...expSaidas, ...pedidosSaidas].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [expenses, transactions, startDate, endDate, filterScope, filterSupplier, filterMethod, poNumberMap, suppliers]);

  const totalEntradas = entradas.reduce((s, e) => s + e.valor, 0);
  const totalSaidas = saidas.reduce((s, e) => s + e.valor, 0);

  // A Receber: WorkOrders with balance > 0
  const aReceber = useMemo(() => workOrders.filter((w) => {
    if (filterScope !== "cliente") return false;
    if (w.status === "cancelada" || w.payment_status === "pago" || w.payment_status === "isento_cancelado") return false;
    const balance = (w.total || 0) - (w.paid_amount || 0);
    if (balance <= 0.01) return false;
    if (filterCustomer && w.customer_id !== filterCustomer) return false;
    if (filterStatus && w.payment_status !== filterStatus) return false;
    return true;
  }).map((w) => ({
    cliente: w.customer_name_snapshot || "—",
    os: w.number || "—",
    total: w.total || 0,
    recebido: w.paid_amount || 0,
    saldo: (w.total || 0) - (w.paid_amount || 0),
  })), [workOrders, filterScope, filterCustomer, filterStatus]);

  const totalAReceber = aReceber.reduce((s, r) => s + r.saldo, 0);

  // A Pagar: pending Expenses + pending PurchaseOrders
  const aPagar = useMemo(() => {
    const expPend = expenses.filter((e) => {
      if (filterScope !== "fornecedor" || !e.supplier_id) return false;
      if (e.status !== "pendente" && e.status !== "vencido") return false;
      if (filterSupplier && e.supplier_id !== filterSupplier) return false;
      return true;
    }).map((e) => ({
      descricao: e.supplier_id ? (e.beneficiary || e.description) : (e.description || e.beneficiary || "Despesa"),
      referencia: "Despesa",
      valor: e.amount || 0,
      status: STATUS_LABELS[e.status] || e.status,
    }));

    const pedPend = purchaseOrders.filter((o) => {
      if (filterScope !== "fornecedor" || !o.supplier_id) return false;
      if (o.payment_status === "pago" || o.payment_status === "cancelado") return false;
      const balance = (o.total || 0) - (o.paid_amount || 0);
      if (balance <= 0.01) return false;
      if (filterSupplier && o.supplier_id !== filterSupplier) return false;
      return true;
    }).map((o) => ({
      descricao: o.supplier_name_snapshot || "Fornecedor",
      referencia: o.number ? `Pedido #${o.number}` : "Pedido",
      valor: (o.total || 0) - (o.paid_amount || 0),
      status: STATUS_LABELS[o.payment_status] || o.payment_status,
    }));

    return [...expPend, ...pedPend];
  }, [expenses, purchaseOrders, filterScope, filterSupplier]);

  const totalAPagar = aPagar.reduce((s, p) => s + p.valor, 0);
  const resultado = totalEntradas - totalSaidas;

  // Detailed: all movements
  const movimentacoes = useMemo(() => {
    const ent = entradas.map((e) => ({
      date: e.date, tipo: "Entrada", pessoa: e.cliente, origem: "OS",
      referencia: e.referencia, forma: e.forma, status: "Pago", valor: e.valor,
    }));
    const sai = saidas.map((s) => ({
      date: s.date, tipo: "Saída", pessoa: s.descricao,
      origem: s.referencia.includes("Pedido") ? "Pedido" : "Despesa",
      referencia: s.referencia, forma: s.forma, status: "Pago", valor: s.valor,
    }));
    return [...ent, ...sai].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [entradas, saidas]);

  // Summary by payment method
  const resumoForma = useMemo(() => {
    const map = {};
    [...entradas, ...saidas].forEach((item) => {
      const key = item.formaKey || "outro";
      if (!map[key]) map[key] = 0;
      map[key] += item.valor;
    });
    return Object.entries(map).map(([k, v]) => ({ forma: METHOD_LABELS[k] || k, valor: v }));
  }, [entradas, saidas]);

  const totalForma = resumoForma.reduce((s, r) => s + r.valor, 0);

  // Saídas agrupadas pelo fornecedor: compras repetidas no período formam uma única linha.
  const resumoSaidas = useMemo(() => {
    const map = {};
    saidas.forEach((s) => {
      const key = s.descricao || "Saída";
      if (!map[key]) map[key] = { descricao: key, quantidade: 0, valor: 0 };
      map[key].quantidade += 1;
      map[key].valor += s.valor;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  }, [saidas]);

  const totalSaidasDetalhadas = resumoSaidas.reduce((s, r) => s + r.valor, 0);

  const comprasFornecedor = useMemo(() => purchaseOrders
    .filter((o) => o.supplier_id === filterSupplier)
    .map((o) => ({
      ...o,
      itens: purchaseOrderItems.filter((item) => item.order_id === o.id),
    })), [purchaseOrders, purchaseOrderItems, filterSupplier]);

  const periodLabel = `${formatDate(startDate)} a ${formatDate(endDate)}`;
  const reportPeriodLabel = reportType === "fornecedor" ? "Todo o histórico" : periodLabel;

  const handleGenerate = () => {
    if (reportType === "fornecedor" && !filterSupplier) {
      toast({ title: "Selecione um fornecedor para gerar o relatório", variant: "destructive" });
      return;
    }
    setGenerated(true);
    setGeneratedAt(new Date().toLocaleString("pt-BR"));
  };

  const handlePrint = () => window.print();

  const generatePDF = async () => {
    const { doc, y: initialY } = await createStyledDocument(settings, reportType === "fornecedor" ? "Relatório de compras" : "Relatório financeiro", {
      subtitle: `Período: ${reportPeriodLabel}`,
      meta: `Gerado em: ${generatedAt}${currentUser?.full_name ? ` - ${currentUser.full_name}` : ""}`,
    });
    const ml = 14, pw = 210, pwR = pw - ml;
    let y = initialY;

    const colW = [28, 50, 35, 30, 35, pwR - 178];
    const drawRow = (cells, bold) => {
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(7);
      let x = ml;
      cells.forEach((c, i) => {
        const isLast = i === cells.length - 1;
        doc.text(String(c), isLast ? pwR : x, y, isLast ? { align: "right" } : undefined);
        if (!isLast) x += colW[i];
      });
      y += 4;
    };

    // Resumo
    y = addSectionTitle(doc, y, "Resumo financeiro");
    drawRow(["Entradas recebidas", formatCurrency(totalEntradas)], true);
    drawRow(["Saídas pagas", formatCurrency(totalSaidas)], true);
    drawRow(["A receber", formatCurrency(totalAReceber)], true);
    drawRow(["A pagar", formatCurrency(totalAPagar)], true);
    drawRow(["Resultado do período", formatCurrency(resultado)], true);
    y += 3;

    if (reportType === "simples") {
      // Simples: apenas totais (cabe em uma folha)
      drawRow(["Total de entradas recebidas", formatCurrency(totalEntradas)], true);
      drawRow(["Total de saídas pagas", formatCurrency(totalSaidas)], true);
      drawRow(["Total a receber", formatCurrency(totalAReceber)], true);
      drawRow(["Total a pagar", formatCurrency(totalAPagar)], true);
      drawRow(["Resultado do período", formatCurrency(resultado)], true);
    } else if (reportType === "fornecedor") {
      const supplierName = suppliers.find((s) => s.id === filterSupplier)?.name || "Fornecedor";
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(`Histórico de compras — ${supplierName}`, ml, y); y += 5;
      drawRow(["Data", "Pedido", "Peça / serviço", "Qtd.", "Valor"], true);
      comprasFornecedor.forEach((o) => {
        if (!o.itens.length) drawRow([formatDate(o.date), `#${o.number || "—"}`, "—", "—", formatCurrency(o.total)]);
        o.itens.forEach((item, index) => drawRow([
          index === 0 ? formatDate(o.date) : "",
          index === 0 ? `#${o.number || "—"}` : "",
          item.description || "Peça", `${item.quantity || 1} ${item.unit || "un"}`,
          formatCurrency(item.total || (item.quantity || 1) * (item.unit_price || 0)),
        ]));
      });
      drawRow(["TOTAL COMPRADO", formatCurrency(comprasFornecedor.reduce((sum, order) => sum + (order.total || 0), 0))], true);
    } else {
      // Movimentações
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("Movimentações", ml, y); y += 5;
      drawRow(["Data", "Cliente/Fornecedor", "Origem", "Referência", "Forma", "Valor"], true);
      movimentacoes.forEach((m) => drawRow([formatDate(m.date), m.pessoa.slice(0, 28), m.origem, m.referencia, m.forma, formatCurrency(m.valor)]));
      y += 3;

      // Resumo por forma
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("Resumo por Forma de Pagamento", ml, y); y += 5;
      drawRow(["Forma", "Valor"], true);
      resumoForma.forEach((r) => drawRow([r.forma, formatCurrency(r.valor)]));
      drawRow(["TOTAL", formatCurrency(totalForma)], true);
      y += 3;

      // Detalhamento de saídas
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("Detalhamento de Saídas", ml, y); y += 5;
      drawRow(["Fornecedor / saída", "Compras", "Valor"], true);
      resumoSaidas.forEach((r) => drawRow([r.descricao, r.quantidade, formatCurrency(r.valor)]));
      drawRow(["TOTAL", formatCurrency(totalSaidasDetalhadas)], true);
    }

    finalizeStyledDocument(doc);
    doc.save(`Relatorio_Financeiro_${startDate}_a_${endDate}.pdf`);
    toast({ title: "PDF gerado" });
  };

  const sendWhatsApp = () => {
    if (reportType === "fornecedor") {
      const supplierName = suppliers.find((s) => s.id === filterSupplier)?.name || "Fornecedor";
      const total = comprasFornecedor.reduce((sum, order) => sum + (order.total || 0), 0);
      const text = `*RELATÓRIO DE COMPRAS — ${supplierName}*\nPeríodo: Todo o histórico\n\nPedidos: ${comprasFornecedor.length}\nTotal comprado: ${formatCurrency(total)}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      return;
    }
    const t = `*RELATÓRIO FINANCEIRO — ${settings?.name || "Oficina"}*\nPeríodo: ${periodLabel}\n\n*RESUMO*\nEntradas: ${formatCurrency(totalEntradas)}\nSaídas: ${formatCurrency(totalSaidas)}\nA receber: ${formatCurrency(totalAReceber)}\nA pagar: ${formatCurrency(totalAPagar)}\nResultado: ${formatCurrency(resultado)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, "_blank");
  };

  const sendEmail = async () => {
    if (!settings?.email) { toast({ title: "E-mail não configurado", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const supplierName = suppliers.find((s) => s.id === filterSupplier)?.name || "Fornecedor";
      const supplierTotal = comprasFornecedor.reduce((sum, order) => sum + (order.total || 0), 0);
      const text = reportType === "fornecedor"
        ? `RELATÓRIO DE COMPRAS — ${supplierName}\nPeríodo: Todo o histórico\n\nPedidos: ${comprasFornecedor.length}\nTotal comprado: ${formatCurrency(supplierTotal)}\n\nGerado em: ${generatedAt}${currentUser?.full_name ? `\nPor: ${currentUser.full_name}` : ""}`
        : `RELATÓRIO FINANCEIRO — ${settings?.name || "Oficina"}\nPeríodo: ${periodLabel}\n\nRESUMO FINANCEIRO\nEntradas recebidas: ${formatCurrency(totalEntradas)}\nSaídas pagas: ${formatCurrency(totalSaidas)}\nA receber: ${formatCurrency(totalAReceber)}\nA pagar: ${formatCurrency(totalAPagar)}\nResultado do período: ${formatCurrency(resultado)}\n\nGerado em: ${generatedAt}${currentUser?.full_name ? `\nPor: ${currentUser.full_name}` : ""}`;
      await base44.integrations.Core.SendEmail({
        to: settings.email,
        subject: reportType === "fornecedor" ? `Relatório de Compras — ${supplierName}` : `Relatório Financeiro — ${settings?.name || "Oficina"}`,
        text,
      });
      toast({ title: "Relatório enviado por e-mail" });
    } catch (e) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Filters — no-print */}
      <div className="no-print space-y-3">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Gere relatórios financeiros profissionais</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          {/* Period + filters */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data final</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Consultar por</Label>
              <div className="flex h-9 rounded-md border border-input p-0.5">
                <button type="button" onClick={() => { setFilterScope("cliente"); setFilterSupplier(""); }} className={`flex-1 rounded text-xs font-medium ${filterScope === "cliente" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>Cliente</button>
                <button type="button" onClick={() => { setFilterScope("fornecedor"); setFilterCustomer(""); }} className={`flex-1 rounded text-xs font-medium ${filterScope === "fornecedor" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>Fornecedor</button>
              </div>
            </div>
            {filterScope === "cliente" ? (
              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <Select value={filterCustomer || "todos"} onValueChange={(v) => setFilterCustomer(v === "todos" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos clientes" /></SelectTrigger>
                  <SelectContent><SelectItem value="todos">Todos clientes</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Fornecedor</Label>
                <Select value={filterSupplier || "todos"} onValueChange={(v) => setFilterSupplier(v === "todos" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos fornecedores" /></SelectTrigger>
                  <SelectContent><SelectItem value="todos">Todos fornecedores</SelectItem>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Situação</Label>
              <Select value={filterStatus || "todos"} onValueChange={(v) => setFilterStatus(v === "todos" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas situações</SelectItem>
                  <SelectItem value="nao_pago">Não pago</SelectItem>
                  <SelectItem value="parcialmente_pago">Parcialmente pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={filterMethod || "todos"} onValueChange={(v) => setFilterMethod(v === "todos" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas formas</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="outro">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Type selector */}
          <div className="flex items-center gap-4 pt-1">
            <Label className="text-xs font-medium">Tipo de relatório:</Label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="reportType" checked={reportType === "simples"} onChange={() => setReportType("simples")} className="w-4 h-4 accent-primary" />
              <span className="text-sm">Simples</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="reportType" checked={reportType === "detalhado"} onChange={() => setReportType("detalhado")} className="w-4 h-4 accent-primary" />
              <span className="text-sm">Detalhado</span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={handleGenerate}><FileText className="w-4 h-4 mr-1" /> Gerar Relatório</Button>
            {generated && (
              <>
                <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" /> Imprimir</Button>
                <Button size="sm" variant="outline" onClick={generatePDF}><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
                <Button size="sm" variant="outline" onClick={sendWhatsApp}><Send className="w-4 h-4 mr-1" /> WhatsApp</Button>
                <Button size="sm" variant="outline" onClick={sendEmail} disabled={saving}><Mail className="w-4 h-4 mr-1" /> E-mail</Button>
              </>
            )}
          </div>
        </div>

        {!generated && (
          <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
            Selecione os filtros e clique em "Gerar Relatório"
          </div>
        )}
      </div>

      {/* Report — print-area */}
      {generated && (
        <div className="print-area bg-white border border-border rounded-lg p-6 md:p-10 space-y-5 text-slate-800">
          {/* Header */}
          <div className="flex items-start gap-4 pb-4 border-b-2 border-slate-300">
            {settings?.logo_url && (
              <img src={settings.logo_url} alt="Logo" className="w-16 h-16 shrink-0 object-contain" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold">{settings?.name || "Oficina"}</h1>
              {settings?.razao_social && <div className="text-xs text-slate-600">{settings.razao_social}</div>}
              {settings?.cnpj && <div className="text-xs text-slate-600">CNPJ: {settings.cnpj}</div>}
              {settings?.address && <div className="text-xs text-slate-600">{settings.address}</div>}
              <div className="text-xs text-slate-600">
                {[settings?.phone && `Tel: ${settings.phone}`, settings?.whatsapp && `WhatsApp: ${settings.whatsapp}`, settings?.email].filter(Boolean).join("  |  ")}
              </div>
            </div>
            <div className="text-right shrink-0">
              <h2 className="text-base font-bold">{reportType === "fornecedor" ? "RELATÓRIO DE COMPRAS" : "RELATÓRIO FINANCEIRO"}</h2>
              <div className="text-xs text-slate-600">{reportType === "simples" ? "Simples" : reportType === "detalhado" ? "Detalhado" : "Por fornecedor"}</div>
            </div>
          </div>

          {/* Report identification */}
          <div className="flex justify-between text-xs text-slate-600 pb-3 border-b border-slate-200">
            <div>
              <div><strong>Período:</strong> {reportPeriodLabel}</div>
              {(filterCustomer || filterSupplier || filterStatus || filterMethod) && (
                <div className="mt-1">
                  <strong>Filtros:</strong> {[
                    filterCustomer && `Cliente: ${customers.find(c => c.id === filterCustomer)?.name || ""}`,
                    filterSupplier && `Fornecedor: ${suppliers.find(s => s.id === filterSupplier)?.name || ""}`,
                    filterStatus && `Situação: ${STATUS_LABELS[filterStatus] || filterStatus}`,
                    filterMethod && `Forma: ${filterMethod === "cartao" ? "Cartão" : METHOD_LABELS[filterMethod] || filterMethod}`,
                  ].filter(Boolean).join("  |  ")}
                </div>
              )}
            </div>
            <div className="text-right">
              <div><strong>Gerado em:</strong> {generatedAt}</div>
              {currentUser?.full_name && <div><strong>Por:</strong> {currentUser.full_name}</div>}
            </div>
          </div>

          {/* === SIMPLES === */}
          {reportType === "simples" && (
            <div>
              <SectionTitle>Resumo Financeiro</SectionTitle>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-200"><td className="px-2 py-1.5">Total de entradas recebidas</td><td className="px-2 py-1.5 text-right font-medium text-emerald-600">{formatCurrency(totalEntradas)}</td></tr>
                  <tr className="border-b border-slate-200"><td className="px-2 py-1.5">Total de saídas pagas</td><td className="px-2 py-1.5 text-right font-medium text-red-600">{formatCurrency(totalSaidas)}</td></tr>
                  <tr className="border-b border-slate-200"><td className="px-2 py-1.5">Total a receber</td><td className="px-2 py-1.5 text-right font-medium">{formatCurrency(totalAReceber)}</td></tr>
                  <tr className="border-b border-slate-200"><td className="px-2 py-1.5">Total a pagar</td><td className="px-2 py-1.5 text-right font-medium">{formatCurrency(totalAPagar)}</td></tr>
                  <TotalsRow label="Resultado do período" value={formatCurrency(resultado)} positive={resultado >= 0} negative={resultado < 0} />
                </tbody>
              </table>
            </div>
          )}

          {/* === DETALHADO === */}
          {reportType === "detalhado" && (
            <>
              {/* Resumo Financeiro */}
              <div>
                <SectionTitle>Resumo Financeiro</SectionTitle>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-200"><td className="px-2 py-1.5">Entradas recebidas</td><td className="px-2 py-1.5 text-right font-medium text-emerald-600">{formatCurrency(totalEntradas)}</td></tr>
                    <tr className="border-b border-slate-200"><td className="px-2 py-1.5">Saídas pagas</td><td className="px-2 py-1.5 text-right font-medium text-red-600">{formatCurrency(totalSaidas)}</td></tr>
                    <TotalsRow label="Resultado do período" value={formatCurrency(resultado)} positive={resultado >= 0} negative={resultado < 0} />
                  </tbody>
                </table>
              </div>

              {/* Movimentações */}
              <div>
                <SectionTitle>Movimentações ({movimentacoes.length})</SectionTitle>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="px-1.5 py-1.5 text-left font-semibold">Data</th>
                      <th className="px-1.5 py-1.5 text-left font-semibold">Tipo</th>
                      <th className="px-1.5 py-1.5 text-left font-semibold">Cliente/Fornecedor</th>
                      <th className="px-1.5 py-1.5 text-left font-semibold">Origem</th>
                      <th className="px-1.5 py-1.5 text-left font-semibold">Referência</th>
                      <th className="px-1.5 py-1.5 text-left font-semibold">Forma</th>
                      <th className="px-1.5 py-1.5 text-left font-semibold">Status</th>
                      <th className="px-1.5 py-1.5 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimentacoes.length === 0 && <tr><td colSpan={8} className="px-2 py-3 text-center text-slate-400">Nenhuma movimentação no período</td></tr>}
                    {movimentacoes.map((m, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-1.5 py-1 whitespace-nowrap">{formatDate(m.date)}</td>
                        <td className="px-1.5 py-1">
                          <span className={`px-1 py-0.5 rounded text-xs ${m.tipo === "Entrada" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{m.tipo}</span>
                        </td>
                        <td className="px-1.5 py-1 truncate max-w-[160px]">{m.pessoa}</td>
                        <td className="px-1.5 py-1">{m.origem}</td>
                        <td className="px-1.5 py-1 whitespace-nowrap">{m.referencia}</td>
                        <td className="px-1.5 py-1">{m.forma}</td>
                        <td className="px-1.5 py-1">{m.status}</td>
                        <td className={`px-1.5 py-1 text-right font-medium ${m.tipo === "Entrada" ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(m.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumo por forma */}
              <div>
                <SectionTitle>Resumo por Forma de Pagamento</SectionTitle>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-xs text-slate-600">
                      <th className="px-2 py-1.5 text-left font-semibold">Forma</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoForma.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-2 py-1">{r.forma}</td>
                        <td className="px-2 py-1 text-right">{formatCurrency(r.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <TotalsRow label="TOTAL" value={formatCurrency(totalForma)} />
                  </tfoot>
                </table>
              </div>

              {/* Detalhamento de saídas */}
              <div>
                <SectionTitle>Detalhamento de Saídas</SectionTitle>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-xs text-slate-600">
                      <th className="px-2 py-1.5 text-left font-semibold">Fornecedor / saída</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Compras</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoSaidas.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-2 py-1">{r.descricao}</td>
                        <td className="px-2 py-1 text-right">{r.quantidade}</td>
                        <td className="px-2 py-1 text-right text-red-600">{formatCurrency(r.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <TotalsRow label="TOTAL" value={formatCurrency(totalSaidasDetalhadas)} negative />
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {reportType === "fornecedor" && (
            <div>
              <SectionTitle>Histórico de Compras — {suppliers.find((s) => s.id === filterSupplier)?.name || "Fornecedor"}</SectionTitle>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs text-slate-600">
                    <th className="px-2 py-1.5 text-left font-semibold">Data</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Pedido</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Peça / item escolhido na cotação</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Qtd.</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasFornecedor.length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-center text-slate-400">Nenhuma compra no período</td></tr>}
                  {comprasFornecedor.flatMap((order) => order.itens.length ? order.itens.map((item, index) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-2 py-1">{index === 0 ? formatDate(order.date) : ""}</td>
                      <td className="px-2 py-1">{index === 0 ? `#${order.number || "—"}` : ""}</td>
                      <td className="px-2 py-1">{item.description || "Peça"}</td>
                      <td className="px-2 py-1 text-right">{item.quantity || 1} {item.unit || "un"}</td>
                      <td className="px-2 py-1 text-right">{formatCurrency(item.total || (item.quantity || 1) * (item.unit_price || 0))}</td>
                    </tr>
                  )) : (
                    <tr key={order.id} className="border-b border-slate-100">
                      <td className="px-2 py-1">{formatDate(order.date)}</td><td className="px-2 py-1">#{order.number || "—"}</td><td className="px-2 py-1">—</td><td className="px-2 py-1 text-right">—</td><td className="px-2 py-1 text-right">{formatCurrency(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <TotalsRow label="TOTAL COMPRADO" value={formatCurrency(comprasFornecedor.reduce((sum, order) => sum + (order.total || 0), 0))} />
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

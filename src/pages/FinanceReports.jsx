import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileDown, Mail, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Image as ImgCmp } from "@/components/ui/image";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";
import { addSectionTitle, createStyledDocument, finalizeStyledDocument } from "@/lib/pdf";

export default function FinanceReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(todayISO());
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [reportType, setReportType] = useState("detalhado");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [tx, wo, q, po, exp, pays, sups, sl, custs] = await Promise.all([
          base44.entities.FinancialTransaction.list("-date", 2000),
          base44.entities.WorkOrder.list("-entry_date", 500),
          base44.entities.Quote.list("-date", 500),
          base44.entities.PurchaseOrder.list("-date", 500),
          base44.entities.Expense.list("-date", 500),
          base44.entities.Payment.list("-date", 500),
          base44.entities.Supplier.list("-updated_date", 500),
          base44.entities.WorkshopSetting.list("-updated_date", 1),
          base44.entities.Customer.list("-updated_date", 500),
        ]);
        setTransactions(tx); setWorkOrders(wo); setQuotes(q); setOrders(po);
        setExpenses(exp); setPayments(pays); setSuppliers(sups); setSettings(sl[0] || null);
        setCustomers(custs);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const inRange = (d) => {
    const dt = new Date(d);
    return dt >= new Date(startDate + "T00:00:00") && dt <= new Date(endDate + "T23:59:59");
  };

  const activeTx = useMemo(() => transactions.filter((t) => {
    if (t.status !== "ativo" || !inRange(t.date)) return false;
    if (filterCustomer && t.customer_id !== filterCustomer) return false;
    if (filterSupplier && t.supplier_id !== filterSupplier) return false;
    return true;
  }), [transactions, startDate, endDate, filterCustomer, filterSupplier]);

  const entradas = activeTx.filter((t) => t.type === "entrada");
  const saidas = activeTx.filter((t) => t.type === "saida");
  const totalEntradas = entradas.reduce((s, t) => s + (t.amount || 0), 0);
  const totalSaidas = saidas.reduce((s, t) => s + (t.amount || 0), 0);
  const saldo = totalEntradas - totalSaidas;

  // OS data
  const woInPeriod = workOrders.filter((w) => inRange(w.entry_date) && (!filterCustomer || w.customer_id === filterCustomer));
  const woFinished = woInPeriod.filter((w) => w.status === "finalizada");
  const woTotal = woInPeriod.reduce((s, w) => s + (w.total || 0), 0);
  const woPaid = woInPeriod.reduce((s, w) => s + (w.paid_amount || 0), 0);

  // Quotes
  const quotesInPeriod = quotes.filter((q) => inRange(q.date));
  const quotesApproved = quotesInPeriod.filter((q) => ["aprovado", "parcialmente_aprovado"].includes(q.status));
  const quotesConverted = quotesInPeriod.filter((q) => q.status === "convertido_os");
  const quotesTotal = quotesInPeriod.reduce((s, q) => s + (q.total || 0), 0);

  // Orders by supplier
  const ordersFiltered = orders.filter((o) => inRange(o.date) && (!filterSupplier || o.supplier_id === filterSupplier));
  const ordersTotal = ordersFiltered.reduce((s, o) => s + (o.total || 0), 0);

  // Expenses
  const expensesInPeriod = expenses.filter((e) => inRange(e.date) && e.status !== "cancelado" && (!filterSupplier || e.supplier_id === filterSupplier));
  const expensesPaid = expensesInPeriod.filter((e) => e.status === "pago");
  const expensesTotal = expensesPaid.reduce((s, e) => s + (e.amount || 0), 0);

  const methodLabels = { dinheiro: "Dinheiro", pix: "Pix", cartao_debito: "Cartão Déb.", cartao_credito: "Cartão Créd.", outro: "Outro" };

  const periodLabel = `${formatDate(startDate)} a ${formatDate(endDate)}`;

  const generatePDF = async () => {
    const { doc, y: initialY } = await createStyledDocument(settings, "Relatório financeiro", { subtitle: `Período: ${periodLabel}` });
    const margin = 14;
    const pageW = 210;
    let y = initialY;

    // Summary
    y = addSectionTitle(doc, y, "Resumo financeiro");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Entradas: ${formatCurrency(totalEntradas)}`, margin, y); y += 5;
    doc.text(`Saídas: ${formatCurrency(totalSaidas)}`, margin, y); y += 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Saldo: ${formatCurrency(saldo)}`, margin, y); y += 8;

    // OS summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Ordens de Serviço", margin, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Total OS: ${woInPeriod.length} | Valor: ${formatCurrency(woTotal)} | Recebido: ${formatCurrency(woPaid)} | Pendente: ${formatCurrency(woTotal - woPaid)}`, margin, y); y += 8;

    // Quotes
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Orçamentos", margin, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Criados: ${quotesInPeriod.length} | Aprovados: ${quotesApproved.length} | Convertidos: ${quotesConverted.length} | Valor: ${formatCurrency(quotesTotal)}`, margin, y); y += 8;

    // Suppliers
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Fornecedores / Compras", margin, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Pedidos: ${ordersFiltered.length} | Valor: ${formatCurrency(ordersTotal)}`, margin, y); y += 8;

    // Expenses
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Despesas", margin, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Pagas: ${formatCurrency(expensesTotal)} | Total (incl. pendentes): ${formatCurrency(expensesInPeriod.reduce((s, e) => s + (e.amount || 0), 0))}`, margin, y); y += 8;

    // Detailed transactions
    if (reportType === "detalhado") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Transações Detalhadas", margin, y); y += 6;
      doc.setFontSize(8);
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, pageW - margin * 2, 5, "F");
      doc.text("Data", margin, y + 3.5);
      doc.text("Descrição", margin + 25, y + 3.5);
      doc.text("Tipo", margin + 120, y + 3.5);
      doc.text("Forma", margin + 140, y + 3.5);
      doc.text("Valor", pageW - margin, y + 3.5, { align: "right" });
      y += 6;
      doc.setFont("helvetica", "normal");
      activeTx.slice(0, 80).forEach((t) => {
        if (y > 275) { doc.addPage(); y = margin; }
        doc.text(formatDate(t.date), margin, y + 3);
        doc.text(String(t.description || "").slice(0, 50), margin + 25, y + 3);
        doc.text(t.type === "entrada" ? "Entrada" : "Saída", margin + 120, y + 3);
        doc.text(methodLabels[t.payment_method] || "—", margin + 140, y + 3);
        doc.text(formatCurrency(t.amount), pageW - margin, y + 3, { align: "right" });
        y += 4.5;
      });
    }

    finalizeStyledDocument(doc);
    doc.save(`relatorio-financeiro-${startDate}-${endDate}.pdf`);
    toast({ title: "PDF gerado" });
  };

  const sendEmailReport = async () => {
    setSaving(true);
    try {
      const text = `Relatório Financeiro — ${periodLabel}\n\nEntradas: ${formatCurrency(totalEntradas)}\nSaídas: ${formatCurrency(totalSaidas)}\nSaldo: ${formatCurrency(saldo)}\n\nOS: ${woInPeriod.length} (${formatCurrency(woTotal)})\nOrçamentos: ${quotesInPeriod.length}\nCompras: ${formatCurrency(ordersTotal)}\nDespesas pagas: ${formatCurrency(expensesTotal)}`;
      await base44.integrations.Core.SendEmail({
        to: settings?.email || "",
        subject: `Relatório Financeiro — ${periodLabel}`,
        text,
      });
      toast({ title: "Relatório enviado por e-mail" });
    } catch (e) {
      toast({ title: "Erro ao enviar e-mail", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendWhatsAppReport = () => {
    const text = `*Relatório Financeiro — ${periodLabel}*\n\n*Entradas:* ${formatCurrency(totalEntradas)}\n*Saídas:* ${formatCurrency(totalSaidas)}\n*Saldo:* ${formatCurrency(saldo)}\n\n*OS:* ${woInPeriod.length} (${formatCurrency(woTotal)})\n*Orçamentos:* ${quotesInPeriod.length}\n*Compras:* ${formatCurrency(ordersTotal)}\n*Despesas pagas:* ${formatCurrency(expensesTotal)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button onClick={() => navigate("/financeiro")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </button>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={generatePDF}><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={sendEmailReport} disabled={saving}><Mail className="w-4 h-4 mr-1" /> E-mail</Button>
          <Button size="sm" variant="outline" onClick={sendWhatsAppReport}><MessageCircle className="w-4 h-4 mr-1" /> WhatsApp</Button>
        </div>
      </div>

      {/* Report header with logo + company info */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {settings?.logo_url && (
              <ImgCmp src={settings.logo_url} alt="Logo" fittingType="fit" className="w-16 h-16 rounded-lg shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-heading font-semibold">{settings?.name || "Oficina"}</h1>
              {settings?.cnpj && <div className="text-xs text-muted-foreground">CNPJ: {settings.cnpj}</div>}
              {settings?.address && <div className="text-xs text-muted-foreground">{settings.address}</div>}
              {settings?.phone && <div className="text-xs text-muted-foreground">Tel: {settings.phone}</div>}
            </div>
            <div className="text-right shrink-0">
              <h2 className="text-base font-semibold">Relatório Financeiro</h2>
              <div className="text-xs text-muted-foreground">{periodLabel}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Select value={filterCustomer || "todos"} onValueChange={(v) => setFilterCustomer(v === "todos" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos clientes</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fornecedor</Label>
              <Select value={filterSupplier || "todos"} onValueChange={(v) => setFilterSupplier(v === "todos" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos fornecedores</SelectItem>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Tipo:</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Simples</SelectItem>
                <SelectItem value="detalhado">Detalhado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-medium mb-3">Resumo Financeiro</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2 text-muted-foreground">Entradas</td>
                <td className="py-2 text-right font-semibold text-emerald-600">{formatCurrency(totalEntradas)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 text-muted-foreground">Saídas</td>
                <td className="py-2 text-right font-semibold text-red-600">{formatCurrency(totalSaidas)}</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Saldo</td>
                <td className={`py-2 text-right font-bold ${saldo >= 0 ? "text-primary" : "text-amber-600"}`}>{formatCurrency(saldo)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* OS Report */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-medium mb-3">Ordens de Serviço</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border"><td className="py-1.5 text-muted-foreground">Total de OS</td><td className="py-1.5 text-right font-medium">{woInPeriod.length}</td></tr>
              <tr className="border-b border-border"><td className="py-1.5 text-muted-foreground">Valor Total</td><td className="py-1.5 text-right font-medium">{formatCurrency(woTotal)}</td></tr>
              <tr className="border-b border-border"><td className="py-1.5 text-muted-foreground">Recebido</td><td className="py-1.5 text-right font-medium text-emerald-600">{formatCurrency(woPaid)}</td></tr>
              <tr><td className="py-1.5 text-muted-foreground">Pendente</td><td className="py-1.5 text-right font-medium text-amber-600">{formatCurrency(woTotal - woPaid)}</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Quotes Report */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-medium mb-3">Orçamentos</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border"><td className="py-1.5 text-muted-foreground">Criados</td><td className="py-1.5 text-right font-medium">{quotesInPeriod.length}</td></tr>
              <tr className="border-b border-border"><td className="py-1.5 text-muted-foreground">Aprovados</td><td className="py-1.5 text-right font-medium text-emerald-600">{quotesApproved.length}</td></tr>
              <tr className="border-b border-border"><td className="py-1.5 text-muted-foreground">Convertidos</td><td className="py-1.5 text-right font-medium">{quotesConverted.length}</td></tr>
              <tr><td className="py-1.5 text-muted-foreground">Valor Orçado</td><td className="py-1.5 text-right font-medium">{formatCurrency(quotesTotal)}</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Suppliers Report */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-medium mb-3">Fornecedores / Compras</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border"><td className="py-1.5 text-muted-foreground">Pedidos</td><td className="py-1.5 text-right font-medium">{ordersFiltered.length}</td></tr>
              <tr><td className="py-1.5 text-muted-foreground">Valor Total</td><td className="py-1.5 text-right font-medium">{formatCurrency(ordersTotal)}</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Expenses Report */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-medium mb-3">Despesas</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border"><td className="py-1.5 text-muted-foreground">Pagas</td><td className="py-1.5 text-right font-medium">{formatCurrency(expensesTotal)}</td></tr>
              <tr><td className="py-1.5 text-muted-foreground">Total (incl. pendentes)</td><td className="py-1.5 text-right font-medium">{formatCurrency(expensesInPeriod.reduce((s, e) => s + (e.amount || 0), 0))}</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Detailed transactions */}
      {reportType === "detalhado" && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium mb-3">Transações Detalhadas ({activeTx.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 text-left">Data</th>
                    <th className="py-2 text-left">Descrição</th>
                    <th className="py-2 text-left">Tipo</th>
                    <th className="py-2 text-left">Forma</th>
                    <th className="py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTx.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="py-2 text-xs">{formatDate(t.date)}</td>
                      <td className="py-2 truncate max-w-[200px]">{t.description}</td>
                      <td className="py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${t.type === "entrada" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {t.type === "entrada" ? "Entrada" : "Saída"}
                        </span>
                      </td>
                      <td className="py-2 text-xs">{methodLabels[t.payment_method] || "—"}</td>
                      <td className={`py-2 text-right font-medium ${t.type === "entrada" ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

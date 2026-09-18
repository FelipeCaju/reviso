import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Save, Copy, ShoppingCart, Check, Package, Mail, UserPlus, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { withWorkshop } from "@/lib/workshop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { generatePurchaseRequestPDFBlob } from "@/lib/pdf";
import { getWhatsAppDocumentPreview, getWhatsAppErrorMessage, sendWhatsAppDocument } from "@/lib/zapi";
import WhatsAppPreviewDialog from "@/components/WhatsAppPreviewDialog";
import { toast } from "@/components/ui/use-toast";

const STATUS_OPTIONS = [
  "rascunho", "cotacao", "aguardando_resposta", "aprovado", "pedido_realizado", "parcialmente_recebido", "recebido", "cancelado",
];

const STATUS_LABELS = {
  rascunho: "Rascunho", cotacao: "Cotação", aguardando_resposta: "Aguardando Resposta",
  aprovado: "Aprovado", pedido_realizado: "Pedido Realizado",
  parcialmente_recebido: "Parcialmente Recebido", recebido: "Recebido", cancelado: "Cancelado",
};

export default function PurchaseRequestEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editing = !!id;

  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [request, setRequest] = useState(null);
  const [items, setItems] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDesc, setManualDesc] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [manualUnit, setManualUnit] = useState("un");
  const [quoteOpen, setQuoteOpen] = useState(null); // item index
  const [generated, setGenerated] = useState(false);
  const [savingItemIdx, setSavingItemIdx] = useState(null);
  const [registerIdx, setRegisterIdx] = useState(null);
  const [sendingSupplierId, setSendingSupplierId] = useState(null);
  const [previewSupplier, setPreviewSupplier] = useState(null);
  const [registerForm, setRegisterForm] = useState({ description: "", category: "", brand: "", unit: "un", cost: 0, sale_price: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [m, s, sl] = await Promise.all([
          base44.entities.Material.list("-updated_date", 500),
          base44.entities.Supplier.list("-updated_date", 500),
          base44.entities.WorkshopSetting.list("-updated_date", 1),
        ]);
        setMaterials(m);
        setSuppliers(s.filter((sup) => sup.active));
        setSettings(sl[0] || null);

        if (editing) {
          const [r, ri] = await Promise.all([
            base44.entities.PurchaseRequest.get(id),
            base44.entities.PurchaseRequestItem.filter({ request_id: id }, "-updated_date", 500),
          ]);
          setRequest(r);
          setItems(ri.map((it) => ({ ...it, supplier_quotes: it.supplier_quotes || [], selected_supplier_id: it.selected_supplier_id || "", selected_unit_price: it.selected_unit_price || 0 })));
        } else {
          const preselectedSupplier = searchParams.get("fornecedor");
          setRequest({
            number: "",
            date: todayISO(),
            responsible: "",
            notes: "",
            status: "rascunho",
            supplier_ids: preselectedSupplier ? [preselectedSupplier] : [],
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = (k, v) => setRequest((r) => ({ ...r, [k]: v }));

  const generateNumber = async () => {
    const all = await base44.entities.PurchaseRequest.list("-created_date", 500);
    const nums = all.map((r) => parseInt((r.number || "0").replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return String(next).padStart(5, "0");
  };

  const addMaterial = (mat) => {
    setItems((arr) => [...arr, {
      request_id: editing ? id : "",
      material_id: mat.id,
      description: mat.description,
      quantity: 1,
      unit: mat.unit || "un",
      notes: "",
      supplier_quotes: [],
      selected_supplier_id: "",
      selected_unit_price: 0,
    }]);
    setPickerOpen(false);
  };

  const addManual = () => {
    if (!manualDesc.trim()) return;
    setItems((arr) => [...arr, {
      request_id: editing ? id : "",
      material_id: "",
      description: manualDesc,
      quantity: manualQty,
      unit: manualUnit,
      notes: "",
      supplier_quotes: [],
      selected_supplier_id: "",
      selected_unit_price: 0,
    }]);
    setManualDesc(""); setManualQty(1); setManualUnit("un");
    setManualOpen(false);
  };

  const updateItem = (idx, patch) => setItems((arr) => arr.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx) => setItems((arr) => arr.filter((_, i) => i !== idx));

  const toggleSupplier = (supId) => {
    setRequest((r) => {
      const ids = r.supplier_ids || [];
      return { ...r, supplier_ids: ids.includes(supId) ? ids.filter((x) => x !== supId) : [...ids, supId] };
    });
  };

  // Update quote for a specific item + supplier
  const setQuote = (itemIdx, supplierId, field, value) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== itemIdx) return it;
      const quotes = [...(it.supplier_quotes || [])];
      const qIdx = quotes.findIndex((q) => q.supplier_id === supplierId);
      if (qIdx === -1) {
        const sup = suppliers.find((s) => s.id === supplierId);
        quotes.push({ supplier_id: supplierId, supplier_name_snapshot: sup?.name || "", unit_price: field === "unit_price" ? value : 0, notes: "" });
      } else {
        quotes[qIdx] = { ...quotes[qIdx], [field]: value };
      }
      // Keep selected_unit_price in sync when the winner's quote is edited
      const shouldSyncPrice = it.selected_supplier_id === supplierId && field === "unit_price";
      return {
        ...it,
        supplier_quotes: quotes,
        ...(shouldSyncPrice ? { selected_unit_price: value } : {}),
      };
    }));
  };

  // Select winning supplier for an item
  const selectWinner = (itemIdx, supplierId) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== itemIdx) return it;
      const quote = (it.supplier_quotes || []).find((q) => q.supplier_id === supplierId);
      return { ...it, selected_supplier_id: supplierId, selected_unit_price: quote?.unit_price || 0 };
    }));
  };

  // Generate text for sending
  const generateText = () => {
    const lines = items.map((it) => `${it.quantity}x ${it.description}`);
    const text = `Cotação #${request.number}\n\nOlá, aqui é ${settings?.name || "a oficina"}. Gostaria de orçamento para:\n\n${lines.join("\n")}\n\nFavor informar:\n- Preço unitário\n- Disponibilidade\n- Prazo de entrega\n\nObrigado.`;
    return text;
  };

  const copyText = () => {
    navigator.clipboard.writeText(generateText());
    toast({ title: "Texto copiado!" });
  };

  const sendWhatsApp = async (supplierId) => {
    const sup = suppliers.find((s) => s.id === supplierId);
    const phone = sup?.whatsapp || sup?.phone;
    if (!phone) { toast({ title: "Número de Telefone incorreto", variant: "destructive" }); return; }
    setSendingSupplierId(supplierId);
    try {
      const blob = await generatePurchaseRequestPDFBlob(request, items, settings);
      await sendWhatsAppDocument({
        blob, fileName: `cotacao-${request.number}.pdf`, phone, recipientName: sup?.name,
        reference: request.number, documentType: "purchase-quote",
      });
      toast({ title: `Cotação enviada para ${sup.name} pelo WhatsApp.` });
      setPreviewSupplier(null);
    } catch (error) {
      toast({ title: "Erro ao enviar", description: getWhatsAppErrorMessage(error), variant: "destructive" });
    } finally {
      setSendingSupplierId(null);
    }
  };

  const openWhatsAppPreview = (supplier) => {
    if (!(supplier?.whatsapp || supplier?.phone)) {
      toast({ title: "Número de Telefone incorreto", variant: "destructive" });
      return;
    }
    setPreviewSupplier(supplier);
  };

  const sendEmail = async (supplierId) => {
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!sup?.email) { toast({ title: "Fornecedor sem e-mail cadastrado", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: sup.email,
        subject: `Cotação #${request.number} — ${settings?.name || "Oficina"}`,
        text: generateText(),
      });
      toast({ title: `E-mail enviado para ${sup.name}` });
    } catch (e) {
      toast({ title: "Erro ao enviar e-mail", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Save a single item's quotes to DB + update Material cost + sync existing orders
  const saveItemQuotes = async (idx) => {
    if (!editing) { toast({ title: "Salve a cotação primeiro", variant: "destructive" }); return; }
    const it = items[idx];
    if (!it) return;
    setSavingItemIdx(idx);
    try {
      await base44.entities.PurchaseRequestItem.update(it.id, {
        supplier_quotes: it.supplier_quotes || [],
        selected_supplier_id: it.selected_supplier_id || "",
        selected_unit_price: it.selected_unit_price || 0,
        quantity: it.quantity,
      });
      // Update Material cost with selected supplier's price
      if (it.material_id && it.selected_unit_price > 0) {
        await base44.entities.Material.update(it.material_id, { cost: it.selected_unit_price });
      }

      // If orders were already generated for this request, sync the price into the order items
      const existingOrders = await base44.entities.PurchaseOrder.filter({ request_id: id }, "-created_date", 500);
      if (existingOrders.length > 0 && it.selected_supplier_id) {
        const sup = suppliers.find((s) => s.id === it.selected_supplier_id);
        for (const order of existingOrders) {
          if (order.supplier_id !== it.selected_supplier_id) continue;
          const orderItems = await base44.entities.PurchaseOrderItem.filter({ order_id: order.id }, "-created_date", 500);
          const matchBy = (oi) => it.material_id ? oi.material_id === it.material_id : oi.description === it.description;
          const matched = orderItems.find(matchBy);
          if (matched) {
            const newTotal = (it.quantity || 0) * (it.selected_unit_price || 0);
            await base44.entities.PurchaseOrderItem.update(matched.id, {
              unit_price: it.selected_unit_price,
              total: newTotal,
              quantity: it.quantity,
            });
            // Recalculate order totals
            const updatedItems = orderItems.map((oi) => oi.id === matched.id ? { ...oi, unit_price: it.selected_unit_price, total: newTotal, quantity: it.quantity } : oi);
            const newSubtotal = updatedItems.reduce((s, oi) => s + (oi.total || 0), 0);
            await base44.entities.PurchaseOrder.update(order.id, {
              subtotal: newSubtotal,
              total: newSubtotal - (order.discount || 0),
            });
          }
        }
        // Also update the linked expense
        const linkedExpenses = await base44.entities.Expense.filter({ purchase_order_id: { $in: existingOrders.map((o) => o.id) } }, "-created_date", 500);
        for (const order of existingOrders) {
          if (order.supplier_id !== it.selected_supplier_id) continue;
          const orderItems = await base44.entities.PurchaseOrderItem.filter({ order_id: order.id }, "-created_date", 500);
          const newSubtotal = orderItems.reduce((s, oi) => s + (oi.total || 0), 0);
          const exp = linkedExpenses.find((e) => e.purchase_order_id === order.id);
          if (exp) {
            await base44.entities.Expense.update(exp.id, { amount: newSubtotal });
          }
        }
      }

      toast({ title: "Cotação do item salva", description: existingOrders.length > 0 && it.selected_supplier_id ? "Pedido atualizado com o novo preço." : undefined });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSavingItemIdx(null);
    }
  };

  // Open dialog to register a manual item as a Material
  const openRegisterDialog = (idx) => {
    const it = items[idx];
    if (!it) return;
    setRegisterForm({
      description: it.description || "",
      category: "", brand: "", unit: it.unit || "un",
      cost: it.selected_unit_price || 0, sale_price: 0,
    });
    setRegisterIdx(idx);
  };

  const confirmRegisterMaterial = async () => {
    if (!registerForm.description.trim()) return;
    try {
      const mat = await base44.entities.Material.create(withWorkshop({
        ...registerForm,
        cost: Number(registerForm.cost) || 0,
        sale_price: Number(registerForm.sale_price) || 0,
        stock: 0,
        active: true,
      }));
      setMaterials((arr) => [mat, ...arr]);
      // Link the item to the new material
      updateItem(registerIdx, { material_id: mat.id });
      setRegisterIdx(null);
      toast({ title: "Item cadastrado na base de materiais" });
    } catch (e) {
      toast({ title: "Erro ao cadastrar", description: e.message, variant: "destructive" });
    }
  };

  // Generate purchase orders from selected winners
  const generateOrders = async () => {
    const itemsWithWinner = items.filter((it) => it.selected_supplier_id && it.selected_unit_price > 0);
    if (itemsWithWinner.length === 0) {
      toast({ title: "Selecione o fornecedor e informe o preço em pelo menos um item", variant: "destructive" });
      return;
    }
    const itemsWithoutPrice = items.filter((it) => it.selected_supplier_id && it.selected_unit_price <= 0);
    if (itemsWithoutPrice.length > 0) {
      toast({ title: `${itemsWithoutPrice.length} item(ns) com fornecedor selecionado mas sem preço — serão ignorados.`, variant: "destructive" });
    }

    // Group by supplier
    const bySupplier = {};
    itemsWithWinner.forEach((it) => {
      if (!bySupplier[it.selected_supplier_id]) bySupplier[it.selected_supplier_id] = [];
      bySupplier[it.selected_supplier_id].push(it);
    });

    setSaving(true);
    try {
      // Generate order numbers
      const allOrders = await base44.entities.PurchaseOrder.list("-created_date", 500);
      const maxNum = allOrders.reduce((max, o) => Math.max(max, parseInt((o.number || "0").replace(/\D/g, ""), 10) || 0), 0);

      let orderNum = maxNum + 1;
      for (const [supId, supItems] of Object.entries(bySupplier)) {
        const sup = suppliers.find((s) => s.id === supId);
        const subtotal = supItems.reduce((s, it) => s + (it.quantity || 0) * (it.selected_unit_price || 0), 0);
        const orderData = withWorkshop({
          number: String(orderNum).padStart(5, "0"),
          date: todayISO(),
          supplier_id: supId,
          supplier_name_snapshot: sup?.name || "",
          request_id: id,
          expected_delivery: "",
          notes: "",
          responsible: request.responsible || "",
          status: "pedido_realizado",
          subtotal,
          discount: 0,
          total: subtotal,
          payment_status: "nao_pago",
          paid_amount: 0,
        });
        const order = await base44.entities.PurchaseOrder.create(orderData);

        // Create order items
        const orderItems = supItems.map((it) => withWorkshop({
          order_id: order.id,
          material_id: it.material_id || "",
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.selected_unit_price,
          total: (it.quantity || 0) * (it.selected_unit_price || 0),
          received_quantity: 0,
          received: false,
        }));
        await base44.entities.PurchaseOrderItem.bulkCreate(orderItems);

        // Update SupplierMaterial last price + Material stock
        for (const it of supItems) {
          if (it.material_id) {
            const existing = await base44.entities.SupplierMaterial.filter({ supplier_id: supId, material_id: it.material_id });
            if (existing.length) {
              const sm = existing[0];
              const history = [...(sm.price_history || []), { date: new Date().toISOString(), price: it.selected_unit_price }];
              await base44.entities.SupplierMaterial.update(sm.id, { last_price: it.selected_unit_price, last_price_date: new Date().toISOString(), price_history: history });
            } else {
              await base44.entities.SupplierMaterial.create(withWorkshop({
                supplier_id: supId,
                material_id: it.material_id,
                last_price: it.selected_unit_price,
                last_price_date: new Date().toISOString(),
                price_history: [{ date: new Date().toISOString(), price: it.selected_unit_price }],
                active: true,
              }));
            }
            // Update Material cost + stock
            const mat = materials.find((m) => m.id === it.material_id);
            const currentStock = mat?.stock || 0;
            await base44.entities.Material.update(it.material_id, {
              cost: it.selected_unit_price,
              stock: currentStock + (it.quantity || 0),
            });
          }
        }

        // Create expense record for this purchase order
        await base44.entities.Expense.create(withWorkshop({
          description: `Pedido de Compra #${String(orderNum).padStart(5, "0")} — ${sup?.name || ""}`,
          category: "Compras",
          supplier_id: supId,
          beneficiary: sup?.name || "",
          amount: subtotal,
          date: todayISO(),
          status: "pendente",
          type: "eventual",
          purchase_order_id: order.id,
        }));

        orderNum++;
      }

      // Update request status
      await base44.entities.PurchaseRequest.update(id, { status: "pedido_realizado" });
      setRequest((r) => ({ ...r, status: "pedido_realizado" }));
      setGenerated(true);
      toast({ title: `${Object.keys(bySupplier).length} pedido(s) gerado(s)` });
    } catch (e) {
      toast({ title: "Erro ao gerar pedidos", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!request.date) return;
    setSaving(true);
    try {
      let reqId = id;
      if (editing) {
        await base44.entities.PurchaseRequest.update(id, request);
        // Re-save items
        await base44.entities.PurchaseRequestItem.deleteMany({ request_id: id });
        if (items.length) {
          await base44.entities.PurchaseRequestItem.bulkCreate(items.map((it) => withWorkshop({ ...it, request_id: id })));
        }
        // Reload items from DB to get fresh IDs (bulkCreate generates new IDs)
        const ri = await base44.entities.PurchaseRequestItem.filter({ request_id: id }, "-updated_date", 500);
        setItems(ri.map((it) => ({ ...it, supplier_quotes: it.supplier_quotes || [], selected_supplier_id: it.selected_supplier_id || "", selected_unit_price: it.selected_unit_price || 0 })));
      } else {
        const num = await generateNumber();
        const created = await base44.entities.PurchaseRequest.create(withWorkshop({ ...request, number: num }));
        reqId = created.id;
        if (items.length) {
          await base44.entities.PurchaseRequestItem.bulkCreate(items.map((it) => withWorkshop({ ...it, request_id: reqId })));
        }
      }
      toast({ title: "Cotação salva" });
      if (!editing) navigate(`/compras/${reqId}`);
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !request) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  const selectedSuppliers = (request.supplier_ids || []).map((sid) => suppliers.find((s) => s.id === sid)).filter(Boolean);
  const allItemsHaveWinner = items.length > 0 && items.every((it) => it.selected_supplier_id);

  return (
    <div className="space-y-4 pb-20 lg:pb-6">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> Salvar
        </Button>
      </div>

      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold">
          {editing ? `Cotação #${request.number}` : "Nova Solicitação de Cotação"}
        </h1>
        <p className="text-sm text-muted-foreground">{formatDate(request.date)}</p>
      </div>

      {/* Dados gerais */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={request.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Responsável</Label>
              <Input value={request.responsible} onChange={(e) => set("responsible", e.target.value)} placeholder="Nome" />
            </div>
          </div>
          {editing && (
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={request.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Observação</Label>
            <Textarea rows={2} value={request.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Itens */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-sm">Itens ({items.length})</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Material
              </Button>
              <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Manual
              </Button>
            </div>
          </div>
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Nenhum item adicionado.</div>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => {
                const quotes = it.supplier_quotes || [];
                const lowest = quotes.length ? Math.min(...quotes.filter((q) => q.unit_price > 0).map((q) => q.unit_price)) : 0;
                return (
                  <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{it.description}</div>
                        {!it.material_id && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">Não cadastrado</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          type="number"
                          step="1"
                          className="h-8 w-20 text-sm"
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                        />
                        <span className="text-xs text-muted-foreground">{it.unit}</span>
                        <button onClick={() => removeItem(idx)} className="p-1 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* Cotações por fornecedor */}
                    {selectedSuppliers.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Cotações:</div>
                        {selectedSuppliers.map((sup) => {
                          const quote = quotes.find((q) => q.supplier_id === sup.id);
                          const isLowest = quote && lowest > 0 && quote.unit_price === lowest && quote.unit_price > 0;
                          const isSelected = it.selected_supplier_id === sup.id;
                          return (
                            <div key={sup.id} className={`flex items-center gap-2 rounded px-2 py-1.5 ${isSelected ? "bg-emerald-50 border border-emerald-200" : "bg-accent/30"}`}>
                              <button
                                onClick={() => selectWinner(idx, sup.id)}
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "bg-emerald-500 border-emerald-500" : "border-border"}`}
                              >
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </button>
                              <span className="text-xs flex-1 truncate">{sup.name}</span>
                              <Input
                                type="number"
                                step="0.01"
                                className="h-8 w-24 text-sm"
                                placeholder="R$"
                                value={quote?.unit_price || ""}
                                onChange={(e) => setQuote(idx, sup.id, "unit_price", Number(e.target.value))}
                              />
                              {isLowest && <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-200 text-emerald-800 font-medium">MENOR</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {it.selected_supplier_id && (
                      <div className="text-xs text-emerald-700 font-medium">
                        Selecionado: {suppliers.find((s) => s.id === it.selected_supplier_id)?.name} — {formatCurrency(it.selected_unit_price)} / {it.unit}
                      </div>
                    )}
                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveItemQuotes(idx)}
                        disabled={savingItemIdx === idx || !editing}
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        {savingItemIdx === idx ? "Salvando..." : "Salvar Cotação"}
                      </Button>
                      {!it.material_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRegisterDialog(idx)}
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1" /> Cadastrar Item
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seleção de fornecedores */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="font-medium text-sm">Fornecedores para Cotação ({selectedSuppliers.length})</h2>
          {suppliers.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {suppliers.map((sup) => {
                const checked = (request.supplier_ids || []).includes(sup.id);
                return (
                  <label key={sup.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer border ${checked ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleSupplier(sup.id)} className="w-4 h-4" />
                    <span className="text-sm truncate">{sup.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gerar texto para envio */}
      {editing && items.length > 0 && selectedSuppliers.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-medium text-sm">Enviar Solicitação</h2>
            <div className="rounded-lg bg-[#e5ddd5] p-3 max-h-48 overflow-y-auto">
              <div className="max-w-[90%] rounded-lg bg-white p-3 text-sm whitespace-pre-wrap font-mono text-xs shadow-sm">
                {generateText()}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={copyText}><Copy className="w-4 h-4 mr-1" /> Copiar Texto</Button>
              {selectedSuppliers.map((sup) => (
                <div key={sup.id} className="flex gap-1">
                  <Button size="sm" onClick={() => openWhatsAppPreview(sup)} disabled={sendingSupplierId === sup.id} className="bg-[#25D366] text-white hover:bg-[#1ebe5d]">
                    <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp: {sup.name}
                  </Button>
                  {sup.email && (
                    <Button size="sm" variant="outline" onClick={() => sendEmail(sup.id)}>
                      <Mail className="w-4 h-4 mr-1" /> E-mail
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <WhatsAppPreviewDialog
        open={!!previewSupplier}
        onOpenChange={(open) => { if (!open) setPreviewSupplier(null); }}
        recipientName={previewSupplier?.name}
        message={getWhatsAppDocumentPreview({ recipientName: previewSupplier?.name, workshopName: settings?.name, reference: request.number, documentType: "purchase-quote" })}
        attachmentName={`cotacao-${request.number}.pdf`}
        onConfirm={() => sendWhatsApp(previewSupplier?.id)}
        sending={sendingSupplierId === previewSupplier?.id}
      />

      {/* Gerar pedido de compra */}
      {editing && items.length > 0 && request.status !== "pedido_realizado" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-medium text-sm">Gerar Pedido de Compra</h2>
            <p className="text-xs text-muted-foreground">
              {allItemsHaveWinner
                ? "Todos os itens têm fornecedor selecionado. Você pode gerar os pedidos."
                : "Selecione o fornecedor vencedor em cada item (clicando no círculo verde)."}
            </p>
            <Button onClick={generateOrders} disabled={saving || !items.some((it) => it.selected_supplier_id)}>
              <ShoppingCart className="w-4 h-4 mr-2" /> Gerar Pedido(s)
            </Button>
            {generated && (
              <div className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                <Check className="w-4 h-4" /> Pedidos gerados! Verifique em Compras → Pedidos.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Material picker */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setPickerOpen(false)}>
          <div className="bg-card w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[80vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Selecionar Material</h3>
              <button onClick={() => setPickerOpen(false)} className="text-muted-foreground">✕</button>
            </div>
            <Input placeholder="Buscar..." className="mb-2" id="mat-search" />
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {materials.map((m) => (
                <button key={m.id} onClick={() => addMaterial(m)} className="flex w-full items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-accent text-left">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.description}</div>
                    <div className="text-xs text-muted-foreground">{[m.code, m.brand].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
              {materials.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Nenhum material cadastrado.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Manual item dialog */}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setManualOpen(false)}>
          <div className="bg-card w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium">Adicionar Item Manual</h3>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input type="number" value={manualQty} onChange={(e) => setManualQty(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Input value={manualUnit} onChange={(e) => setManualUnit(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
              <Button onClick={addManual} disabled={!manualDesc.trim()}>Adicionar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Register material dialog */}
      {registerIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setRegisterIdx(null)}>
          <div className="bg-card w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium">Cadastrar Item na Base</h3>
            <p className="text-xs text-muted-foreground">Cadastre este item para que ele entre no estoque e seja rastreável.</p>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={registerForm.description} onChange={(e) => setRegisterForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input value={registerForm.category} onChange={(e) => setRegisterForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Marca</Label>
                <Input value={registerForm.brand} onChange={(e) => setRegisterForm((f) => ({ ...f, brand: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Input value={registerForm.unit} onChange={(e) => setRegisterForm((f) => ({ ...f, unit: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Custo (R$)</Label>
                <Input type="number" step="0.01" value={registerForm.cost} onChange={(e) => setRegisterForm((f) => ({ ...f, cost: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Venda (R$)</Label>
                <Input type="number" step="0.01" value={registerForm.sale_price} onChange={(e) => setRegisterForm((f) => ({ ...f, sale_price: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRegisterIdx(null)}>Cancelar</Button>
              <Button onClick={confirmRegisterMaterial} disabled={!registerForm.description.trim()}>Cadastrar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

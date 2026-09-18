import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Car, User, Save, FileDown, Camera, X, ReceiptText, MessageCircle,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { withWorkshop } from "@/lib/workshop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import QuoteItemPicker from "@/components/QuoteItemPicker";
import VoiceInput from "@/components/VoiceInput";
import CurrencyInput from "@/components/CurrencyInput";
import { Image as ImgCmp } from "@/components/ui/image";
import { WorkOrderStatusBadge, workOrderStatusInfo } from "@/components/StatusBadge";
import {
  normalizePlate, vehicleDescription, formatCurrency, formatDateTime, todayISO,
} from "@/lib/format";
import { generateNonFiscalReceiptPDF, generateWorkOrderPDF, generateWorkOrderPDFBlob } from "@/lib/pdf";
import { getWhatsAppDocumentPreview, getWhatsAppErrorMessage, sendWhatsAppDocument } from "@/lib/zapi";
import WhatsAppPreviewDialog from "@/components/WhatsAppPreviewDialog";
import { toast } from "@/components/ui/use-toast";
import OSPayments from "@/components/OSPayments";
import OSNotification from "@/components/OSNotification";

const STATUS_OPTIONS = [
  "aberta", "aguardando_pecas", "em_execucao", "finalizada", "cancelada",
];

export default function WorkOrderEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editing = !!id;
  const fromQuoteId = searchParams.get("orcamento");

  const [materials, setMaterials] = useState([]);
  const [services, setServices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [wo, setWo] = useState(null);
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [plateQ, setPlateQ] = useState("");
  const [showPlateResults, setShowPlateResults] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [sending, setSending] = useState(false);
  const [whatsAppPreviewOpen, setWhatsAppPreviewOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, s, v, c, sl] = await Promise.all([
          base44.entities.Material.list("-updated_date", 500),
          base44.entities.Service.list("-updated_date", 500),
          base44.entities.Vehicle.list("-updated_date", 500),
          base44.entities.Customer.list("-updated_date", 500),
          base44.entities.WorkshopSetting.list("-updated_date", 1),
        ]);
        setMaterials(m); setServices(s); setVehicles(v); setCustomers(c);
        setSettings(sl[0] || null);

        if (editing) {
          const [w, wi] = await Promise.all([
            base44.entities.WorkOrder.get(id),
            base44.entities.WorkOrderItem.filter({ work_order_id: id }, "-updated_date", 300),
          ]);
          setWo(w);
          setItems(wi.map((it) => ({ ...it, total: it.total || Math.max(0, (it.quantity || 0) * (it.unit_price || 0) - (it.discount || 0)) })));
        } else if (fromQuoteId) {
          const [q, qi] = await Promise.all([
            base44.entities.Quote.get(fromQuoteId),
            base44.entities.QuoteItem.filter({ quote_id: fromQuoteId }, "-updated_date", 300),
          ]);
          setWo({
            number: "",
            customer_id: q.customer_id,
            customer_name_snapshot: q.customer_name_snapshot,
            vehicle_id: q.vehicle_id,
            plate_snapshot: q.plate_snapshot,
            vehicle_description_snapshot: q.vehicle_description_snapshot,
            mileage_in: q.mileage || 0,
            entry_date: new Date().toISOString(),
            expected_delivery: "",
            customer_report: q.customer_report || "",
            diagnosis: q.diagnosis || "",
            mechanic_id: "",
            internal_notes: "",
            customer_notes: "",
            status: "aberta",
            discount: 0,
            socorro: q.socorro || 0,
            subtotal_parts: 0,
            subtotal_labor: 0,
            total: 0,
            quote_id: fromQuoteId,
          });
          setItems(qi.map((it) => ({
            type: it.type, description: it.description, quantity: it.quantity,
            unit_price: it.unit_price, discount: it.discount, total: it.total,
            material_id: it.material_id || "", service_id: it.service_id || "",
            added_after_approval: false, approval_status: "aprovado",
          })));
          setPlateQ(normalizePlate(q.plate_snapshot));
        } else {
          setWo({
            number: "", customer_id: "", customer_name_snapshot: "", vehicle_id: "",
            plate_snapshot: "", vehicle_description_snapshot: "", mileage_in: 0,
            entry_date: new Date().toISOString(), expected_delivery: "",
            customer_report: "", diagnosis: "", mechanic_id: "",
            internal_notes: "", customer_notes: "", status: "aberta",
            discount: 0, socorro: 0, subtotal_parts: 0, subtotal_labor: 0, total: 0, images: [],
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = (k, v) => setWo((w) => ({ ...w, [k]: v }));

  const searchResults = useMemo(() => {
    const s = plateQ.trim().toLowerCase();
    const np = normalizePlate(plateQ);
    if (!s) return { vehicles: [], customers: [] };
    return {
      vehicles: vehicles
        .filter((v) => normalizePlate(v.plate).includes(np) || (v.brand || "").toLowerCase().includes(s) || (v.model || "").toLowerCase().includes(s))
        .slice(0, 4),
      customers: customers
        .filter((c) => (c.name || "").toLowerCase().includes(s))
        .slice(0, 4),
    };
  }, [plateQ, vehicles, customers]);

  const applyVehicle = (veh) => {
    const owner = customers.find((c) => c.id === veh.current_owner_id);
    setWo((w) => ({
      ...w, vehicle_id: veh.id, plate_snapshot: normalizePlate(veh.plate),
      vehicle_description_snapshot: vehicleDescription(veh),
      mileage_in: w.mileage_in || veh.mileage || 0,
      customer_id: owner?.id || w.customer_id || "",
      customer_name_snapshot: owner?.name || w.customer_name_snapshot || "",
    }));
    setPlateQ(normalizePlate(veh.plate));
    setShowPlateResults(false);
  };

  const applyCustomer = (cust) => {
    setWo((w) => ({
      ...w,
      customer_id: cust.id,
      customer_name_snapshot: cust.name,
    }));
    setPlateQ("");
    setShowPlateResults(false);
  };

  const partsSub = items.filter((i) => i.type === "material").reduce((s, i) => s + (i.total || 0), 0);
  const laborSub = items.filter((i) => i.type === "servico").reduce((s, i) => s + (i.total || 0), 0);
  const grandTotal = Math.max(0, partsSub + laborSub + (wo?.socorro || 0) - (wo?.discount || 0));

  const pastApproval = editing && wo && ["em_execucao", "aguardando_pecas"].includes(wo.status);

  const addItem = (item) => {
    const withFlags = pastApproval
      ? { ...item, added_after_approval: true, approval_status: "aguardando" }
      : { ...item, added_after_approval: false, approval_status: "aprovado" };
    setItems((arr) => [...arr, withFlags]);
  };

  const updateItem = (idx, patch) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      next.total = Math.max(0, (next.quantity || 0) * (next.unit_price || 0) - (next.discount || 0));
      return next;
    }));
  };

  const removeItem = (idx) => setItems((arr) => arr.filter((_, i) => i !== idx));

  const quickLaborItem = items.find((it) => it.type === "servico" && !it.service_id && it.description === "Mão de Obra");
  const quickLaborValue = quickLaborItem?.unit_price || 0;
  const setQuickLabor = (value) => {
    setItems((arr) => {
      const others = arr.filter((it) => !(it.type === "servico" && !it.service_id && it.description === "Mão de Obra"));
      if (!value || value === 0) return others;
      const flags = pastApproval
        ? { added_after_approval: true, approval_status: "aguardando" }
        : { added_after_approval: false, approval_status: "aprovado" };
      return [...others, { type: "servico", description: "Mão de Obra", quantity: 1, unit_price: value, discount: 0, total: value, service_id: "", ...flags }];
    });
  };

  const generateNumber = async () => {
    const all = await base44.entities.WorkOrder.list("-created_date", 500);
    const nums = all.map((w) => parseInt((w.number || "0").replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return String(next).padStart(5, "0");
  };

  const persistItems = async (woId) => {
    await base44.entities.WorkOrderItem.deleteMany({ work_order_id: woId });
    if (items.length) {
      await base44.entities.WorkOrderItem.bulkCreate(items.map((it) => withWorkshop({ ...it, work_order_id: woId })));
    }
  };

  const save = async (statusOverride) => {
    if (!wo.vehicle_id) { toast({ title: "Selecione um veículo", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = {
        ...wo,
        customer_name_snapshot: customers.find((c) => c.id === wo.customer_id)?.name || wo.customer_name_snapshot,
        subtotal_parts: partsSub, subtotal_labor: laborSub, total: grandTotal,
        status: statusOverride || wo.status,
      };
      let woId = id;
      if (editing) {
        await base44.entities.WorkOrder.update(id, payload);
        await persistItems(id);
      } else {
        payload.number = await generateNumber();
        const created = await base44.entities.WorkOrder.create(withWorkshop(payload));
        woId = created.id;
        await persistItems(woId);
        if (fromQuoteId) {
          await base44.entities.Quote.update(fromQuoteId, { status: "convertido_os" });
        }
      }
      setWo((w) => ({ ...w, subtotal_parts: partsSub, subtotal_labor: laborSub, total: grandTotal, status: statusOverride || wo.status }));
      toast({ title: "OS salva" });
      navigate(`/os/${woId}`);
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (newStatus, extra = {}) => {
    if (!editing) return;
    setSaving(true);
    try {
      const patch = { status: newStatus, ...extra };
      if (newStatus === "finalizada") patch.completion_date = new Date().toISOString();
      if (newStatus === "cancelada") patch.cancel_reason = wo.cancel_reason || "";
      await base44.entities.WorkOrder.update(id, patch);
      setWo((w) => ({ ...w, ...patch }));
      toast({ title: `Status: ${workOrderStatusInfo[newStatus]?.label || newStatus}` });
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const approveAdditional = async () => {
    const updated = items.map((it) => it.added_after_approval ? { ...it, approval_status: "aprovado" } : it);
    setItems(updated);
    if (editing) {
      await base44.entities.WorkOrderItem.deleteMany({ work_order_id: id });
      if (updated.length) await base44.entities.WorkOrderItem.bulkCreate(updated.map((it) => withWorkshop({ ...it, work_order_id: id })));
    }
    await changeStatus("em_execucao");
  };

  const handleImageUpload = async (files) => {
    setUploadingImages(true);
    try {
      const urls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        urls.push(file_url);
      }
      setWo((w) => ({ ...w, images: [...(w.images || []), ...urls] }));
    } catch (e) {
      toast({ title: "Erro ao enviar imagem", description: e.message, variant: "destructive" });
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (idx) => {
    setWo((w) => ({ ...w, images: (w.images || []).filter((_, i) => i !== idx) }));
  };

  const exportPDF = async () => {
    if (!wo) return;
    await generateWorkOrderPDF(wo, items, settings, customers.find((customer) => customer.id === wo.customer_id));
  };

  const sendViaWhatsApp = async () => {
    const customer = customers.find((customer) => customer.id === wo.customer_id);
    const phone = customer?.whatsapp || customer?.phone;
    if (!phone) {
      toast({ title: "Cliente sem WhatsApp/telefone cadastrado", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const blob = await generateWorkOrderPDFBlob(wo, items, settings, customer);
      await sendWhatsAppDocument({
        blob, fileName: `os-${wo.number}.pdf`, phone, recipientName: customer?.name,
        reference: wo.number, documentType: "work-order",
      });
      toast({ title: "Ordem de Serviço enviada pelo WhatsApp." });
      setWhatsAppPreviewOpen(false);
    } catch (error) {
      toast({ title: "Erro ao enviar", description: getWhatsAppErrorMessage(error), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const openWhatsAppPreview = () => {
    const customer = customers.find((customer) => customer.id === wo.customer_id);
    if (!(customer?.whatsapp || customer?.phone)) {
      toast({ title: "Cliente sem WhatsApp/telefone cadastrado", variant: "destructive" });
      return;
    }
    setWhatsAppPreviewOpen(true);
  };

  const exportNonFiscalReceipt = async () => {
    if (!wo || wo.status !== "finalizada" || wo.payment_status !== "pago") return;
    await generateNonFiscalReceiptPDF(wo, items, settings, customers.find((customer) => customer.id === wo.customer_id), payments);
  };

  if (loading || !wo) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  const hasPendingAdditional = items.some((i) => i.added_after_approval && i.approval_status === "aguardando");

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <WhatsAppPreviewDialog
        open={whatsAppPreviewOpen}
        onOpenChange={setWhatsAppPreviewOpen}
        recipientName={customers.find((customer) => customer.id === wo.customer_id)?.name}
        message={getWhatsAppDocumentPreview({ recipientName: customers.find((customer) => customer.id === wo.customer_id)?.name, workshopName: settings?.name, reference: wo.number, documentType: "work-order" })}
        attachmentName={`os-${wo.number}.pdf`}
        onConfirm={sendViaWhatsApp}
        sending={sending}
      />
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-2">
          {editing && <WorkOrderStatusBadge status={wo.status} />}
          {editing && <Button size="sm" variant="outline" onClick={exportPDF}><FileDown className="w-4 h-4 mr-1" /> PDF</Button>}
          {editing && <Button size="sm" onClick={openWhatsAppPreview} disabled={sending} className="bg-[#25D366] text-white hover:bg-[#1ebe5d]"><MessageCircle className="w-4 h-4 mr-1" /> WhatsApp</Button>}
          {editing && wo.status === "finalizada" && wo.payment_status === "pago" && (
            <Button size="sm" variant="outline" onClick={exportNonFiscalReceipt}><ReceiptText className="w-4 h-4 mr-1" /> Recibo</Button>
          )}
          <Button size="sm" onClick={() => save()} disabled={saving}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
        </div>
      </div>

      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold">
          {editing ? `OS #${wo.number}` : fromQuoteId ? "Converter Orçamento em OS" : "Nova Ordem de Serviço"}
        </h1>
        <p className="text-sm text-muted-foreground">Entrada: {formatDateTime(wo.entry_date)}</p>
      </div>

      {/* Vehicle */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Label>Buscar veículo ou cliente *</Label>
        {!wo.vehicle_id ? (
          <div className="relative">
            <Input
              className="h-12 text-base"
              placeholder="Digite a placa, marca, modelo ou nome do cliente"
              value={plateQ}
              onChange={(e) => { setPlateQ(e.target.value.toUpperCase()); setShowPlateResults(true); }}
              onFocus={() => setShowPlateResults(true)}
            />
            {showPlateResults && plateQ && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-64 overflow-auto">
                {searchResults.vehicles.length === 0 && searchResults.customers.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    Nenhum resultado.{" "}
                    <button className="text-primary underline" onClick={() => navigate("/veiculos/novo")}>Cadastrar veículo</button>
                  </div>
                ) : (
                  <>
                    {searchResults.vehicles.map((v) => (
                      <button key={v.id} onClick={() => applyVehicle(v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-accent border-b border-border last:border-0">
                        <Car className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{vehicleDescription(v)}</div>
                          <div className="text-xs text-muted-foreground">{normalizePlate(v.plate)}</div>
                        </div>
                      </button>
                    ))}
                    {searchResults.customers.map((c) => (
                      <button key={c.id} onClick={() => applyCustomer(c)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-accent border-b border-border last:border-0">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.phone || c.whatsapp || ""}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-accent/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{wo.vehicle_description_snapshot}</div>
                <div className="text-sm text-primary font-mono">{wo.plate_snapshot}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> {wo.customer_name_snapshot || "Sem proprietário"}
                </div>
              </div>
              <button onClick={() => { set("vehicle_id", ""); set("plate_snapshot", ""); set("vehicle_description_snapshot", ""); setPlateQ(""); }} className="text-xs text-muted-foreground hover:text-foreground underline shrink-0">Trocar</button>
            </div>
          </div>
        )}

        {/* Customer fallback select */}
        {!wo.customer_id && wo.vehicle_id && (
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente (proprietário)</Label>
            <Select value={wo.customer_id || "nenhum"} onValueChange={(v) => {
              const c = customers.find((x) => x.id === v);
              set("customer_id", v === "nenhum" ? "" : v);
              if (c) set("customer_name_snapshot", c.name);
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">—</SelectItem>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Vehicle picker for selected customer */}
        {wo.customer_id && !wo.vehicle_id && (
          <div className="space-y-1.5">
            <Label className="text-xs">Veículo do cliente</Label>
            <Select value="nenhum" onValueChange={(v) => {
              if (v === "nenhum") return;
              const veh = vehicles.find((x) => x.id === v);
              if (veh) applyVehicle(veh);
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">—</SelectItem>
                {vehicles.filter((v) => v.current_owner_id === wo.customer_id).map((v) =>
                  <SelectItem key={v.id} value={v.id}>{vehicleDescription(v)} · {normalizePlate(v.plate)}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Km Entrada</Label>
            <Input type="number" className="h-11" value={wo.mileage_in} onChange={(e) => set("mileage_in", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Previsão Entrega</Label>
            <Input type="date" className="h-11" value={wo.expected_delivery || ""} onChange={(e) => set("expected_delivery", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Relato + voice */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label>Relato do Cliente</Label>
          <VoiceInput onTranscript={(text) => set("customer_report", wo.customer_report ? `${wo.customer_report} ${text}` : text)} />
        </div>
        <Textarea rows={3} className="text-base" value={wo.customer_report} onChange={(e) => set("customer_report", e.target.value)} placeholder="O que o cliente relatou..." />
      </div>

      {/* Diagnóstico + voice */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label>Diagnóstico</Label>
          <VoiceInput onTranscript={(text) => set("diagnosis", wo.diagnosis ? `${wo.diagnosis} ${text}` : text)} />
        </div>
        <Textarea rows={3} className="text-base" value={wo.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} placeholder="Diagnóstico técnico..." />
      </div>

      {/* Fotos anexadas */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Label>Fotos Anexadas ({(wo.images || []).length})</Label>
        <div className="flex flex-wrap gap-2">
          {(wo.images || []).map((url, i) => (
            <div key={i} className="relative group w-40 aspect-square">
              <ImgCmp src={url} alt={`Foto ${i + 1}`} className="w-full h-full rounded-lg" fittingType="fill" />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <label className="flex flex-col items-center justify-center w-40 aspect-square border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files);
                if (files.length) handleImageUpload(files);
                e.target.value = "";
              }}
            />
            {uploadingImages ? (
              <div className="w-6 h-6 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="w-6 h-6 text-muted-foreground" />
            )}
          </label>
        </div>
        <label className="flex items-center justify-center gap-2 w-full h-11 rounded-lg border border-border bg-card cursor-pointer hover:bg-accent transition text-sm font-medium">
          <Camera className="w-4 h-4" /> Tirar Foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files);
              if (files.length) handleImageUpload(files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* Items */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-medium text-sm">Itens ({items.length})</h2>
          {hasPendingAdditional && <span className="text-xs text-orange-600 font-medium">Itens aguardando aprovação</span>}
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum item.</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it, idx) => (
              <div key={idx} className={`px-4 py-3 ${it.added_after_approval ? "bg-orange-50/50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${it.type === "material" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {it.type === "material" ? "PEÇA" : "M.O."}
                      </span>
                      <span className="text-sm font-medium truncate">{it.description}</span>
                      {it.added_after_approval && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${it.approval_status === "aguardando" ? "bg-orange-200 text-orange-800" : "bg-emerald-100 text-emerald-700"}`}>
                          {it.approval_status === "aguardando" ? "AGUARDANDO" : "APROVADO"}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => removeItem(idx)} className="p-1 text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div><Label className="text-[10px] text-muted-foreground">Qtd</Label>
                    <Input type="number" className="h-9 text-sm" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value)) })} /></div>
                  <div><Label className="text-[10px] text-muted-foreground">Unit.</Label>
                    <CurrencyInput className="h-9 text-sm" value={it.unit_price} onValueChange={(v) => updateItem(idx, { unit_price: v })} /></div>
                  <div><Label className="text-[10px] text-muted-foreground">Desc.</Label>
                    <CurrencyInput className="h-9 text-sm" value={it.discount} onValueChange={(v) => updateItem(idx, { discount: v })} /></div>
                </div>
                <div className="mt-1 text-right text-sm font-medium">{formatCurrency(it.total)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="p-3">
          <Button variant="outline" className="w-full h-12" onClick={() => setPickerOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar Peça / Serviço
          </Button>
        </div>
      </div>

      {/* Quick labor input */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <Label className="text-xs">Mão de Obra</Label>
        <CurrencyInput className="h-11" value={quickLaborValue} onValueChange={setQuickLabor} />
        <p className="text-xs text-muted-foreground">Valor direto da mão de obra. Para detalhar por serviço, use "Adicionar Peça / Serviço" acima.</p>
      </div>

      {/* Socorro */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <Label className="text-xs">Socorro (deslocamento / atendimento externo)</Label>
        <CurrencyInput className="h-11" value={wo.socorro} onValueChange={(v) => set("socorro", v)} />
        <p className="text-xs text-muted-foreground">Valor de deslocamento, busca de veículo ou assistência fora da oficina.</p>
      </div>

      {/* Discount */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <Label className="text-xs">Desconto sobre o total</Label>
        <CurrencyInput className="h-11" value={wo.discount} onValueChange={(v) => set("discount", v)} />
      </div>

      {/* Internal notes */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
        <Label className="text-xs">Observações Internas</Label>
        <Textarea rows={2} value={wo.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} />
      </div>

      {/* Status (editing) */}
      {editing && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={wo.status} onValueChange={(v) => changeStatus(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{workOrderStatusInfo[s]?.label || s}</SelectItem>)}
            </SelectContent>
          </Select>
          {wo.status === "cancelada" && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs">Motivo do Cancelamento (opcional)</Label>
              <Textarea rows={2} value={wo.cancel_reason || ""} onChange={(e) => set("cancel_reason", e.target.value)}
                placeholder="Ex: cliente desistiu, orçamento recusado..." />
            </div>
          )}
        </div>
      )}

      {/* Payments + Notification (editing only) */}
      {editing && (
        <>
          <OSPayments workOrderId={id} wo={wo} total={grandTotal} onPaymentsChange={setPayments} />
          <OSNotification wo={wo} onUpdate={(patch) => setWo((w) => ({ ...w, ...patch }))} />
        </>
      )}

      {/* Totals */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 md:static z-20 bg-background/95 backdrop-blur border-t md:border border-border px-4 py-3 md:rounded-xl">
        <div className="md:max-w-7xl md:mx-auto flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="text-muted-foreground">Peças: <span className="text-foreground font-medium">{formatCurrency(partsSub)}</span></div>
            <div className="text-muted-foreground">Mão de obra: <span className="text-foreground font-medium">{formatCurrency(laborSub)}</span></div>
            {wo.socorro > 0 && <div className="text-muted-foreground">Socorro: <span className="text-foreground font-medium">{formatCurrency(wo.socorro)}</span></div>}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">TOTAL</div>
            <div className="text-xl font-bold">{formatCurrency(grandTotal)}</div>
          </div>
        </div>
      </div>

      <QuoteItemPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onAdd={addItem} materials={materials} services={services} />
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Mic, CalendarDays, Check, X, Car, User, Save, ChevronDown, FileDown, ClipboardList, Camera, Send,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { withWorkshop } from "@/lib/workshop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CurrencyInput from "@/components/CurrencyInput";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import VoiceInput from "@/components/VoiceInput";
import { Image as ImgCmp } from "@/components/ui/image";
import QuoteItemPicker from "@/components/QuoteItemPicker";
import SchedulePicker from "@/components/SchedulePicker";
import { QuoteStatusBadge, quoteStatusInfo } from "@/components/StatusBadge";
import {
  normalizePlate, vehicleDescription, formatCurrency, formatDate, todayISO, addDaysISO,
} from "@/lib/format";
import { generateQuotePDF, generateQuotePDFBlob } from "@/lib/pdf";
import { toast } from "@/components/ui/use-toast";

const STATUS_OPTIONS = [
  "rascunho", "aguardando_aprovacao", "aprovado", "parcialmente_aprovado",
  "aguardando_agendamento", "agendado", "recusado", "convertido_os", "cancelado",
];

const APPROVAL_METHODS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefone", label: "Telefone" },
  { value: "presencial", label: "Presencial" },
  { value: "email", label: "E-mail" },
  { value: "outro", label: "Outro" },
];

export default function QuoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editing = !!id;

  const [materials, setMaterials] = useState([]);
  const [services, setServices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [quote, setQuote] = useState(null);
  const [items, setItems] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(null); // 'approve' | 'reject' | 'partial'
  const [approvalMethod, setApprovalMethod] = useState("whatsapp");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [partialSelection, setPartialSelection] = useState({});
  const [uploadingImages, setUploadingImages] = useState(false);
  const [sending, setSending] = useState(false);

  // vehicle search
  const [plateQ, setPlateQ] = useState("");
  const [showPlateResults, setShowPlateResults] = useState(false);

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
        const st = sl[0] || null;
        setSettings(st);

        if (editing) {
          const [q, qi] = await Promise.all([
            base44.entities.Quote.get(id),
            base44.entities.QuoteItem.filter({ quote_id: id }, "-updated_date", 200),
          ]);
          setQuote(q);
          setItems(qi);
        } else {
          const validityDays = st?.default_validity_days || 15;
          setQuote({
            number: "",
            date: todayISO(),
            valid_until: addDaysISO(validityDays),
            customer_id: searchParams.get("cliente") || "",
            vehicle_id: searchParams.get("veiculo") || "",
            customer_name_snapshot: "",
            plate_snapshot: "",
            vehicle_description_snapshot: "",
            mileage: 0,
            customer_report: "",
            diagnosis: "",
            notes: "",
            forecast: "",
            status: "rascunho",
            discount: 0,
            subtotal_parts: 0,
            subtotal_labor: 0,
            total: 0,
            images: [],
          });
          // pre-fill from vehicle if provided
          if (searchParams.get("veiculo")) {
            const veh = v.find((x) => x.id === searchParams.get("veiculo"));
            if (veh) applyVehicle(veh, c);
          } else if (searchParams.get("cliente")) {
            const cust = c.find((x) => x.id === searchParams.get("cliente"));
            if (cust) setQuote((q) => ({ ...q, customer_name_snapshot: cust.name }));
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const applyVehicle = (veh, custList = customers) => {
    const owner = custList.find((c) => c.id === veh.current_owner_id);
    setQuote((q) => ({
      ...q,
      vehicle_id: veh.id,
      plate_snapshot: normalizePlate(veh.plate),
      vehicle_description_snapshot: vehicleDescription(veh),
      mileage: q?.mileage || veh.mileage || 0,
      customer_id: owner?.id || q?.customer_id || "",
      customer_name_snapshot: owner?.name || q?.customer_name_snapshot || "",
    }));
    setPlateQ(normalizePlate(veh.plate));
    setShowPlateResults(false);
  };

  const set = (k, v) => setQuote((q) => ({ ...q, [k]: v }));

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

  const applyCustomer = (cust) => {
    setQuote((q) => ({
      ...q,
      customer_id: cust.id,
      customer_name_snapshot: cust.name,
    }));
    setPlateQ("");
    setShowPlateResults(false);
  };

  // Totals
  const partsSub = items.filter((i) => i.type === "material").reduce((s, i) => s + (i.total || 0), 0);
  const laborSub = items.filter((i) => i.type === "servico").reduce((s, i) => s + (i.total || 0), 0);
  const grandTotal = Math.max(0, partsSub + laborSub - (quote?.discount || 0));

  const updateItem = (idx, patch) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      next.total = Math.max(0, (next.quantity || 0) * (next.unit_price || 0) - (next.discount || 0));
      return next;
    }));
  };

  const removeItem = (idx) => setItems((arr) => arr.filter((_, i) => i !== idx));

  const addItem = (item) => setItems((arr) => [...arr, item]);

  const quickLaborItem = items.find((it) => it.type === "servico" && !it.service_id && it.description === "Mão de Obra");
  const quickLaborValue = quickLaborItem?.unit_price || 0;
  const setQuickLabor = (value) => {
    setItems((arr) => {
      const others = arr.filter((it) => !(it.type === "servico" && !it.service_id && it.description === "Mão de Obra"));
      if (!value || value === 0) return others;
      return [...others, { type: "servico", description: "Mão de Obra", quantity: 1, unit_price: value, discount: 0, total: value, service_id: "" }];
    });
  };

  const generateNumber = async () => {
    const all = await base44.entities.Quote.list("-created_date", 500);
    const nums = all.map((q) => parseInt((q.number || "0").replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return String(next).padStart(5, "0");
  };

  const save = async (statusOverride) => {
    if (!quote.vehicle_id) {
      toast({ title: "Selecione um veículo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...quote,
        customer_name_snapshot: customers.find((c) => c.id === quote.customer_id)?.name || quote.customer_name_snapshot,
        subtotal_parts: partsSub,
        subtotal_labor: laborSub,
        total: grandTotal,
        status: statusOverride || quote.status,
      };
      let quoteId = id;
      if (editing) {
        await base44.entities.Quote.update(id, payload);
        await base44.entities.QuoteItem.deleteMany({ quote_id: id });
      } else {
        payload.number = await generateNumber();
        const created = await base44.entities.Quote.create(withWorkshop(payload));
        quoteId = created.id;
      }
      if (items.length) {
        await base44.entities.QuoteItem.bulkCreate(items.map((it) => withWorkshop({ ...it, quote_id: quoteId })));
      }
      toast({ title: "Orçamento salvo" });
      navigate(`/orcamentos/${quoteId}`);
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const doApproval = async (newStatus) => {
    setSaving(true);
    try {
      const patch = {
        status: newStatus,
        approval_date: new Date().toISOString(),
        approval_method: approvalMethod,
        approval_user: "usuário",
        approval_notes: approvalNotes,
      };
      // partial: update item approved flags
      if (newStatus === "parcialmente_aprovado") {
        // save items with approved flags
        const updatedItems = items.map((it) => ({ ...it, approved: !!partialSelection[it._localId || it.id] }));
        setItems(updatedItems);
        // persist items
        if (editing) {
          await base44.entities.QuoteItem.deleteMany({ quote_id: id });
          if (updatedItems.length) await base44.entities.QuoteItem.bulkCreate(updatedItems.map((it) => withWorkshop({ ...it, quote_id: id })));
        }
      }
      if (editing) await base44.entities.Quote.update(id, patch);
      setQuote((q) => ({ ...q, ...patch }));
      setApprovalOpen(null);
      setApprovalNotes("");
      toast({ title: `Orçamento ${newStatus === "aprovado" ? "aprovado" : newStatus === "recusado" ? "recusado" : "parcialmente aprovado"}` });
    } finally {
      setSaving(false);
    }
  };

  const scheduleService = async (date, time) => {
    if (!editing) return;
    setSaving(true);
    try {
      const appt = await base44.entities.Appointment.create(withWorkshop({
        customer_id: quote.customer_id,
        customer_name_snapshot: quote.customer_name_snapshot,
        vehicle_id: quote.vehicle_id,
        plate_snapshot: quote.plate_snapshot,
        vehicle_description_snapshot: quote.vehicle_description_snapshot,
        scheduled_date: date,
        scheduled_time: time || "",
        type: "servico_agendado",
        reason: `Orçamento #${quote.number}`,
        status: "agendado",
        quote_id: id,
      }));
      await base44.entities.Quote.update(id, { status: "agendado", appointment_id: appt.id });
      setQuote((q) => ({ ...q, status: "agendado", appointment_id: appt.id }));
      toast({ title: `Agendado para ${formatDate(date)}` });
    } catch (e) {
      toast({ title: "Erro ao agendar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (files) => {
    setUploadingImages(true);
    try {
      const urls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        urls.push(file_url);
      }
      setQuote((q) => ({ ...q, images: [...(q.images || []), ...urls] }));
    } catch (e) {
      toast({ title: "Erro ao enviar imagem", description: e.message, variant: "destructive" });
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (idx) => {
    setQuote((q) => ({ ...q, images: (q.images || []).filter((_, i) => i !== idx) }));
  };

  const sendViaWhatsApp = async () => {
    const customer = customers.find((c) => c.id === quote.customer_id);
    let phone = (customer?.whatsapp || customer?.phone || "").replace(/\D/g, "");
    if (!phone) {
      toast({ title: "Cliente sem WhatsApp/telefone cadastrado", variant: "destructive" });
      return;
    }
    if (!phone.startsWith("55")) phone = "55" + phone;
    setSending(true);
    try {
      const blob = await generateQuotePDFBlob(quote, items, settings);
      const file = new File([blob], `orcamento-${quote.number}.pdf`, { type: "application/pdf" });
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const msg = `Olá ${customer.name || ""}! Segue o orçamento #${quote.number} da ${settings?.name || "nossa oficina"}.\n\nAcesse o PDF: ${file_url}`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
      toast({ title: "PDF gerado! Confirme o envio no WhatsApp." });
    } catch (e) {
      toast({ title: "Erro ao gerar/enviar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading || !quote) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  const canApprove = editing && quote.status === "aguardando_aprovacao";
  const canSchedule = editing && ["aprovado", "parcialmente_aprovado", "aguardando_agendamento"].includes(quote.status);
  const expired = quote.valid_until && new Date(quote.valid_until) < new Date(todayISO());

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {editing && <QuoteStatusBadge status={quote.status} />}
          {editing && (
            <Button size="sm" variant="outline" onClick={() => generateQuotePDF(quote, items, settings)}>
              <FileDown className="w-4 h-4 mr-1" /> PDF
            </Button>
          )}
          {editing && (
            <Button size="sm" variant="secondary" onClick={sendViaWhatsApp} disabled={sending}>
              <Send className="w-4 h-4 mr-1" /> {sending ? "Gerando..." : "WhatsApp"}
            </Button>
          )}
          {editing && ["aprovado", "parcialmente_aprovado", "aguardando_agendamento", "agendado"].includes(quote.status) && (
            <Button size="sm" variant="secondary" onClick={() => navigate(`/os/novo?orcamento=${id}`)}>
              <ClipboardList className="w-4 h-4 mr-1" /> Converter em OS
            </Button>
          )}
          <Button size="sm" onClick={() => save()} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> Salvar
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold">
          {editing ? `Orçamento #${quote.number}` : "Novo Orçamento"}
        </h1>
        <p className="text-sm text-muted-foreground">{formatDate(quote.date)}</p>
      </div>

      {/* Vehicle selection */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Label>Buscar veículo ou cliente *</Label>
        {!quote.vehicle_id ? (
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
                <div className="font-medium truncate">{quote.vehicle_description_snapshot}</div>
                <div className="text-sm text-primary font-mono">{quote.plate_snapshot}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> {quote.customer_name_snapshot || "Sem proprietário"}
                </div>
              </div>
              <button onClick={() => { setQuote((q) => ({ ...q, vehicle_id: "", plate_snapshot: "", vehicle_description_snapshot: "" })); setPlateQ(""); }} className="text-xs text-muted-foreground hover:text-foreground underline shrink-0">
                Trocar
              </button>
            </div>
          </div>
        )}

        {/* Customer fallback select */}
        {!quote.customer_id && quote.vehicle_id && (
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente (proprietário)</Label>
            <Select value={quote.customer_id || "nenhum"} onValueChange={(v) => {
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
        {quote.customer_id && !quote.vehicle_id && (
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
                {vehicles.filter((v) => v.current_owner_id === quote.customer_id).map((v) => 
                  <SelectItem key={v.id} value={v.id}>{vehicleDescription(v)} · {normalizePlate(v.plate)}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Quilometragem</Label>
            <Input type="number" className="h-11" value={quote.mileage} onChange={(e) => set("mileage", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Validade</Label>
            <Input type="date" className="h-11" value={quote.valid_until} onChange={(e) => set("valid_until", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Relato + voice */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label>Relato do Cliente</Label>
          <VoiceInput onTranscript={(text) => set("customer_report", quote.customer_report ? `${quote.customer_report} ${text}` : text)} />
        </div>
        <Textarea rows={3} className="text-base" value={quote.customer_report} onChange={(e) => set("customer_report", e.target.value)} placeholder="O que o cliente relatou..." />
      </div>

      {/* Diagnóstico + voice */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label>Diagnóstico / Observação da Oficina</Label>
          <VoiceInput onTranscript={(text) => set("diagnosis", quote.diagnosis ? `${quote.diagnosis} ${text}` : text)} />
        </div>
        <Textarea rows={3} className="text-base" value={quote.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} placeholder="Diagnóstico técnico..." />
      </div>

      {/* Notes + forecast */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Observações Adicionais</Label>
          <Textarea rows={2} value={quote.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Previsão (se necessário)</Label>
          <Input value={quote.forecast} onChange={(e) => set("forecast", e.target.value)} placeholder="ex: 2 dias" />
        </div>
      </div>

      {/* Fotos anexadas */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Label>Fotos Anexadas ({(quote.images || []).length})</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {(quote.images || []).map((url, i) => (
            <div key={i} className="relative group aspect-square">
              <ImgCmp src={url} alt={`Foto ${i + 1}`} className="w-full h-full rounded-lg" fittingType="fill" />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
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
      </div>

      {/* Items */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-medium text-sm">Itens ({items.length})</h2>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum item adicionado.</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it, idx) => (
              <div key={idx} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${it.type === "material" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {it.type === "material" ? "PEÇA" : "M.O."}
                      </span>
                      <span className="text-sm font-medium truncate">{it.description}</span>
                    </div>
                  </div>
                  <button onClick={() => removeItem(idx)} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                    <Input type="number" className="h-9 text-sm" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value)) })} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Valor</Label>
                    <CurrencyInput className="h-9 text-sm" value={it.unit_price} onValueChange={(v) => updateItem(idx, { unit_price: v })} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Desc.</Label>
                    <CurrencyInput className="h-9 text-sm" value={it.discount} onValueChange={(v) => updateItem(idx, { discount: v })} />
                  </div>
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

      {/* Quote-level discount */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <Label className="text-xs">Desconto sobre o total</Label>
        <CurrencyInput className="h-11" value={quote.discount} onValueChange={(v) => set("discount", v)} />
      </div>

      {/* Status (editing) */}
      {editing && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={quote.status} onValueChange={(v) => { set("status", v); save(v); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{quoteStatusInfo[s]?.label || s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Approval actions */}
      {canApprove && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="text-sm font-medium text-amber-900">Aguardando aprovação do cliente</div>
          <div className="grid grid-cols-3 gap-2">
            <Button className="h-11" onClick={() => setApprovalOpen("approve")}><Check className="w-4 h-4 mr-1" /> Aprovar</Button>
            <Button variant="outline" className="h-11" onClick={() => setApprovalOpen("partial")}>Parcial</Button>
            <Button variant="destructive" className="h-11" onClick={() => setApprovalOpen("reject")}><X className="w-4 h-4 mr-1" /> Recusar</Button>
          </div>
        </div>
      )}

      {/* Schedule action */}
      {canSchedule && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="text-sm font-medium text-blue-900">
            {expired ? "Orçamento vencido" : "Aprovado — pronto para agendar"}
          </div>
          {expired && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              Este orçamento venceu em {formatDate(quote.valid_until)}. Confirme os valores antes de realizar o agendamento.
            </div>
          )}
          <Button className="w-full h-12" onClick={() => setScheduleOpen(true)}>
            <CalendarDays className="w-4 h-4 mr-2" /> Agendar Serviço
          </Button>
        </div>
      )}

      {/* Sticky totals bar (mobile) */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 md:static z-20 bg-background/95 backdrop-blur border-t md:border border-border px-4 py-3 md:rounded-xl">
        <div className="md:max-w-7xl md:mx-auto flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="text-muted-foreground">Peças: <span className="text-foreground font-medium">{formatCurrency(partsSub)}</span></div>
            <div className="text-muted-foreground">Mão de obra: <span className="text-foreground font-medium">{formatCurrency(laborSub)}</span></div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">TOTAL</div>
            <div className="text-xl font-bold">{formatCurrency(grandTotal)}</div>
          </div>
        </div>
      </div>

      {/* Pickers */}
      <QuoteItemPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onAdd={addItem} materials={materials} services={services} />
      <SchedulePicker open={scheduleOpen} onClose={() => setScheduleOpen(false)} onConfirm={scheduleService} settings={settings} />

      {/* Approval dialog */}
      <Dialog open={!!approvalOpen} onOpenChange={(o) => !o && setApprovalOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approvalOpen === "approve" ? "Aprovar Orçamento" : approvalOpen === "partial" ? "Aprovação Parcial" : "Recusar Orçamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Forma da Aprovação</Label>
              <Select value={approvalMethod} onValueChange={setApprovalMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPROVAL_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {approvalOpen === "partial" && (
              <div className="space-y-1.5">
                <Label>Selecione os itens aprovados</Label>
                <div className="max-h-52 overflow-y-auto rounded-lg border border-border">
                  {items.map((it, idx) => {
                    const key = it._localId || it.id || idx;
                    return (
                      <label key={idx} className="flex items-center gap-2 px-3 py-2.5 border-b border-border last:border-0">
                        <input
                          type="checkbox"
                          checked={!!partialSelection[key]}
                          onChange={(e) => setPartialSelection((s) => ({ ...s, [key]: e.target.checked }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm flex-1 truncate">{it.description}</span>
                        <span className="text-sm font-medium">{formatCurrency(it.total)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea rows={2} value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button
              variant={approvalOpen === "reject" ? "destructive" : "default"}
              onClick={() => doApproval(approvalOpen === "approve" ? "aprovado" : approvalOpen === "partial" ? "parcialmente_aprovado" : "recusado")}
              disabled={saving}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
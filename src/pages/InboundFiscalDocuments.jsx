import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FileInput, Plus, Search, Upload, Warehouse, WalletCards, FileCode2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  attachInboundXml, createInboundDocument, createInboundMaterial, createInboundPayable, createInboundSupplier,
  getInboundFiscalContext, getInboundFiscalDetails, getInboundXmlUrl, inboundFiscalError, previewInboundXml, processInboundStock, readXmlFile,
} from "@/lib/inboundFiscal";

const emptyDocument = () => ({ document_type: "NFE", supplier_id: "", number: "", series: "", access_key: "", issue_date: "", entry_date: new Date().toISOString().slice(0, 10), total_document: 0 });
const emptyItem = () => ({ description: "", quantity: 1, unit: "un", unit_price: 0, total: 0, material_id: "", track_stock: false });

export default function InboundFiscalDocuments() {
  const [context, setContext] = useState({ documents: [], suppliers: [], materials: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("");
  const [document, setDocument] = useState(emptyDocument());
  const [items, setItems] = useState([emptyItem()]);
  const [xmlFile, setXmlFile] = useState(null);
  const [filters, setFilters] = useState({ query: "", supplier: "all", type: "all", status: "all", start: "", end: "" });
  const attachRef = useRef(null);
  const [attachDocumentId, setAttachDocumentId] = useState("");
  const [details, setDetails] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setContext(await getInboundFiscalContext()); }
    catch (error) { toast({ title: "Erro ao carregar entradas", description: inboundFiscalError(error), variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const close = () => { setMode(""); setDocument(emptyDocument()); setItems([emptyItem()]); setXmlFile(null); };
  const updateItem = (index, patch) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const filtered = useMemo(() => context.documents.filter((entry) => {
    const text = `${entry.number || ""} ${entry.access_key || ""} ${entry.supplier_snapshot?.name || ""}`.toLowerCase();
    const entryDate = entry.entry_date || "";
    return (!filters.query || text.includes(filters.query.toLowerCase()))
      && (filters.supplier === "all" || entry.supplier_id === filters.supplier)
      && (filters.type === "all" || entry.document_type === filters.type)
      && (filters.status === "all" || entry.status === filters.status)
      && (!filters.start || entryDate >= filters.start) && (!filters.end || entryDate <= filters.end);
  }), [context.documents, filters]);

  const openManual = () => { setDocument(emptyDocument()); setItems([emptyItem()]); setXmlFile(null); setMode("manual"); };

  const chooseXml = async (file) => {
    try {
      setSaving(true);
      const encoded = await readXmlFile(file);
      const { preview } = await previewInboundXml(encoded);
      setXmlFile(encoded);
      setDocument({ document_type: preview.document_type, supplier_id: preview.supplier_id || "", number: preview.number || "", series: preview.series || "", access_key: preview.access_key || "", issue_date: (preview.issue_date || "").slice(0, 10), entry_date: new Date().toISOString().slice(0, 10), total_document: preview.total_document || 0, supplier_preview: preview.supplier });
      setItems(preview.items.map((item) => ({ ...item, track_stock: !!item.material_id && item.item_type === "PRODUCT" })));
      setMode("xml");
    } catch (error) { toast({ title: "XML não aceito", description: inboundFiscalError(error), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const createSupplier = async () => {
    try {
      const result = await createInboundSupplier(document.supplier_preview);
      setDocument((current) => ({ ...current, supplier_id: result.supplier.id }));
      await load();
      toast({ title: result.existing ? "Fornecedor já cadastrado" : "Fornecedor criado" });
    } catch (error) { toast({ title: "Erro ao criar fornecedor", description: inboundFiscalError(error), variant: "destructive" }); }
  };

  const createMaterial = async (index) => {
    const item = items[index];
    if (!window.confirm(`Criar o material “${item.description}” com os dados deste XML?`)) return;
    try {
      const result = await createInboundMaterial({ description: item.description, unit: item.unit, gtin: item.gtin, ncm: item.ncm, cest: item.cest, cost: item.unit_price });
      updateItem(index, { material_id: result.material.id, matched_material_name: result.material.description, track_stock: true });
      await load();
      toast({ title: "Material criado" });
    } catch (error) { toast({ title: "Erro ao criar material", description: inboundFiscalError(error), variant: "destructive" }); }
  };

  const save = async () => {
    if (!document.supplier_id) { toast({ title: "Selecione ou crie o fornecedor", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await createInboundDocument(document, items, mode === "xml" ? xmlFile : null);
      close();
      await load();
      toast({ title: "Documento de entrada registrado" });
    } catch (error) { toast({ title: "Erro ao registrar entrada", description: inboundFiscalError(error), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const processStock = async (entry) => {
    if (!window.confirm(`Confirmar a entrada no estoque da ${entry.document_type} #${entry.number}?`)) return;
    try { await processInboundStock(entry.id); await load(); toast({ title: "Estoque movimentado com histórico" }); }
    catch (error) { toast({ title: "Erro no estoque", description: inboundFiscalError(error), variant: "destructive" }); }
  };

  const createPayable = async (entry) => {
    const dueDate = window.prompt("Vencimento da conta a pagar (AAAA-MM-DD). Deixe vazio se ainda não definido:", "") ?? null;
    if (dueDate === null) return;
    try { await createInboundPayable(entry.id, dueDate); await load(); toast({ title: "Conta a pagar criada em Despesas" }); }
    catch (error) { toast({ title: "Erro no financeiro", description: inboundFiscalError(error), variant: "destructive" }); }
  };

  const openXml = async (entry) => {
    try { const result = await getInboundXmlUrl(entry.id); window.open(result.signed_url, "_blank", "noopener,noreferrer"); }
    catch (error) { toast({ title: "Erro ao abrir XML", description: inboundFiscalError(error), variant: "destructive" }); }
  };

  const attachXml = async (file) => {
    try { const encoded = await readXmlFile(file); await attachInboundXml(attachDocumentId, encoded); setAttachDocumentId(""); await load(); toast({ title: "XML vinculado ao lançamento manual" }); }
    catch (error) { toast({ title: "XML não vinculado", description: inboundFiscalError(error), variant: "destructive" }); }
    finally { if (attachRef.current) attachRef.current.value = ""; }
  };

  const toggleDetails = async (entry) => {
    if (details?.document.id === entry.id) { setDetails(null); return; }
    try { setDetails(await getInboundFiscalDetails(entry.id)); }
    catch (error) { toast({ title: "Erro ao carregar detalhes", description: inboundFiscalError(error), variant: "destructive" }); }
  };

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-xl md:text-2xl font-heading font-semibold">Documentos de Entrada</h1><p className="text-sm text-muted-foreground">NF-e recebida e NFS-e de serviço tomado</p></div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={openManual}><Plus className="mr-2 h-4 w-4" />Nova entrada manual</Button>
        <Label className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Upload className="mr-2 h-4 w-4" />{saving ? "Processando..." : "Importar XML"}
          <input className="hidden" type="file" accept=".xml,application/xml,text/xml" disabled={saving} onChange={(event) => event.target.files?.[0] && chooseXml(event.target.files[0])} />
        </Label>
      </div>
    </div>

    <div className="grid gap-2 rounded-xl border border-border bg-card p-3 md:grid-cols-4 lg:grid-cols-7">
      <div className="relative md:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Número, fornecedor ou chave" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} /></div>
      <Select value={filters.supplier} onValueChange={(value) => setFilters({ ...filters, supplier: value })}><SelectTrigger><SelectValue placeholder="Fornecedor" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os fornecedores</SelectItem>{context.suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}</SelectContent></Select>
      <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem><SelectItem value="NFE">NF-e</SelectItem><SelectItem value="NFSE">NFS-e</SelectItem></SelectContent></Select>
      <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="REGISTERED">Registrado</SelectItem><SelectItem value="PARTIALLY_PROCESSED">Parcialmente processado</SelectItem><SelectItem value="PROCESSED">Processado</SelectItem></SelectContent></Select>
      <Input type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
      <Input type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
    </div>

    {loading ? <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div> : filtered.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum documento de entrada encontrado.</div> : <div className="space-y-2">{filtered.map((entry) => <div key={entry.id} className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-medium">{entry.document_type} #{entry.number} <span className="ml-1 text-xs text-muted-foreground">{entry.source_type}</span></div><div className="text-sm">{entry.supplier_snapshot?.name || "Fornecedor não identificado"}</div><div className="text-xs text-muted-foreground">Entrada em {formatDate(entry.entry_date)} · {entry.status}</div></div><div className="text-lg font-semibold">{formatCurrency(entry.total_document || 0)}</div></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => toggleDetails(entry)}><ChevronDown className={`mr-1.5 h-4 w-4 transition-transform ${details?.document.id === entry.id ? "rotate-180" : ""}`} />Detalhes</Button>
        {entry.document_type === "NFE" && !entry.stock_processed_at && <Button size="sm" variant="outline" onClick={() => processStock(entry)}><Warehouse className="mr-1.5 h-4 w-4" />Confirmar estoque</Button>}
        {!entry.financial_processed_at && <Button size="sm" variant="outline" onClick={() => createPayable(entry)}><WalletCards className="mr-1.5 h-4 w-4" />Gerar conta a pagar</Button>}
        {entry.xml_file_uri && <Button size="sm" variant="ghost" onClick={() => openXml(entry)}><FileCode2 className="mr-1.5 h-4 w-4" />XML privado</Button>}
        {entry.source_type === "MANUAL" && !entry.xml_file_uri && <Button size="sm" variant="ghost" onClick={() => { setAttachDocumentId(entry.id); setTimeout(() => attachRef.current?.click(), 0); }}><FileInput className="mr-1.5 h-4 w-4" />Vincular XML</Button>}
      </div>
      {details?.document.id === entry.id && <div className="mt-3 grid gap-3 border-t border-border pt-3 lg:grid-cols-2">
        <div><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Itens</h3><div className="space-y-1">{details.items.map((item) => <div key={item.id} className="flex justify-between gap-3 text-xs"><span>{item.quantity} {item.unit} · {item.description}{item.track_stock ? " · estoque" : ""}</span><span className="font-medium">{formatCurrency(item.total || 0)}</span></div>)}</div></div>
        <div><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Histórico</h3><div className="space-y-1">{details.events.map((event) => <div key={event.id} className="text-xs"><span className="font-medium">{event.event_type}</span> · {event.status || "—"}</div>)}</div></div>
        <div className="text-xs text-muted-foreground">Movimentações de estoque: {details.movements.length}</div>
        <div className="text-xs text-muted-foreground">Conta a pagar: {details.expense ? `${details.expense.status} · ${formatCurrency(details.expense.amount || 0)}` : "não gerada"}</div>
      </div>}
    </div>)}</div>}
    <input ref={attachRef} className="hidden" type="file" accept=".xml,application/xml,text/xml" onChange={(event) => event.target.files?.[0] && attachXml(event.target.files[0])} />

    <Dialog open={!!mode} onOpenChange={(open) => !open && close()}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{mode === "xml" ? `Prévia do XML — ${document.document_type} #${document.number}` : "Nova entrada manual"}</DialogTitle><DialogDescription>Revise o fornecedor e cada item antes de registrar. Nada movimenta estoque nesta etapa.</DialogDescription></DialogHeader>
      <div className="grid gap-3 md:grid-cols-4">
        <div><Label>Tipo</Label><Select disabled={mode === "xml"} value={document.document_type} onValueChange={(value) => setDocument({ ...document, document_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NFE">NF-e — materiais</SelectItem><SelectItem value="NFSE">NFS-e — serviço tomado</SelectItem></SelectContent></Select></div>
        <div><Label>Número *</Label><Input disabled={mode === "xml"} value={document.number} onChange={(e) => setDocument({ ...document, number: e.target.value })} /></div>
        <div><Label>Série</Label><Input disabled={mode === "xml"} value={document.series} onChange={(e) => setDocument({ ...document, series: e.target.value })} /></div>
        <div><Label>Valor total *</Label><Input type="number" disabled={mode === "xml"} value={document.total_document} onChange={(e) => setDocument({ ...document, total_document: Number(e.target.value) })} /></div>
        <div className="md:col-span-2"><Label>Fornecedor *</Label><Select value={document.supplier_id || "none"} onValueChange={(value) => setDocument({ ...document, supplier_id: value === "none" ? "" : value })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="none">Selecione</SelectItem>{context.suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name} — {supplier.cpf_cnpj || "sem documento"}</SelectItem>)}</SelectContent></Select>{mode === "xml" && !document.supplier_id && <div className="mt-2 flex items-center justify-between rounded-md bg-amber-50 p-2 text-xs text-amber-800"><span>Fornecedor não cadastrado: {document.supplier_preview?.name}</span><Button size="sm" variant="outline" onClick={createSupplier}>Criar fornecedor</Button></div>}</div>
        <div><Label>Emissão</Label><Input type="date" value={document.issue_date} onChange={(e) => setDocument({ ...document, issue_date: e.target.value })} /></div>
        <div><Label>Data de entrada *</Label><Input type="date" value={document.entry_date} onChange={(e) => setDocument({ ...document, entry_date: e.target.value })} /></div>
      </div>
      <div className="space-y-2"><div className="flex items-center justify-between"><h3 className="font-medium">Itens ({items.length})</h3>{mode === "manual" && <Button size="sm" variant="outline" onClick={() => setItems([...items, emptyItem()])}><Plus className="mr-1 h-4 w-4" />Item</Button>}</div>{items.map((item, index) => <div key={item.source_item_id || index} className="grid gap-2 rounded-lg border p-3 md:grid-cols-12">
        <div className="md:col-span-4"><Label>Descrição</Label><Input disabled={mode === "xml"} value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} /></div>
        <div className="md:col-span-1"><Label>Qtd.</Label><Input type="number" disabled={mode === "xml"} value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value), total: Number(e.target.value) * Number(item.unit_price || 0) })} /></div>
        <div className="md:col-span-1"><Label>Un.</Label><Input disabled={mode === "xml"} value={item.unit} onChange={(e) => updateItem(index, { unit: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Valor unit.</Label><Input type="number" disabled={mode === "xml"} value={item.unit_price} onChange={(e) => updateItem(index, { unit_price: Number(e.target.value), total: Number(item.quantity || 0) * Number(e.target.value) })} /></div>
        <div className="md:col-span-3"><Label>Material relacionado</Label><Select value={item.material_id || "none"} onValueChange={(value) => updateItem(index, { material_id: value === "none" ? "" : value, track_stock: value !== "none" && item.track_stock })}><SelectTrigger><SelectValue placeholder="Não vinculado" /></SelectTrigger><SelectContent><SelectItem value="none">Não vinculado</SelectItem>{context.materials.map((material) => <SelectItem key={material.id} value={material.id}>{material.description}</SelectItem>)}</SelectContent></Select>{mode === "xml" && !item.material_id && <Button className="mt-1 h-7" size="sm" variant="ghost" onClick={() => createMaterial(index)}>Criar material</Button>}</div>
        <div className="flex items-end justify-end md:col-span-1">{mode === "manual" && items.length > 1 && <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>}</div>
        {document.document_type === "NFE" && <div className="flex items-center justify-between gap-3 md:col-span-12"><div className="text-xs text-muted-foreground">{item.material_id ? `Vinculado${item.matched_material_name ? ` a ${item.matched_material_name}` : ""}` : "Material não encontrado ou item sem controle"}</div><div className="flex items-center gap-2"><Label htmlFor={`stock-${index}`} className="text-xs">Controlar estoque</Label><Switch id={`stock-${index}`} disabled={!item.material_id} checked={!!item.track_stock} onCheckedChange={(checked) => updateItem(index, { track_stock: checked })} /></div></div>}
      </div>)}</div>
      <DialogFooter><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={saving} onClick={save}>{saving ? "Registrando..." : "Registrar entrada"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}

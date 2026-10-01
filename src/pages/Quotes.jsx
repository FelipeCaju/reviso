import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, Plus, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuoteStatusBadge, QuoteWhatsAppSentBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, normalizePlate } from "@/lib/format";

const STATUS_FILTERS = [["todos", "Todos status"], ["rascunho", "Rascunhos"], ["aguardando_aprovacao", "Aguardando aprovação"], ["aprovado", "Aprovados"], ["cancelado", "Cancelados"]];

export default function Quotes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(searchParams.get("status") || "todos");
  const [customer, setCustomer] = useState("todos"); const [plate, setPlate] = useState("");
  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  useEffect(() => { (async () => { try { setItems(await base44.entities.Quote.list("-date", 500)); } finally { setLoading(false); } })(); }, []);
  const customers = useMemo(() => [...new Map(items.filter((item) => item.customer_id).map((item) => [item.customer_id, item.customer_name_snapshot || "Cliente"])).entries()], [items]);
  const filtered = useMemo(() => items.filter((item) => {
    const term = search.toLowerCase(); const matchesSearch = !term || [item.number, item.customer_name_snapshot, item.plate_snapshot, item.vehicle_description_snapshot].some((value) => String(value || "").toLowerCase().includes(term));
    return matchesSearch && (status === "todos" || item.status === status) && (customer === "todos" || item.customer_id === customer) && (!plate || normalizePlate(item.plate_snapshot).includes(normalizePlate(plate))) && (!startDate || (item.date || "") >= startDate) && (!endDate || (item.date || "") <= endDate);
  }), [items, search, status, customer, plate, startDate, endDate]);
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-xl md:text-2xl font-heading font-semibold">Orçamentos</h1><p className="text-sm text-muted-foreground">{items.length} no total</p></div><Button onClick={() => navigate("/orcamentos/novo")}><Plus className="w-4 h-4 mr-2" /> Novo</Button></div>
    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-10 h-11" placeholder="Buscar nº, cliente, placa..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div className="flex flex-wrap gap-2"><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-52 h-9"><SelectValue /></SelectTrigger><SelectContent>{STATUS_FILTERS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={customer} onValueChange={setCustomer}><SelectTrigger className="w-52 h-9"><SelectValue placeholder="Cliente" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos clientes</SelectItem>{customers.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select><Input className="w-36 h-9" placeholder="Placa" value={plate} onChange={(event) => setPlate(event.target.value)} /><Input className="w-40 h-9" type="date" aria-label="Data inicial" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><Input className="w-40 h-9" type="date" aria-label="Data final" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
    {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div> : filtered.length === 0 ? <div className="py-16 text-center text-muted-foreground"><FileText className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">Nenhum orçamento encontrado.</p></div> : <div className="space-y-2">{filtered.map((item) => <button key={item.id} onClick={() => navigate(`/orcamentos/${item.id}`)} className="w-full text-left rounded-xl border border-border bg-card p-3 hover:bg-accent transition"><div className="flex items-center justify-between gap-2"><div className="font-medium text-sm">#{item.number}</div><div className="flex items-center gap-1.5 flex-wrap justify-end">{item.whatsapp_sent_at && <QuoteWhatsAppSentBadge />}<QuoteStatusBadge status={item.status} /></div></div><div className="mt-1 text-sm font-medium truncate">{item.customer_name_snapshot || "—"}</div><div className="text-xs text-muted-foreground truncate">{item.vehicle_description_snapshot} · {normalizePlate(item.plate_snapshot)}</div><div className="mt-1 flex items-center justify-between"><span className="text-xs text-muted-foreground">{formatDate(item.date)}</span><span className="text-xs font-medium">{formatCurrency(item.total)}</span></div></button>)}</div>}
  </div>;
}

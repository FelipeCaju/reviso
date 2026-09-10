import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, FileText, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { QuoteStatusBadge, quoteStatusInfo } from "@/components/StatusBadge";
import { normalizePlate, formatCurrency, formatDate } from "@/lib/format";

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunhos" },
  { value: "aguardando_aprovacao", label: "Aguardando Aprovação" },
  { value: "aprovado", label: "Aprovados" },
  { value: "parcialmente_aprovado", label: "Parciais" },
  { value: "aguardando_agendamento", label: "Aguardando Agendamento" },
  { value: "agendado", label: "Agendados" },
  { value: "recusado", label: "Recusados" },
  { value: "cancelado", label: "Cancelados" },
];

export default function Quotes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(searchParams.get("status") || "todos");

  const load = async () => {
    setLoading(true);
    try {
      setItems(await base44.entities.Quote.list("-date", 500));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((it) => {
    const s = q.toLowerCase();
    const matchQ = !s || (it.number || "").toLowerCase().includes(s) ||
      normalizePlate(it.plate_snapshot).toLowerCase().includes(s) ||
      (it.customer_name_snapshot || "").toLowerCase().includes(s);
    const matchF = filter === "todos" || it.status === filter;
    return matchQ && matchF;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">{items.length} no total</p>
        </div>
        <Button onClick={() => navigate("/orcamentos/novo")} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Novo
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar nº, placa, cliente..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum orçamento encontrado.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {filtered.map((it) => (
            <button key={it.id} onClick={() => navigate(`/orcamentos/${it.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-xs font-mono font-semibold shrink-0">
                #{it.number}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{it.customer_name_snapshot || "—"} · {normalizePlate(it.plate_snapshot)}</div>
                <div className="text-xs text-muted-foreground">{formatDate(it.date)} · {formatCurrency(it.total)}</div>
              </div>
              <QuoteStatusBadge status={it.status} />
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
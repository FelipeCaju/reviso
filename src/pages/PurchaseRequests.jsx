import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ShoppingCart, ClipboardList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

const STATUS_INFO = {
  rascunho: { label: "Rascunho", color: "bg-slate-100 text-slate-700" },
  cotacao: { label: "Cotação", color: "bg-blue-100 text-blue-700" },
  aguardando_resposta: { label: "Aguardando Resposta", color: "bg-amber-100 text-amber-700" },
  aprovado: { label: "Aprovado", color: "bg-emerald-100 text-emerald-700" },
  pedido_realizado: { label: "Pedido Realizado", color: "bg-purple-100 text-purple-700" },
  parcialmente_recebido: { label: "Parcialmente Recebido", color: "bg-orange-100 text-orange-700" },
  recebido: { label: "Recebido", color: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

export default function PurchaseRequests() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.PurchaseRequest.list("-date", 500);
        setItems(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter((r) => {
    const s = q.toLowerCase();
    return !s || (r.number || "").toLowerCase().includes(s) || (r.responsible || "").toLowerCase().includes(s) || (r.notes || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Solicitações de Cotação</h1>
          <p className="text-sm text-muted-foreground">{items.length} no total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/pedidos")}>
            <ClipboardList className="w-4 h-4 mr-2" /> Pedidos
          </Button>
          <Button onClick={() => navigate("/compras/nova")}>
            <Plus className="w-4 h-4 mr-2" /> Nova
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <ShoppingCart className="w-8 h-8 opacity-40" />
          Nenhuma solicitação de cotação.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/compras/${r.id}`)}
              className="w-full text-left rounded-xl border border-border bg-card p-3 hover:bg-accent transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">Cotação #{r.number}</div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_INFO[r.status]?.color || "bg-slate-100"}`}>
                  {STATUS_INFO[r.status]?.label || r.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDate(r.date)} {r.responsible ? `· ${r.responsible}` : ""}
              </div>
              {r.notes && <div className="mt-1 text-xs text-muted-foreground truncate">{r.notes}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
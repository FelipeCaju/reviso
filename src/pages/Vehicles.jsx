import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Car, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizePlate, vehicleDescription } from "@/lib/format";
import VehicleFormDialog from "@/components/VehicleFormDialog";

export default function Vehicles() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldOpenNew = searchParams.get("novo") === "1";
  const [items, setItems] = useState([]);
  const [owners, setOwners] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(shouldOpenNew ? "" : (searchParams.get("q") || ""));
  const [newOpen, setNewOpen] = useState(shouldOpenNew);
  const [prePlate, setPrePlate] = useState(shouldOpenNew ? (searchParams.get("q") || "") : "");

  const load = async () => {
    setLoading(true);
    try {
      const [data, customers] = await Promise.all([
        base44.entities.Vehicle.list("-updated_date", 500),
        base44.entities.Customer.list("-updated_date", 500),
      ]);
      setItems(data);
      const map = {};
      customers.forEach((c) => { map[c.id] = c; });
      setOwners(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((v) => {
    const s = q.toLowerCase();
    const np = normalizePlate(q);
    return !s || (v.plate || "").toLowerCase().includes(s) ||
      normalizePlate(v.plate).includes(np) ||
      (v.brand || "").toLowerCase().includes(s) ||
      (v.model || "").toLowerCase().includes(s) ||
      (owners[v.current_owner_id]?.name || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Veículos</h1>
          <p className="text-sm text-muted-foreground">{items.length} cadastrados</p>
        </div>
        <Button onClick={() => { setPrePlate(""); setNewOpen(true); }} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Novo
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar placa, marca, modelo, dono..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Car className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum veículo encontrado.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {filtered.map((v) => (
            <button
              key={v.id}
              onClick={() => navigate(`/veiculos/${v.id}`)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent"
            >
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-xl shrink-0">
                {v.type === "moto" ? "🏍️" : v.type === "caminhao" ? "🚚" : "🚗"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{vehicleDescription(v)}</div>
                <div className="text-xs text-muted-foreground">
                  {normalizePlate(v.plate)} · {owners[v.current_owner_id]?.name || "Sem proprietário"}
                </div>
              </div>
              {!v.active && <span className="text-xs text-muted-foreground">Inativo</span>}
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      <VehicleFormDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        prePlate={prePlate}
        onSaved={(v) => { load(); if (v?.id) navigate(`/veiculos/${v.id}`); }}
      />
    </div>
  );
}
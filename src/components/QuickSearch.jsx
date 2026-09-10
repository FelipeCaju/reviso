import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Car, User } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { normalizePlate, vehicleDescription } from "@/lib/format";

// Busca rápida por placa / cliente / telefone. Carrega veículos e clientes
// uma vez e filtra no cliente (performance adequada para o volume de uma oficina).
export default function QuickSearch({ autoFocus = false, placeholder = "Buscar placa, cliente, telefone..." }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  const loadOnce = async () => {
    if (vehicles.length || customers.length || loading) return;
    setLoading(true);
    try {
      const [v, c] = await Promise.all([
        base44.entities.Vehicle.list("-updated_date", 500),
        base44.entities.Customer.list("-updated_date", 500),
      ]);
      setVehicles(v);
      setCustomers(c);
    } catch (e) {
      /* noop */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const query = q.trim().toLowerCase();
  const norm = normalizePlate(q);

  const vResults = query
    ? vehicles.filter(
        (v) =>
          (norm && normalizePlate(v.plate).includes(norm)) ||
          (v.brand || "").toLowerCase().includes(query) ||
          (v.model || "").toLowerCase().includes(query)
      ).slice(0, 6)
    : [];

  const cResults = query
    ? customers
        .filter(
          (c) =>
            (c.name || "").toLowerCase().includes(query) ||
            (c.phone || "").toLowerCase().includes(query) ||
            (c.cpf_cnpj || "").toLowerCase().includes(query)
        )
        .slice(0, 5)
    : [];

  const hasResults = vResults.length || cResults.length;

  const go = (path) => {
    setOpen(false);
    setQ("");
    navigate(path);
  };

  return (
    <div className="relative w-full" ref={boxRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          className="w-full h-11 pl-10 pr-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={placeholder}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            loadOnce();
          }}
          onFocus={() => {
            setOpen(true);
            loadOnce();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hasResults) {
              if (vResults[0]) go(`/veiculos/${vResults[0].id}`);
              else if (cResults[0]) go(`/clientes/${cResults[0].id}`);
            }
          }}
          autoFocus={autoFocus}
        />
      </div>

      {open && query && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-96 overflow-auto">
          {loading && (
            <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
          )}
          {!loading && !hasResults && (
            <div className="p-3 text-sm text-muted-foreground">
              Nenhum resultado.{" "}
              <button
                className="text-primary underline"
                onClick={() => go(`/veiculos?novo=1&q=${encodeURIComponent(q)}`)}
              >
                Cadastrar novo veículo
              </button>
            </div>
          )}
          {vResults.length > 0 && (
            <div className="p-1">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Veículos</div>
              {vResults.map((v) => (
                <button
                  key={v.id}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-accent"
                  onClick={() => go(`/veiculos/${v.id}`)}
                >
                  <Car className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{vehicleDescription(v)}</div>
                    <div className="text-xs text-muted-foreground">{normalizePlate(v.plate)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {cResults.length > 0 && (
            <div className="p-1 border-t border-border">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Clientes</div>
              {cResults.map((c) => (
                <button
                  key={c.id}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-accent"
                  onClick={() => go(`/clientes/${c.id}`)}
                >
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.phone || c.cpf_cnpj || ""}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
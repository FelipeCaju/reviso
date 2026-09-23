import { useState } from "react";
import { Search, Package, Wrench, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import CurrencyInput from "@/components/CurrencyInput";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";

// Picker mobile-first para adicionar peça, serviço ou item manual ao orçamento.
export default function QuoteItemPicker({ open, onClose, onAdd, materials = [], services = [] }) {
  const [tab, setTab] = useState("material");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null); // { type, description, unit_price, material_id?, service_id? }
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [discount, setDiscount] = useState(0);

  // manual fields
  const [manualType, setManualType] = useState("servico");
  const [manualDesc, setManualDesc] = useState("");

  const reset = () => {
    setPicked(null); setQty(1); setPrice(0); setDiscount(0); setQ(""); setManualDesc("");
  };

  const close = () => { reset(); onClose(); };

  const selectCatalog = (item, type) => {
    setPicked({
      type,
      description: item.description,
      unit_price: type === "material" ? item.sale_price : item.default_price,
      unit: type === "material" ? (item.unit || "un") : "un",
      material_id: type === "material" ? item.id : "",
      service_id: type === "servico" ? item.id : "",
    });
    setPrice(type === "material" ? item.sale_price : item.default_price);
    setQty(1);
    setDiscount(0);
  };

  const addCatalog = () => {
    const total = Math.max(0, qty * price - (discount || 0));
    onAdd({
      type: picked.type,
      description: picked.description,
      quantity: qty,
      unit: picked.unit || "un",
      unit_price: price,
      discount: discount || 0,
      total,
      material_id: picked.material_id || "",
      service_id: picked.service_id || "",
      approved: true,
    });
    reset();
    onClose();
  };

  const addManual = () => {
    if (!manualDesc.trim()) return;
    const total = Math.max(0, qty * price - (discount || 0));
    onAdd({
      type: manualType,
      description: manualDesc,
      quantity: qty,
      unit: "un",
      unit_price: price,
      discount: discount || 0,
      total,
      approved: true,
    });
    reset();
    onClose();
  };

  const s = q.toLowerCase();
  const mats = materials.filter((m) => m.active && (!s || (m.description || "").toLowerCase().includes(s)));
  const svcs = services.filter((m) => m.active && (!s || (m.description || "").toLowerCase().includes(s)));

  const tabs = [
    { key: "material", label: "Peça", icon: Package },
    { key: "servico", label: "Serviço", icon: Wrench },
    { key: "manual", label: "Manual", icon: PenLine },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Item</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setPicked(null); }}
                className={`flex flex-col items-center gap-1 py-2 rounded-md text-xs font-medium transition ${
                  tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab !== "manual" ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-10 h-11" placeholder={`Buscar ${tab === "material" ? "peça" : "serviço"}...`} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            </div>

            <div className="max-h-52 overflow-y-auto -mx-1 rounded-lg border border-border">
              {(tab === "material" ? mats : svcs).length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Nenhum resultado.</div>
              ) : (tab === "material" ? mats : svcs).map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectCatalog(item, tab)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-3 text-left border-b border-border last:border-0 hover:bg-accent ${
                    picked?.description === item.description ? "bg-accent" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{item.description}</div>
                    <div className="text-xs text-muted-foreground">{item.code || item.category || ""}</div>
                  </div>
                  <div className="text-sm font-medium shrink-0">
                    {formatCurrency(tab === "material" ? item.sale_price : item.default_price)}
                  </div>
                </button>
              ))}
            </div>

            {picked && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-3">
                <div className="text-sm font-medium">{picked.description}</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Qtd</Label>
                    <Input type="number" className="h-11" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor</Label>
                    <CurrencyInput className="h-11" value={price} onValueChange={setPrice} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Desc.</Label>
                    <CurrencyInput className="h-11" value={discount} onValueChange={setDiscount} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-lg font-semibold">{formatCurrency(Math.max(0, qty * price - (discount || 0)))}</span>
                </div>
                <Button className="w-full h-12" onClick={addCatalog}>Adicionar</Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
                  {["material", "servico"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setManualType(t)}
                      className={`py-2 rounded-md text-xs font-medium ${manualType === t ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    >
                      {t === "material" ? "Peça" : "Serviço"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Qtd</Label>
                <Input type="number" className="h-11" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição *</Label>
              <Input className="h-11" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} placeholder="Descrição do item" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Valor</Label>
                <CurrencyInput className="h-11" value={price} onValueChange={setPrice} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Desc.</Label>
                <CurrencyInput className="h-11" value={discount} onValueChange={setDiscount} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-semibold">{formatCurrency(Math.max(0, qty * price - (discount || 0)))}</span>
            </div>
            <Button className="w-full h-12" onClick={addManual} disabled={!manualDesc.trim()}>Adicionar</Button>
          </div>
        )}

        <DialogFooter className="hidden">
          <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

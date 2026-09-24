import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { withWorkshop } from "@/lib/workshop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { normalizePlate, vehicleTypeLabel } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";

const EMPTY = {
  type: "carro", plate: "", brand: "", model: "", version: "",
  year_manufacture: "", year_model: "", color: "", fuel: "", mileage: 0,
  chassis: "", renavam: "", notes: "", current_owner_id: "", active: true,
};

const FUELS = ["Gasolina", "Etanol", "Flex", "Diesel", "GNV", "Elétrico", "Híbrido", "Outro"];

export default function VehicleFormDialog({ open, onOpenChange, onSaved, prePlate = "", preOwner = "" }) {
  const [form, setForm] = useState(EMPTY);
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, plate: prePlate || "", current_owner_id: preOwner || "" });
      setErrors({});
      (async () => {
        try {
          const cs = await base44.entities.Customer.list("-updated_date", 500);
          setCustomers(cs);
        } catch (e) { /* noop */ }
      })();
    }
  }, [open, prePlate, preOwner]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const plate = normalizePlate(form.plate);
    if (!plate) {
      setErrors({ plate: "Informe a placa do veículo." });
      toast({ title: "Informe a placa", variant: "destructive" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = { ...form, plate };
      if (payload.year_manufacture === "") delete payload.year_manufacture;
      if (payload.year_model === "") delete payload.year_model;
      const saved = await base44.entities.Vehicle.create(withWorkshop(payload));
      if (form.current_owner_id) {
        await base44.entities.VehicleOwner.create(withWorkshop({
          vehicle_id: saved.id,
          customer_id: form.current_owner_id,
          customer_name_snapshot: customers.find((c) => c.id === form.current_owner_id)?.name || "",
          start_date: new Date().toISOString(),
          active: true,
        }));
      }
      onOpenChange?.(false);
      onSaved?.(saved);
    } catch (error) {
      toast({
        title: "Não foi possível salvar o veículo",
        description: error.response?.data?.error || error.message || "Revise os dados informados.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Veículo</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(vehicleTypeLabel).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Placa *</Label>
            <Input
              value={form.plate}
              onChange={(e) => { set("plate", e.target.value.toUpperCase()); setErrors((current) => ({ ...current, plate: "" })); }}
              placeholder="ABC1D23"
              aria-invalid={!!errors.plate}
              className={errors.plate ? "border-destructive" : ""}
            />
            {errors.plate && <p className="text-xs text-destructive">{errors.plate}</p>}
          </div>
          <div className="space-y-1.5"><Label>Marca</Label>
            <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Modelo</Label>
            <Input value={form.model} onChange={(e) => set("model", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Versão</Label>
            <Input value={form.version} onChange={(e) => set("version", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Cor</Label>
            <Input value={form.color} onChange={(e) => set("color", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Ano Fabricação</Label>
            <Input type="number" value={form.year_manufacture} onChange={(e) => set("year_manufacture", e.target.value ? Number(e.target.value) : "")} /></div>
          <div className="space-y-1.5"><Label>Ano Modelo</Label>
            <Input type="number" value={form.year_model} onChange={(e) => set("year_model", e.target.value ? Number(e.target.value) : "")} /></div>
          <div className="space-y-1.5"><Label>Combustível</Label>
            <Select value={form.fuel || ""} onValueChange={(v) => set("fuel", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {FUELS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Quilometragem</Label>
            <Input type="number" value={form.mileage} onChange={(e) => set("mileage", Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>Chassi</Label>
            <Input value={form.chassis} onChange={(e) => set("chassis", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Renavam</Label>
            <Input value={form.renavam} onChange={(e) => set("renavam", e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Proprietário Atual</Label>
            <Select value={form.current_owner_id || "nenhum"} onValueChange={(v) => set("current_owner_id", v === "nenhum" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem proprietário</SelectItem>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} /> Ativo
            </label>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

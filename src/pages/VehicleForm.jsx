import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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
import { normalizePlate, vehicleTypeLabel } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";

const EMPTY = {
  type: "carro", plate: "", brand: "", model: "", version: "",
  year_manufacture: "", year_model: "", color: "", fuel: "", mileage: 0,
  chassis: "", renavam: "", notes: "", current_owner_id: "", active: true,
};

const FUELS = ["Gasolina", "Etanol", "Flex", "Diesel", "GNV", "Elétrico", "Híbrido", "Outro"];

export default function VehicleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(EMPTY);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cs = await base44.entities.Customer.list("-updated_date", 500);
        setCustomers(cs);
        if (id) {
          const v = await base44.entities.Vehicle.get(id);
          setForm({ ...EMPTY, ...v });
        } else {
          const preOwner = searchParams.get("proprietario");
          if (preOwner) setForm((f) => ({ ...f, current_owner_id: preOwner }));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const plate = normalizePlate(form.plate);
    if (!plate) {
      toast({ title: "Informe a placa", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, plate };
      let saved;
      if (id) {
        saved = await base44.entities.Vehicle.update(id, payload);
        // owner change handling
        await syncOwner(id, form.current_owner_id);
        navigate(`/veiculos/${id}`);
      } else {
        saved = await base44.entities.Vehicle.create(withWorkshop(payload));
        if (form.current_owner_id) {
          await base44.entities.VehicleOwner.create(withWorkshop({
            vehicle_id: saved.id,
            customer_id: form.current_owner_id,
            customer_name_snapshot: customers.find((c) => c.id === form.current_owner_id)?.name || "",
            start_date: new Date().toISOString(),
            active: true,
          }));
        }
        navigate(`/veiculos/${saved.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Close previous active owner and open a new one when ownership changes.
  const syncOwner = async (vehicleId, newOwnerId) => {
    if (!newOwnerId) return;
    const existing = await base44.entities.VehicleOwner.filter({ vehicle_id: vehicleId, active: true }, "-start_date", 10);
    const current = existing[0];
    if (current && current.customer_id === newOwnerId) return;
    if (current) {
      await base44.entities.VehicleOwner.update(current.id, { active: false, end_date: new Date().toISOString() });
    }
    await base44.entities.VehicleOwner.create(withWorkshop({
      vehicle_id: vehicleId,
      customer_id: newOwnerId,
      customer_name_snapshot: customers.find((c) => c.id === newOwnerId)?.name || "",
      start_date: new Date().toISOString(),
      active: true,
    }));
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <h1 className="text-xl md:text-2xl font-heading font-semibold">{id ? "Editar Veículo" : "Novo Veículo"}</h1>

      <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border bg-card p-4">
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
          <Input value={form.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} placeholder="ABC1D23" />
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

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        <Button onClick={save} disabled={saving || !form.plate.trim()}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
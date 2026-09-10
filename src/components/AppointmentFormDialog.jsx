import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { withWorkshop } from "@/lib/workshop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { normalizePlate, vehicleDescription, todayISO, appointmentTypeInfo } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";

const TYPES = Object.entries(appointmentTypeInfo).map(([k, v]) => ({ value: k, label: v.label }));

export default function AppointmentFormDialog({ open, onClose, onSaved, prefill = {}, customers = [], vehicles = [] }) {
  const [form, setForm] = useState({
    customer_id: "",
    vehicle_id: "",
    scheduled_date: todayISO(),
    scheduled_time: "",
    type: "manutencao",
    reason: "",
    notes: "",
    status: "agendado",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        customer_id: prefill.customer_id || "",
        vehicle_id: prefill.vehicle_id || "",
        scheduled_date: prefill.scheduled_date || todayISO(),
        scheduled_time: prefill.scheduled_time || "",
        type: prefill.type || "manutencao",
        reason: prefill.reason || "",
        notes: prefill.notes || "",
        status: prefill.status || "agendado",
      });
    }
  }, [open, prefill]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const vehicleOptions = form.customer_id
    ? vehicles.filter((v) => v.current_owner_id === form.customer_id)
    : vehicles;

  const isPastDateTime = () => {
    const today = todayISO();
    if (form.scheduled_date < today) return true;
    if (form.scheduled_date === today && form.scheduled_time) {
      const now = new Date();
      const [h, m] = form.scheduled_time.split(":").map(Number);
      const scheduled = new Date();
      scheduled.setHours(h, m, 0, 0);
      if (scheduled <= now) return true;
    }
    return false;
  };

  const save = async () => {
    if (!form.customer_id || !form.vehicle_id || !form.scheduled_date) return;
    if (isPastDateTime()) {
      toast({ title: "Não é possível agendar no passado", description: "Selecione uma data e horário futuros.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const cust = customers.find((c) => c.id === form.customer_id);
      const veh = vehicles.find((v) => v.id === form.vehicle_id);
      const payload = {
        ...form,
        customer_name_snapshot: cust?.name || "",
        plate_snapshot: normalizePlate(veh?.plate || ""),
        vehicle_description_snapshot: vehicleDescription(veh),
      };
      await base44.entities.Appointment.create(withWorkshop(payload));
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Select value={form.customer_id || "nenhum"} onValueChange={(v) => set("customer_id", v === "nenhum" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">—</SelectItem>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Veículo *</Label>
            <Select value={form.vehicle_id || "nenhum"} onValueChange={(v) => set("vehicle_id", v === "nenhum" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">—</SelectItem>
                {vehicleOptions.map((v) => <SelectItem key={v.id} value={v.id}>{vehicleDescription(v)} · {normalizePlate(v.plate)}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.customer_id && vehicleOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">Cliente sem veículos. Cadastre um veículo primeiro.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" min={todayISO()} value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input type="time" min={form.scheduled_date === todayISO() ? new Date().toTimeString().slice(0, 5) : undefined} value={form.scheduled_time} onChange={(e) => set("scheduled_time", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Input value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="ex: Troca de óleo" />
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={save} disabled={saving || !form.customer_id || !form.vehicle_id || !form.scheduled_date || isPastDateTime()}>
            {saving ? "Salvando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
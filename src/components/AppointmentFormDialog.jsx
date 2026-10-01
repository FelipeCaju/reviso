import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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

export default function AppointmentFormDialog({ open, onClose, onSaved, prefill = {}, appointment = null, customers = [], vehicles = [] }) {
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
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: "", phone: "", whatsapp: "" });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [createdCustomers, setCreatedCustomers] = useState([]);

  useEffect(() => {
    if (open) {
      const src = appointment || prefill;
      setForm({
        customer_id: src.customer_id || "",
        vehicle_id: src.vehicle_id || "",
        scheduled_date: src.scheduled_date || todayISO(),
        scheduled_time: src.scheduled_time || "",
        type: src.type || "manutencao",
        reason: src.reason || "",
        notes: src.notes || "",
        status: src.status || "agendado",
      });
    }
  }, [open, prefill, appointment]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const customerOptions = [...customers, ...createdCustomers];
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
    if (!appointment && isPastDateTime()) {
      toast({ title: "Não é possível agendar no passado", description: "Selecione uma data e horário futuros.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const cust = customerOptions.find((c) => c.id === form.customer_id);
      const veh = vehicles.find((v) => v.id === form.vehicle_id);
      const payload = {
        ...form,
        customer_name_snapshot: cust?.name || "",
        plate_snapshot: normalizePlate(veh?.plate || ""),
        vehicle_description_snapshot: vehicleDescription(veh),
      };
      if (appointment) {
        await base44.entities.Appointment.update(appointment.id, payload);
      } else {
        await base44.entities.Appointment.create(withWorkshop(payload));
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const saveQuickCustomer = async () => {
    if (!quickCustomer.name.trim()) return;
    setSavingCustomer(true);
    try {
      const created = await base44.entities.Customer.create(withWorkshop({
        name: quickCustomer.name.trim(),
        phone: quickCustomer.phone.trim(),
        whatsapp: quickCustomer.whatsapp.trim(),
        active: true,
      }));
      setCreatedCustomers((current) => [...current, created]);
      set("customer_id", created.id);
      set("vehicle_id", "");
      setQuickCustomer({ name: "", phone: "", whatsapp: "" });
      setQuickCustomerOpen(false);
      toast({ title: "Cliente cadastrado e selecionado" });
    } catch (error) {
      toast({ title: "Erro ao cadastrar cliente", description: error.message, variant: "destructive" });
    } finally {
      setSavingCustomer(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{appointment ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Cliente *</Label>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => setQuickCustomerOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Novo</Button>
            </div>
            <Select value={form.customer_id || "nenhum"} onValueChange={(v) => set("customer_id", v === "nenhum" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">—</SelectItem>
                {customerOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
              <Input type="date" min={appointment ? undefined : todayISO()} value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input type="time" min={!appointment && form.scheduled_date === todayISO() ? new Date().toTimeString().slice(0, 5) : undefined} value={form.scheduled_time} onChange={(e) => set("scheduled_time", e.target.value)} />
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
          <Button onClick={save} disabled={saving || !form.customer_id || !form.vehicle_id || !form.scheduled_date || (!appointment && isPastDateTime())}>
            {saving ? "Salvando..." : appointment ? "Salvar" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome / Razão Social *</Label><Input value={quickCustomer.name} onChange={(event) => setQuickCustomer((current) => ({ ...current, name: event.target.value }))} autoFocus /></div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input value={quickCustomer.phone} onChange={(event) => setQuickCustomer((current) => ({ ...current, phone: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={quickCustomer.whatsapp} onChange={(event) => setQuickCustomer((current) => ({ ...current, whatsapp: event.target.value }))} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={saveQuickCustomer} disabled={savingCustomer || !quickCustomer.name.trim()}>{savingCustomer ? "Salvando..." : "Salvar cliente"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight, Car, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import AppointmentFormDialog from "@/components/AppointmentFormDialog";
import { AppointmentStatusBadge, appointmentTypeInfo } from "@/components/StatusBadge";
import { normalizePlate, formatDate, formatDateTime, todayISO, addDaysISO } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function mondayOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export default function Appointments() {
  const [searchParams] = useSearchParams();
  const isDesktop = useIsDesktop();
  const [appointments, setAppointments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refDay, setRefDay] = useState(todayISO());
  const [formOpen, setFormOpen] = useState(false);
  const [formPrefill, setFormPrefill] = useState({});
  const [detail, setDetail] = useState(null);
  const [detailNotes, setDetailNotes] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [a, c, v, s] = await Promise.all([
        base44.entities.Appointment.list("-updated_date", 500),
        base44.entities.Customer.list("-updated_date", 500),
        base44.entities.Vehicle.list("-updated_date", 500),
        base44.entities.WorkshopSetting.list("-updated_date", 1),
      ]);
      setAppointments(a); setCustomers(c); setVehicles(v); setSettings(s[0] || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (searchParams.get("cliente") || searchParams.get("veiculo")) {
      setFormPrefill({
        customer_id: searchParams.get("cliente") || "",
        vehicle_id: searchParams.get("veiculo") || "",
      });
      setFormOpen(true);
    }
  }, []);

  const weekStart = mondayOf(refDay);
  const weekStartDate = new Date(weekStart + "T00:00:00");
  const days = useMemo(() => Array.from({ length: 6 }, (_, i) => addDaysISO(i, weekStartDate)), [weekStart]);

  const capacityFor = (dateStr) => {
    if (!settings) return 8;
    const day = new Date(dateStr + "T00:00:00").getDay();
    const map = [
      settings.capacity_sunday, settings.capacity_monday, settings.capacity_tuesday,
      settings.capacity_wednesday, settings.capacity_thursday, settings.capacity_friday,
      settings.capacity_saturday,
    ];
    return map[day] ?? settings.default_capacity ?? 8;
  };

  const apptsForDay = (dateStr) =>
    appointments
      .filter((a) => a.scheduled_date === dateStr && !["cancelado"].includes(a.status))
      .sort((a, b) => (a.scheduled_time || "99").localeCompare(b.scheduled_time || "99"));

  const thisWeekStart = mondayOf(todayISO());
  const nextWeekStart = addDaysISO(7, new Date(thisWeekStart + "T00:00:00"));

  const updateStatus = async (appt, status, extra = {}) => {
    const patch = { status, ...extra };
    await base44.entities.Appointment.update(appt.id, patch);
    setAppointments((arr) => arr.map((a) => (a.id === appt.id ? { ...a, ...patch } : a)));
    setDetail((d) => (d && d.id === appt.id ? { ...d, ...patch } : d));
  };

  const saveDetailNotes = async () => {
    if (!detail) return;
    await base44.entities.Appointment.update(detail.id, { notes: detailNotes });
    setAppointments((arr) => arr.map((a) => (a.id === detail.id ? { ...a, notes: detailNotes } : a)));
    setDetail(null);
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const newDate = destination.droppableId;
    if (newDate < todayISO()) {
      toast({ title: "Não é possível agendar em datas passadas", variant: "destructive" });
      return;
    }
    const appt = appointments.find((a) => a.id === draggableId);
    if (!appt) return;
    setAppointments((arr) => arr.map((a) => (a.id === appt.id ? { ...a, scheduled_date: newDate } : a)));
    try {
      await base44.entities.Appointment.update(appt.id, { scheduled_date: newDate });
      toast({ title: `Movido para ${formatDate(newDate)}` });
    } catch (e) {
      setAppointments((arr) => arr.map((a) => (a.id === appt.id ? { ...a, scheduled_date: source.droppableId } : a)));
      toast({ title: "Erro ao mover", description: e.message, variant: "destructive" });
    }
  };

  const weekLabel = `${formatDate(weekStart)} – ${formatDate(addDaysISO(5, new Date(weekStart + "T00:00:00")))}`;

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  const renderCard = (a, draggable = false) => {
    const inner = (
      <>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium">{a.scheduled_time || "s/ horário"}</span>
          <AppointmentStatusBadge status={a.status} />
        </div>
        <div className="text-sm font-medium truncate mt-0.5">{a.customer_name_snapshot}</div>
        <div className="text-xs text-muted-foreground truncate">{a.vehicle_description_snapshot} · {normalizePlate(a.plate_snapshot)}</div>
        {a.reason && <div className="text-xs text-muted-foreground truncate mt-0.5">{a.reason}</div>}
      </>
    );
    if (!draggable) {
      return (
        <button key={a.id} onClick={() => { setDetail(a); setDetailNotes(a.notes || ""); }}
          className="w-full text-left rounded-lg bg-accent/40 hover:bg-accent p-2 border border-border">
          {inner}
        </button>
      );
    }
    return (
      <Draggable key={a.id} draggableId={a.id} index={0}>
        {(prov, snap) => (
          <div
            ref={prov.innerRef} {...prov.draggableProps}
            onClick={() => { setDetail(a); setDetailNotes(a.notes || ""); }}
            className={`rounded-lg bg-accent/40 hover:bg-accent p-2 border border-border cursor-grab ${snap.isDragging ? "shadow-lg ring-1 ring-primary opacity-90" : ""}`}
          >
            <div {...prov.dragHandleProps} className="flex justify-center mb-0.5">
              <GripVertical className="w-3 h-3 text-muted-foreground/40" />
            </div>
            {inner}
          </div>
        )}
      </Draggable>
    );
  };

  const renderDay = (d, i) => {
    const cap = capacityFor(d);
    const list = apptsForDay(d);
    const count = list.length;
    const isToday = d === todayISO();
    const isPast = d < todayISO();
    const ratio = cap > 0 ? count / cap : 0;
    const capColor = cap === 0 ? "text-muted-foreground" : ratio > 1 ? "text-rose-600" : ratio >= 1 ? "text-amber-600" : "text-emerald-600";
    return (
      <div key={d} className="w-40 md:w-auto shrink-0">
        <div className={`rounded-t-lg border border-border bg-card px-2 py-2 ${isToday ? "ring-1 ring-primary" : ""}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase text-muted-foreground">{DAY_NAMES[i]}</div>
              <div className="text-sm font-semibold">{new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
            </div>
            <div className={`text-xs font-medium ${capColor}`}>{cap === 0 ? "Fechado" : `${count}/${cap}`}</div>
          </div>
        </div>
        {isDesktop ? (
          <Droppable droppableId={d}>
            {(prov, snap) => (
              <div
                ref={prov.innerRef} {...prov.droppableProps}
                className={`border border-t-0 border-border rounded-b-lg bg-card min-h-[120px] p-1.5 space-y-1.5 ${snap.isDraggingOver ? "bg-primary/5" : ""}`}
              >
                {list.length === 0 ? (
                  isPast ? (
                    <div className="w-full text-xs text-muted-foreground/40 py-4 text-center">—</div>
                  ) : (
                    <button onClick={() => { setFormPrefill({ scheduled_date: d }); setFormOpen(true); }} className="w-full text-xs text-muted-foreground py-4 hover:bg-accent rounded">+ agendar</button>
                  )
                ) : list.map((a) => renderCard(a, true))}
                {prov.placeholder}
                {!isPast && <button onClick={() => { setFormPrefill({ scheduled_date: d }); setFormOpen(true); }} className="w-full text-xs text-muted-foreground py-1.5 hover:bg-accent rounded border border-dashed border-border">+ agendar</button>}
              </div>
            )}
          </Droppable>
        ) : (
          <div className="border border-t-0 border-border rounded-b-lg bg-card min-h-[120px] p-1.5 space-y-1.5">
            {list.length === 0 ? (
              isPast ? (
                <div className="w-full text-xs text-muted-foreground/40 py-4 text-center">—</div>
              ) : (
                <button onClick={() => { setFormPrefill({ scheduled_date: d }); setFormOpen(true); }} className="w-full text-xs text-muted-foreground py-4 hover:bg-accent rounded">+ agendar</button>
              )
            ) : list.map((a) => renderCard(a, false))}
            {!isPast && <button onClick={() => { setFormPrefill({ scheduled_date: d }); setFormOpen(true); }} className="w-full text-xs text-muted-foreground py-1.5 hover:bg-accent rounded border border-dashed border-border">+ agendar</button>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Agenda</h1>
          <p className="text-sm text-muted-foreground">{weekLabel}</p>
        </div>
        <Button onClick={() => { setFormPrefill({ scheduled_date: todayISO() }); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Agendamento
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant={weekStart === thisWeekStart ? "default" : "outline"} onClick={() => setRefDay(todayISO())}>Esta semana</Button>
        <Button size="sm" variant={weekStart === nextWeekStart ? "default" : "outline"} onClick={() => setRefDay(nextWeekStart)}>Próxima semana</Button>
        <div className="flex items-center gap-1 ml-auto">
          <Button size="icon" variant="outline" onClick={() => setRefDay(addDaysISO(-7, new Date(weekStart + "T00:00:00")))}><ChevronLeft className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setRefDay(todayISO())}>Hoje</Button>
          <Button size="icon" variant="outline" onClick={() => setRefDay(addDaysISO(7, new Date(weekStart + "T00:00:00")))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      {isDesktop && (
        <div className="text-xs text-muted-foreground hidden md:block">Arraste os cards entre os dias para reagendar.</div>
      )}

      <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
        {isDesktop ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-2 min-w-max md:grid md:grid-cols-6 md:min-w-0">
              {days.map((d, i) => renderDay(d, i))}
            </div>
          </DragDropContext>
        ) : (
          <div className="flex gap-2 min-w-max md:grid md:grid-cols-6 md:min-w-0">
            {days.map((d, i) => renderDay(d, i))}
          </div>
        )}
      </div>

      <AppointmentFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} prefill={formPrefill} customers={customers} vehicles={vehicles} />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          {detail && (
            <>
              <DialogHeader><DialogTitle>Agendamento</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{formatDate(detail.scheduled_date)} {detail.scheduled_time || ""}</div>
                  <AppointmentStatusBadge status={detail.status} />
                </div>
                <div className="rounded-lg bg-accent/40 p-3 space-y-1">
                  <div className="font-medium">{detail.customer_name_snapshot}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Car className="w-3.5 h-3.5" /> {detail.vehicle_description_snapshot} · {normalizePlate(detail.plate_snapshot)}
                  </div>
                  <div className="text-sm text-muted-foreground">Tipo: {appointmentTypeInfo[detail.type]}</div>
                  {detail.reason && <div className="text-sm">Motivo: {detail.reason}</div>}
                  {detail.actual_arrival && <div className="text-xs text-muted-foreground">Chegada real: {formatDateTime(detail.actual_arrival)}</div>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Observação</Label>
                  <Textarea rows={2} value={detailNotes} onChange={(e) => setDetailNotes(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {detail.status !== "confirmado" && <Button variant="outline" onClick={() => updateStatus(detail, "confirmado")}>Confirmar</Button>}
                  {detail.status !== "veiculo_recebido" && detail.status !== "em_atendimento" && detail.status !== "concluido" && (
                    <Button onClick={() => updateStatus(detail, "veiculo_recebido", { actual_arrival: new Date().toISOString() })}>Veículo Chegou</Button>
                  )}
                  {detail.status === "veiculo_recebido" && <Button onClick={() => updateStatus(detail, "em_atendimento")}>Iniciar Atendimento</Button>}
                  {detail.status !== "concluido" && detail.status !== "cancelado" && <Button variant="outline" onClick={() => updateStatus(detail, "concluido")}>Concluir</Button>}
                  {detail.status !== "nao_compareceu" && detail.status !== "concluido" && <Button variant="outline" onClick={() => updateStatus(detail, "nao_compareceu")}>Não Compareceu</Button>}
                  {detail.status !== "cancelado" && detail.status !== "concluido" && <Button variant="destructive" onClick={() => updateStatus(detail, "cancelado")}>Cancelar</Button>}
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
                <Button onClick={saveDetailNotes}>Salvar Observação</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
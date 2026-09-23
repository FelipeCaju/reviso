import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDaysISO, formatDate } from "@/lib/format";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";

// Mostra os próximos 14 dias com a capacidade (x/cap) e permite escolher um dia.
// Capacidade é um guia — não bloqueia; avisa se lotado/acima.
export default function SchedulePicker({ open, onClose, onConfirm, settings }) {
  const [days, setDays] = useState([]);
  const [selected, setSelected] = useState(null);
  const [counts, setCounts] = useState({});
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    const list = Array.from({ length: 14 }, (_, i) => addDaysISO(i));
    setDays(list);
    setSelected(null);
    setTime("");
    setLoading(true);
    (async () => {
      const countsMap = {};
      await Promise.all(list.map(async (d) => {
        try {
          const appts = await base44.entities.Appointment.filter({ scheduled_date: d }, "-updated_date", 100);
          countsMap[d] = appts.filter((a) => !["cancelado", "nao_compareceu"].includes(a.status)).length;
        } catch (e) {
          countsMap[d] = 0;
        }
      }));
      setCounts(countsMap);
      setLoading(false);
    })();
  }, [open]);

  const confirm = () => {
    if (!selected) return;
    onConfirm(selected, time);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Serviço</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Escolha o dia previsto para a entrada do veículo.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
          {days.map((d) => {
            const cap = capacityFor(d);
            const count = counts[d] ?? 0;
            const closed = cap === 0;
            const full = count >= cap && !closed;
            const over = count > cap;
            const isSelected = selected === d;
            return (
              <button
                key={d}
                disabled={closed}
                onClick={() => setSelected(d)}
                className={`rounded-lg border p-2.5 text-left transition disabled:opacity-40 ${
                  isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-accent"
                }`}
              >
                <div className="text-xs text-muted-foreground capitalize">
                  {new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short" })}
                </div>
                <div className="text-sm font-medium">{formatDate(d)}</div>
                <div className={`text-xs mt-1 ${closed ? "text-muted-foreground" : full ? "text-amber-600" : over ? "text-rose-600" : "text-muted-foreground"}`}>
                  {closed ? "Fechado" : `${count}/${cap}${over ? " (acima)" : full ? " (lotado)" : ""}`}
                </div>
              </button>
            );
          })}
        </div>

        {selected && (() => {
          const cap = capacityFor(selected);
          const count = counts[selected] ?? 0;
          if (count >= cap && cap > 0) {
            return (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                A capacidade deste dia é de {cap} veículos e já existem {count} agendamentos. Você pode agendar mesmo assim.
              </div>
            );
          }
          return null;
        })()}

        {selected && (
          <div className="space-y-1.5">
            <Label>Horário (opcional)</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={confirm} disabled={!selected || loading}>
            {loading ? "Carregando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
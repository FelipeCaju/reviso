import { useState } from "react";
import { Bell, Check, MessageCircle, Phone, Mail, User } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "telefone", label: "Telefone", icon: Phone },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "presencial", label: "Presencial", icon: User },
  { value: "outro", label: "Outro", icon: Bell },
];

export default function OSNotification({ wo, onUpdate }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("whatsapp");
  const [saving, setSaving] = useState(false);

  const markNotified = async () => {
    setSaving(true);
    try {
      const patch = {
        customer_notified: true,
        notified_at: new Date().toISOString(),
        notified_channel: channel,
        notified_by: user?.full_name || user?.email || "",
      };
      await base44.entities.WorkOrder.update(wo.id, patch);
      onUpdate?.(patch);
      setOpen(false);
      toast({ title: "Cliente notificado" });
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const channelLabel = CHANNELS.find((c) => c.value === wo.notified_channel)?.label || wo.notified_channel;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="font-medium text-sm flex items-center gap-2">
        <Bell className="w-4 h-4" /> Cliente Notificado
      </h2>

      {wo.customer_notified ? (
        <div className="flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-emerald-800">Cliente foi notificado</div>
            <div className="text-xs text-emerald-700">
              {wo.notified_at ? formatDateTime(wo.notified_at) : ""} · {channelLabel}
              {wo.notified_by ? ` · ${wo.notified_by}` : ""}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Cliente ainda não foi notificado sobre o serviço/pronto.</div>
          <Button variant="outline" className="w-full h-11" onClick={() => setOpen(true)}>
            <Bell className="w-4 h-4 mr-2" /> Marcar como Notificado
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Notificação ao Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Confirme como o cliente foi informado sobre o serviço/pronto e valor a pagar.</div>
            <div className="space-y-1.5">
              <Label>Canal da Notificação</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={markNotified} disabled={saving}>
              {saving ? "Salvando..." : "Confirmar Notificação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
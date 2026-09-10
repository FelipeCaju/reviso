import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import DemoUserManager from "@/components/DemoUserManager";
import { toast } from "@/components/ui/use-toast";

const DEFAULT = {
  name: "Minha Oficina",
  razao_social: "", cnpj: "", phone: "", whatsapp: "", email: "",
  address: "", logo_url: "", default_quote_text: "Orçamento válido por {validade} dias a partir da data de emissão.",
  default_validity_days: 15, default_os_note: "",
  default_capacity: 8,
  is_demo: false,
  capacity_monday: 8, capacity_tuesday: 8, capacity_wednesday: 8,
  capacity_thursday: 8, capacity_friday: 6, capacity_saturday: 3, capacity_sunday: 0,
};

const DAYS = [
  ["capacity_monday", "Segunda"],
  ["capacity_tuesday", "Terça"],
  ["capacity_wednesday", "Quarta"],
  ["capacity_thursday", "Quinta"],
  ["capacity_friday", "Sexta"],
  ["capacity_saturday", "Sábado"],
  ["capacity_sunday", "Domingo"],
];

export default function Settings() {
  const [form, setForm] = useState(DEFAULT);
  const [id, setId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.WorkshopSetting.list("-updated_date", 10);
      if (list.length) {
        setId(list[0].id);
        setForm({ ...DEFAULT, ...list[0] });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (id) await base44.entities.WorkshopSetting.update(id, form);
      else {
        const created = await base44.entities.WorkshopSetting.create(form);
        setId(created.id);
      }
      toast({ title: "Configurações salvas" });
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da oficina e capacidade da agenda</p>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
        <h2 className="font-medium">Dados da Oficina</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Razão Social</Label>
            <Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>URL do Logo</Label>
            <Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://..." />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
        <h2 className="font-medium">Padrões de Documentos</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Validade Padrão (dias)</Label>
            <Input type="number" value={form.default_validity_days} onChange={(e) => set("default_validity_days", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Capacidade Padrão / Dia</Label>
            <Input type="number" value={form.default_capacity} onChange={(e) => set("default_capacity", Number(e.target.value))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Texto Padrão do Orçamento</Label>
          <Textarea rows={2} value={form.default_quote_text} onChange={(e) => set("default_quote_text", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Observação Padrão da OS</Label>
          <Textarea rows={2} value={form.default_os_note} onChange={(e) => set("default_os_note", e.target.value)} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
        <h2 className="font-medium">Capacidade por Dia da Semana</h2>
        <p className="text-xs text-muted-foreground">Use 0 para dias fechados. A capacidade é um guia — não bloqueia agendamentos.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {DAYS.map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <Input type="number" value={form[key]} onChange={(e) => set(key, Number(e.target.value))} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 md:p-5">
        <h2 className="font-medium">Modo Demonstração</h2>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-slate-700">Oficina de demonstração</p>
            <p className="text-xs text-muted-foreground">Usuários desta oficina veem todos os dados mas não podem salvar (acesso demo de 24h).</p>
          </div>
          <Switch checked={form.is_demo} onCheckedChange={(v) => set("is_demo", v)} />
        </div>
        {form.is_demo && <DemoUserManager />}
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
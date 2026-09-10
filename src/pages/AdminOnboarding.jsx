import { useState } from "react";
import { Building2, Plus, Users, ArrowRight, Mail } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

export default function AdminOnboarding() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", razao_social: "", cnpj: "", phone: "", whatsapp: "", email: "", address: "",
    ownerEmail: "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.ownerEmail.trim()) {
      toast({ title: "Preencha o nome da oficina e o e-mail do proprietário", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // 1. Criar a oficina (WorkshopSetting)
      const workshop = await base44.entities.WorkshopSetting.create({
        name: form.name,
        razao_social: form.razao_social,
        cnpj: form.cnpj,
        phone: form.phone,
        whatsapp: form.whatsapp,
        email: form.email,
        address: form.address,
        default_capacity: 8,
        capacity_monday: 8, capacity_tuesday: 8, capacity_wednesday: 8,
        capacity_thursday: 8, capacity_friday: 6, capacity_saturday: 3, capacity_sunday: 0,
      });

      // 2. Convidar o proprietário (cria usuário e envia convite por e-mail)
      try {
        await base44.users.inviteUser(form.ownerEmail, "admin");
      } catch {
        // Usuário já pode existir — tudo bem, só vinculamos
      }

      // 3. Encontrar o usuário e vincular à oficina
      const users = await base44.entities.User.list("-created_date", 500);
      const owner = users.find((u) => u.email === form.ownerEmail);
      if (owner) {
        await base44.entities.User.update(owner.id, { workshop_id: workshop.id });
      }

      toast({
        title: "Oficina criada com sucesso!",
        description: `Convite enviado para ${form.ownerEmail}. Ao fazer login, o proprietário já estará vinculado.`,
      });
      setForm({ name: "", razao_social: "", cnpj: "", phone: "", whatsapp: "", email: "", address: "", ownerEmail: "" });
    } catch (e) {
      toast({ title: "Erro ao criar oficina", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" /> Gestão de Oficinas
        </h1>
        <p className="text-sm text-muted-foreground">Cadastre novas oficinas e vincule ao proprietário</p>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
        <h2 className="font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova Oficina
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nome da Oficina *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Auto Mecânica do João" />
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
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail da Oficina</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Proprietário
          </h3>
          <div className="space-y-1.5">
            <Label>E-mail do Proprietário *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="email" className="pl-9" value={form.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} placeholder="proprietario@email.com" />
            </div>
            <p className="text-xs text-muted-foreground">
              O proprietário receberá um convite por e-mail. Ao fazer login pela primeira vez, já estará vinculado a esta oficina com acesso total.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={saving} size="lg">
            {saving ? "Criando..." : "Criar Oficina e Convidar"}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </section>
    </div>
  );
}
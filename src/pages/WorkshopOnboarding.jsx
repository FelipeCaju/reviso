import { useState, useEffect } from "react";
import { Building2, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { getValidationMessage } from "@/lib/workshopValidation";

export default function WorkshopOnboarding() {
  const { user } = useAuth();
  const isCompletion = !!user?.workshop_id;
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isCompletion);
  const [form, setForm] = useState({
    name: "", razao_social: "", cnpj: "", phone: "", whatsapp: "", email: "", address: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!isCompletion) return;
    (async () => {
      try {
        const ws = await base44.entities.WorkshopSetting.get(user.workshop_id);
        setForm({
          name: ws.name || "", razao_social: ws.razao_social || "", cnpj: ws.cnpj || "",
          phone: ws.phone || "", whatsapp: ws.whatsapp || "", email: ws.email || "",
          address: ws.address || "",
        });
      } catch (e) {
        console.error("Failed to load workshop:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submit = async () => {
    const profileMsg = getValidationMessage(form);
    if (profileMsg) {
      toast({ title: profileMsg, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isCompletion) {
        await base44.functions.invoke("manageWorkshops", {
          action: "update",
          workshopId: user.workshop_id,
          name: form.name.trim(),
          razao_social: form.razao_social,
          cnpj: form.cnpj,
          phone: form.phone,
          whatsapp: form.whatsapp,
          email: form.email,
          address: form.address,
        });
        toast({ title: "Perfil atualizado!", description: "Dados da oficina salvos com sucesso." });
      } else {
        throw new Error("Solicite o pré-cadastro da oficina ao administrador.");
      }
      window.location.reload();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-8">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-3 rounded-xl bg-primary/10">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-heading font-bold">
            {isCompletion ? "Complete o Perfil da Oficina" : "Cadastre sua Oficina"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isCompletion
              ? "Preencha os dados obrigatórios para continuar usando o sistema"
              : "Preencha os dados para começar seu período gratuito de 24 horas"}
          </p>
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-1.5">
            <Label>Nome da Oficina *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Auto Mecânica do João" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Razão Social</Label><Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Telefone *</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>E-mail *</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Endereço *</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
          </div>
          {!isCompletion && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
              Após cadastrar, você terá <strong>24 horas de acesso gratuito</strong>. Para continuar usando, entre em contato com a equipe.
            </div>
          )}
          <Button onClick={submit} disabled={saving} className="w-full" size="lg">
            {saving ? "Salvando..." : (isCompletion ? "Salvar e Continuar" : "Cadastrar e Começar")} <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
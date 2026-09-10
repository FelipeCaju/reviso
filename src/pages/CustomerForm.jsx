import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const EMPTY = {
  name: "", cpf_cnpj: "", phone: "", whatsapp: "", email: "",
  cep: "", address: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  notes: "", active: true,
};

export default function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const c = await base44.entities.Customer.get(id);
        setForm({ ...EMPTY, ...c });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (id) await base44.entities.Customer.update(id, form);
      else {
        const created = await base44.entities.Customer.create(form);
        navigate(`/clientes/${created.id}`);
        return;
      }
      navigate(`/clientes/${id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <h1 className="text-xl md:text-2xl font-heading font-semibold">{id ? "Editar Cliente" : "Novo Cliente"}</h1>

      <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Nome / Razão Social *</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1.5"><Label>CPF / CNPJ</Label>
          <Input value={form.cpf_cnpj} onChange={(e) => set("cpf_cnpj", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Telefone</Label>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>WhatsApp</Label>
          <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>E-mail</Label>
          <Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>CEP</Label>
          <Input value={form.cep} onChange={(e) => set("cep", e.target.value)} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Endereço</Label>
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Número</Label>
          <Input value={form.number} onChange={(e) => set("number", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Complemento</Label>
          <Input value={form.complement} onChange={(e) => set("complement", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Bairro</Label>
          <Input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Cidade</Label>
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Estado</Label>
          <Input value={form.state} onChange={(e) => set("state", e.target.value)} /></div>
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
        <Button onClick={save} disabled={saving || !form.name.trim()}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
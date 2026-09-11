import { useEffect, useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Image as ImgCmp } from "@/components/ui/image";
import DemoUserManager from "@/components/DemoUserManager";
import EmployeeManager from "@/components/EmployeeManager";
import { toast } from "@/components/ui/use-toast";

const DEFAULT = {
  name: "Minha Oficina",
  razao_social: "", cnpj: "", phone: "", whatsapp: "", email: "",
  address: "", logo_url: "", default_quote_text: "Orçamento válido por {validade} dias a partir da data de emissão.",
  default_validity_days: 15, default_os_note: "",
  default_capacity: 8,
  is_demo: false,
  demo_email: "", demo_password: "",
  capacity_monday: 8, capacity_tuesday: 8, capacity_wednesday: 8,
  capacity_thursday: 8, capacity_friday: 6, capacity_saturday: 3, capacity_sunday: 0,
  expense_categories: ["Água", "Energia", "Internet", "Aluguel", "Funcionários", "Impostos", "Contabilidade", "Material de limpeza", "Combustível", "Ferramentas", "Manutenção", "Alimentação", "Compras", "Outros"],
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione apenas um arquivo de imagem.", variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      set("logo_url", file_url);
      toast({ title: "Logo carregada" });
    } catch (err) {
      toast({ title: "Erro ao carregar logo", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

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
            <Label>Logo da Empresa</Label>
            <div className="flex items-center gap-3">
              {form.logo_url ? (
                <div className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted shrink-0">
                  <ImgCmp src={form.logo_url} alt="Logo" fittingType="fit" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted shrink-0">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <div className="flex flex-col gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                  {uploadingLogo ? "Carregando..." : (form.logo_url ? "Trocar imagem" : "Selecionar imagem")}
                </Button>
                {form.logo_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("logo_url", "")} disabled={uploadingLogo}>
                    <X className="w-4 h-4 mr-1" /> Remover
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Formatos: PNG, JPG, etc. A imagem é formatada automaticamente para os relatórios.</p>
              </div>
            </div>
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

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
        <h2 className="font-medium">Categorias de Despesa</h2>
        <p className="text-xs text-muted-foreground">Categorias usadas no cadastro de despesas. Adicione ou remova conforme necessário.</p>
        <div className="flex flex-wrap gap-2">
          {(form.expense_categories || []).map((cat, idx) => (
            <div key={idx} className="flex items-center gap-1 rounded-lg bg-accent/50 px-2 py-1">
              <span className="text-sm">{cat}</span>
              <button onClick={() => set("expense_categories", form.expense_categories.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Nova categoria..."
            id="new-category"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const val = e.target.value.trim();
                if (val && !(form.expense_categories || []).includes(val)) {
                  set("expense_categories", [...(form.expense_categories || []), val]);
                }
                e.target.value = "";
              }
            }}
          />
          <Button type="button" variant="outline" onClick={() => {
            const input = document.getElementById("new-category");
            const val = input?.value?.trim();
            if (val && !(form.expense_categories || []).includes(val)) {
              set("expense_categories", [...(form.expense_categories || []), val]);
              input.value = "";
            }
          }}>Adicionar</Button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
        <div>
          <h2 className="font-medium">Funcionários</h2>
          <p className="text-xs text-muted-foreground">Convide pessoas para acessar a oficina. Defina o nível de acesso de cada um.</p>
        </div>
        <EmployeeManager />
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
        {form.is_demo && (
          <>
            <DemoUserManager />
            <div className="space-y-3 pt-4 border-t border-amber-200">
              <div className="space-y-1.5">
                <Label>E-mail demo (login compartilhado)</Label>
                <Input value={form.demo_email} onChange={(e) => set("demo_email", e.target.value)} placeholder="demo@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Senha demo</Label>
                <Input value={form.demo_password} onChange={(e) => set("demo_password", e.target.value)} placeholder="senha do usuário demo" />
              </div>
              <p className="text-xs text-muted-foreground">
                Crie o usuário demo acima com este e-mail e defina a mesma senha no convite. Estes dados serão usados pelo botão "Modo Demo" na tela de login.
              </p>
            </div>
          </>
        )}
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { Landmark, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { fiscalErrorMessage, getFiscalContext, saveFiscalSetting, saveMaterialFiscalProfile, saveServiceFiscalProfile } from "@/lib/fiscal";

const EMPTY = {
  regime_tributario: "", simples_nacional: false, mei: false, inscricao_municipal: "", inscricao_estadual: "",
  municipio_codigo_ibge: "", municipio_nome: "", uf: "", ambiente_fiscal: "homologacao", provedor_fiscal: "nao_configurado",
  modo_emissao: "manual", codigo_servico_municipal_padrao: "", item_lista_servico_padrao: "", nbs_padrao: "",
  aliquota_iss_padrao: "", iss_retido_padrao: false, natureza_operacao_padrao: "", exigibilidade_padrao: "",
  contador_nome: "", contador_escritorio: "", contador_telefone: "", contador_email: "",
};

const STATUS = {
  DISABLED: { label: "Desativado", color: "bg-slate-100 text-slate-700" },
  INCOMPLETE: { label: "Configuração incompleta", color: "bg-amber-100 text-amber-800" },
  READY: { label: "Pronto para emissão", color: "bg-emerald-100 text-emerald-800" },
  ERROR: { label: "Erro", color: "bg-red-100 text-red-800" },
};

export default function FiscalSettings() {
  const [context, setContext] = useState(null);
  const [services, setServices] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [tab, setTab] = useState("empresa");
  const [saving, setSaving] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const load = async () => {
    try {
      const [ctx, serviceRows, materialRows] = await Promise.all([
        getFiscalContext(), base44.entities.Service.list("description", 1000), base44.entities.Material.list("description", 1000),
      ]);
      setContext(ctx); setServices(serviceRows); setMaterials(materialRows); setForm({ ...EMPTY, ...(ctx.setting || {}) });
    } catch (error) { toast({ title: "Erro ao carregar fiscal", description: fiscalErrorMessage(error), variant: "destructive" }); }
  };

  useEffect(() => { load(); }, []);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const serviceProfileMap = useMemo(() => new Map((context?.serviceProfiles || []).map((profile) => [profile.service_id, profile])), [context]);
  const materialProfileMap = useMemo(() => new Map((context?.materialProfiles || []).map((profile) => [profile.material_id, profile])), [context]);

  const saveSettings = async () => {
    setSaving(true);
    try { await saveFiscalSetting(form); await load(); toast({ title: "Configurações fiscais salvas" }); }
    catch (error) { toast({ title: "Erro ao salvar", description: fiscalErrorMessage(error), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const saveService = async () => {
    setSaving(true);
    try { await saveServiceFiscalProfile(editingService); setEditingService(null); await load(); toast({ title: "Perfil fiscal do serviço salvo" }); }
    catch (error) { toast({ title: "Erro ao salvar", description: fiscalErrorMessage(error), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const saveMaterial = async () => {
    setSaving(true);
    try { await saveMaterialFiscalProfile(editingMaterial); setEditingMaterial(null); await load(); toast({ title: "Perfil fiscal do material salvo" }); }
    catch (error) { toast({ title: "Erro ao salvar", description: fiscalErrorMessage(error), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (!context) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!context.workshop.fiscal_module_enabled) return <div className="rounded-xl border border-border bg-card p-6"><h1 className="text-xl font-semibold">Módulo Fiscal</h1><p className="mt-2 text-sm text-muted-foreground">O módulo fiscal não está habilitado no plano desta oficina. A operação não fiscal continua funcionando normalmente.</p></div>;
  const status = STATUS[context.configurationStatus] || STATUS.ERROR;
  const tabs = [["empresa", "Empresa"], ["tributacao", "Tributação"], ["servicos", "Serviços"], ["produtos", "Produtos/Peças"], ["emissao", "Emissão"], ["contador", "Contador"]];

  return <div className="space-y-5 max-w-5xl">
    <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl md:text-2xl font-heading font-semibold flex items-center gap-2"><Landmark className="w-5 h-5" /> Configurações fiscais</h1><p className="text-sm text-muted-foreground">Parâmetros isolados desta oficina</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${status.color}`}>{status.label}</span></div>
    <div className="flex flex-wrap gap-2 border-b border-border pb-3">{tabs.map(([key, label]) => <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>{label}</Button>)}</div>

    {tab === "empresa" && <section className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border bg-card p-4">
      <div className="sm:col-span-2 text-sm text-muted-foreground">Os dados de razão social, CNPJ e endereço são mantidos em Configurações &gt; Dados da Oficina.</div>
      <Field label="Inscrição Municipal" value={form.inscricao_municipal} onChange={(v) => set("inscricao_municipal", v)} />
      <Field label="Inscrição Estadual" value={form.inscricao_estadual} onChange={(v) => set("inscricao_estadual", v)} />
      <Field label="Município" value={form.municipio_nome} onChange={(v) => set("municipio_nome", v)} />
      <Field label="Código IBGE" value={form.municipio_codigo_ibge} onChange={(v) => set("municipio_codigo_ibge", v)} />
      <Field label="UF" value={form.uf} onChange={(v) => set("uf", v.toUpperCase())} />
    </section>}

    {tab === "tributacao" && <section className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1.5"><Label>Regime Tributário</Label><Select value={form.regime_tributario || ""} onValueChange={(v) => set("regime_tributario", v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{["MEI", "SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "OUTRO"].map((v) => <SelectItem key={v} value={v}>{v.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
      <Toggle label="Optante pelo Simples Nacional" checked={form.simples_nacional} onChange={(v) => set("simples_nacional", v)} />
      <Toggle label="MEI" checked={form.mei} onChange={(v) => set("mei", v)} />
      <Field label="Código municipal padrão" value={form.codigo_servico_municipal_padrao} onChange={(v) => set("codigo_servico_municipal_padrao", v)} />
      <Field label="Item da lista padrão" value={form.item_lista_servico_padrao} onChange={(v) => set("item_lista_servico_padrao", v)} />
      <Field label="NBS padrão" value={form.nbs_padrao} onChange={(v) => set("nbs_padrao", v)} />
      <Field label="Alíquota ISS padrão (%)" type="number" value={form.aliquota_iss_padrao} onChange={(v) => set("aliquota_iss_padrao", v === "" ? null : Number(v))} />
      <Toggle label="ISS retido por padrão" checked={form.iss_retido_padrao} onChange={(v) => set("iss_retido_padrao", v)} />
      <Field label="Natureza da operação padrão" value={form.natureza_operacao_padrao} onChange={(v) => set("natureza_operacao_padrao", v)} />
      <Field label="Exigibilidade padrão" value={form.exigibilidade_padrao} onChange={(v) => set("exigibilidade_padrao", v)} />
    </section>}

    {tab === "servicos" && <section className="space-y-2">{services.map((service) => { const profile = serviceProfileMap.get(service.id); return <div key={service.id} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3"><div><div className="font-medium text-sm">{service.description}</div><div className="text-xs text-muted-foreground">{profile?.codigo_servico_municipal || form.codigo_servico_municipal_padrao ? "Configuração disponível" : "Sem código fiscal"}</div></div><Button size="sm" variant="outline" onClick={() => setEditingService({ service_id: service.id, codigo_servico_municipal: "", item_lista_servico: "", nbs: "", aliquota_iss: null, iss_retido: false, observacao_fiscal: "", active: true, ...(profile || {}) })}>Configurar</Button></div>; })}</section>}

    {tab === "produtos" && <section className="space-y-2">{materials.map((material) => { const profile = materialProfileMap.get(material.id); return <div key={material.id} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3"><div><div className="font-medium text-sm">{material.description}</div><div className="text-xs text-muted-foreground">{profile?.ncm ? `NCM ${profile.ncm}` : "Sem perfil fiscal (opcional para NFS-e)"}</div></div><Button size="sm" variant="outline" onClick={() => setEditingMaterial({ material_id: material.id, ncm: "", cest: "", origem_mercadoria: "", observacao_fiscal: "", active: true, ...(profile || {}) })}>Configurar</Button></div>; })}</section>}

    {tab === "emissao" && <section className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1.5"><Label>Modo de emissão</Label><Select value={form.modo_emissao} onValueChange={(v) => set("modo_emissao", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="automatica_finalizacao" disabled>Automática ao finalizar (futuro)</SelectItem></SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Ambiente</Label><Select value={form.ambiente_fiscal} onValueChange={(v) => set("ambiente_fiscal", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="homologacao">Homologação</SelectItem><SelectItem value="producao">Produção</SelectItem></SelectContent></Select></div>
      <div className="space-y-1.5 sm:col-span-2"><Label>Provedor fiscal</Label><Select value={form.provedor_fiscal} onValueChange={(v) => set("provedor_fiscal", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nao_configurado">Não configurado</SelectItem></SelectContent></Select><p className="text-xs text-amber-700">O adaptador real será disponibilizado após escolha e homologação do provedor. Nenhum segredo é armazenado nesta tela.</p></div>
    </section>}

    {tab === "contador" && <section className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border bg-card p-4"><Field label="Nome" value={form.contador_nome} onChange={(v) => set("contador_nome", v)} /><Field label="Escritório" value={form.contador_escritorio} onChange={(v) => set("contador_escritorio", v)} /><Field label="Telefone" value={form.contador_telefone} onChange={(v) => set("contador_telefone", v)} /><Field label="E-mail" value={form.contador_email} onChange={(v) => set("contador_email", v)} /></section>}

    {["empresa", "tributacao", "emissao", "contador"].includes(tab) && <div className="flex justify-end"><Button onClick={saveSettings} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? "Salvando..." : "Salvar"}</Button></div>}

    {editingService && <Editor title="Perfil fiscal do serviço" onClose={() => setEditingService(null)} onSave={saveService} saving={saving}><Field label="Código municipal" value={editingService.codigo_servico_municipal} onChange={(v) => setEditingService({ ...editingService, codigo_servico_municipal: v })} /><Field label="Item da lista" value={editingService.item_lista_servico} onChange={(v) => setEditingService({ ...editingService, item_lista_servico: v })} /><Field label="NBS" value={editingService.nbs} onChange={(v) => setEditingService({ ...editingService, nbs: v })} /><Field label="Alíquota ISS (%)" type="number" value={editingService.aliquota_iss ?? ""} onChange={(v) => setEditingService({ ...editingService, aliquota_iss: v === "" ? null : Number(v) })} /><Toggle label="ISS retido" checked={!!editingService.iss_retido} onChange={(v) => setEditingService({ ...editingService, iss_retido: v })} /><div className="space-y-1.5 sm:col-span-2"><Label>Observação fiscal</Label><Textarea value={editingService.observacao_fiscal || ""} onChange={(e) => setEditingService({ ...editingService, observacao_fiscal: e.target.value })} /></div></Editor>}
    {editingMaterial && <Editor title="Perfil fiscal do material" onClose={() => setEditingMaterial(null)} onSave={saveMaterial} saving={saving}><Field label="NCM" value={editingMaterial.ncm} onChange={(v) => setEditingMaterial({ ...editingMaterial, ncm: v })} /><Field label="CEST" value={editingMaterial.cest} onChange={(v) => setEditingMaterial({ ...editingMaterial, cest: v })} /><Field label="Origem da mercadoria" value={editingMaterial.origem_mercadoria} onChange={(v) => setEditingMaterial({ ...editingMaterial, origem_mercadoria: v })} /><div className="space-y-1.5 sm:col-span-2"><Label>Observação fiscal</Label><Textarea value={editingMaterial.observacao_fiscal || ""} onChange={(e) => setEditingMaterial({ ...editingMaterial, observacao_fiscal: e.target.value })} /></div></Editor>}
  </div>;
}

function Field({ label, value, onChange, type = "text" }) { return <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></div>; }
function Toggle({ label, checked, onChange }) { return <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"><span>{label}</span><Switch checked={!!checked} onCheckedChange={onChange} /></label>; }
function Editor({ title, children, onClose, onSave, saving }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-2xl rounded-xl bg-background p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><button onClick={onClose}>×</button></div><div className="grid gap-3 sm:grid-cols-2">{children}</div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></div></div></div>; }

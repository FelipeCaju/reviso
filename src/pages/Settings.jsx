import { getWorkshopId } from "@/lib/workshop";
import { useEffect, useState, useRef } from "react";
import { Upload, X, Smartphone, RefreshCw, QrCode } from "lucide-react";
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
import { useAuth } from "@/lib/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DEFAULT = {
  name: "Minha Oficina",
  razao_social: "", cnpj: "", phone: "", whatsapp: "", email: "",
  address: "", logo_url: "", default_quote_text: "Orçamento válido por {validade} dias a partir da data de emissão.",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  codigo_ibge: "", pais: "Brasil", codigo_pais: "1058",
  default_validity_days: 15, default_os_note: "",
  default_capacity: 8,
  is_demo: false,
  demo_email: "", demo_password: "",
  schedule_monday: true, schedule_tuesday: true, schedule_wednesday: true,
  schedule_thursday: true, schedule_friday: true, schedule_saturday: false, schedule_sunday: false,
  expense_categories: ["Água", "Energia", "Internet", "Aluguel", "Funcionários", "Impostos", "Contabilidade", "Material de limpeza", "Combustível", "Ferramentas", "Manutenção", "Alimentação", "Compras", "Outros"],
};

const SCHEDULE_DAYS = [
  ["schedule_monday", "Segunda"], ["schedule_tuesday", "Terça"], ["schedule_wednesday", "Quarta"],
  ["schedule_thursday", "Quinta"], ["schedule_friday", "Sexta"], ["schedule_saturday", "Sábado"], ["schedule_sunday", "Domingo"],
];

const isWhatsAppConnected = (status) => {
  const value = String(status || "").toLowerCase();
  return /connected|online|\bopen\b|active/.test(value) && !/disconnected|offline|close/.test(value);
};

const whatsAppStatusBadge = (status) => {
  const value = String(status || "").toLowerCase();
  if (isWhatsAppConnected(status)) {
    return { label: "Conectado", className: "bg-emerald-100 text-emerald-800 ring-emerald-200" };
  }
  if (/desconect|offline|indispon|erro|error/.test(value)) {
    return { label: status || "Desconectado", className: "bg-red-100 text-red-800 ring-red-200" };
  }
  return { label: status || "Aguardando conexão", className: "bg-amber-100 text-amber-900 ring-amber-200" };
};

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm] = useState(DEFAULT);
  const [id, setId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [whatsAppStatus, setWhatsAppStatus] = useState(null);
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const workshop = await base44.entities.WorkshopSetting.get(getWorkshopId());
      setId(workshop.id);
      setForm({ ...DEFAULT, ...workshop });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const invokeWhatsApp = async (action, data = {}) => {
    const response = await base44.functions.invoke("manageMyWhatsAppInstance", { action, ...data });
    return response.data;
  };

  const loadWhatsAppStatus = async () => {
    if (user?.role !== "admin") return;
    setLoadingWhatsApp(true);
    try {
      setWhatsAppStatus(await invokeWhatsApp("status"));
    } catch (err) {
      setWhatsAppStatus(null);
      toast({ title: "Não foi possível consultar o WhatsApp", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setLoadingWhatsApp(false);
    }
  };

  useEffect(() => { loadWhatsAppStatus(); }, [user?.role]);

  useEffect(() => {
    if (!qrOpen) return undefined;
    let active = true;
    const checkConnection = async () => {
      try {
        const status = await invokeWhatsApp("status");
        if (!active) return;
        setWhatsAppStatus(status);
        if (isWhatsAppConnected(status.connectionStatus)) {
          setQrOpen(false);
          setQrCode("");
          toast({ title: "WhatsApp conectado", description: "A instância está pronta para enviar mensagens." });
        }
      } catch {
        // The dialog remains available so the user can finish scanning a valid QR Code.
      }
    };
    const interval = window.setInterval(checkConnection, 3000);
    checkConnection();
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [qrOpen]);

  const connectWhatsApp = async (create) => {
    const digits = String(form.whatsapp || "").replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) {
      toast({ title: "Informe o WhatsApp da oficina", description: "Preencha e salve um número brasileiro válido antes de conectar.", variant: "destructive" });
      return;
    }
    setLoadingWhatsApp(true);
    try {
      const data = { whatsapp: form.whatsapp.trim() };
      if (create) await invokeWhatsApp("create", data);
      const result = await invokeWhatsApp("connect", data);
      setWhatsAppStatus({ configured: true, instanceName: result.instanceName, connectionStatus: "aguardando leitura do QR Code" });
      setQrCode(result.qrCode);
      setQrOpen(true);
    } catch (err) {
      toast({ title: "Não foi possível conectar o WhatsApp", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setLoadingWhatsApp(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (!id || id !== getWorkshopId()) throw new Error("Oficina não autorizada.");
      const protectedFields = ['id', 'created_date', 'updated_date', 'created_by', 'owner_email', 'plan', 'plan_value', 'trial_started_at', 'is_demo', 'demo_email', 'demo_password', 'fiscal_module_enabled'];
      const data = Object.fromEntries(Object.entries(form).filter(([key]) => !protectedFields.includes(key)));
      await base44.entities.WorkshopSetting.update(id, data);
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

  const whatsAppIsConnected = isWhatsAppConnected(whatsAppStatus?.connectionStatus);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da oficina e capacidade da agenda</p>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
        <h2 className="font-medium">Dados da Oficina</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
            <Label>WhatsApp *</Label>
            <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
            <Label>Endereço legado</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            <p className="text-xs text-muted-foreground">Preservado para documentos antigos. Complete os campos estruturados abaixo.</p>
          </div>
          <div className="space-y-1.5"><Label>CEP</Label><Input value={form.cep} onChange={(e) => set("cep", e.target.value)} /></div>
          <div className="space-y-1.5 md:col-span-1 xl:col-span-2"><Label>Logradouro</Label><Input value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Número</Label><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Complemento</Label><Input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} /></div>
          <div className="space-y-1.5"><Label>Código IBGE</Label><Input value={form.codigo_ibge} onChange={(e) => set("codigo_ibge", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>País</Label><Input value={form.pais} onChange={(e) => set("pais", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Código do País</Label><Input value={form.codigo_pais} onChange={(e) => set("codigo_pais", e.target.value)} /></div>
          <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
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
        <h2 className="font-medium">Dias de Atendimento</h2>
        <p className="text-xs text-muted-foreground">Dias desmarcados ficam bloqueados para novos agendamentos na Agenda.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SCHEDULE_DAYS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm cursor-pointer">
              <Switch checked={form[key]} onCheckedChange={(value) => set(key, value)} />
              {label}
            </label>
          ))}
        </div>
      </section>

      {user?.role === "admin" && (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-medium"><Smartphone className="h-4 w-4" /> WhatsApp</h2>
              <p className="mt-1 text-xs text-muted-foreground">O WhatsApp cadastrado acima é obrigatório e será salvo ao criar a instância. Depois, conecte o número pelo QR Code. As chaves não são exibidas aqui.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={loadWhatsAppStatus} disabled={loadingWhatsApp}>
              <RefreshCw className="mr-1 h-4 w-4" /> Atualizar estado
            </Button>
          </div>
          {whatsAppStatus?.configured ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Instância {whatsAppStatus.instanceName}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Estado:</span>
                  {(() => {
                    const badge = whatsAppStatusBadge(whatsAppStatus.connectionStatus);
                    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge.className}`}>{badge.label}</span>;
                  })()}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {whatsAppIsConnected ? "Esta é a única instância desta oficina." : "Reconectar reutiliza esta mesma instância; nenhuma nova será criada."}
                </p>
              </div>
              {!whatsAppIsConnected && (
                <Button type="button" onClick={() => connectWhatsApp(false)} disabled={loadingWhatsApp}>
                  <QrCode className="mr-1 h-4 w-4" /> Reconectar por QR Code
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Nenhuma instância Evolution GO foi criada para esta oficina.</p>
              <Button type="button" onClick={() => connectWhatsApp(true)} disabled={loadingWhatsApp}>
                <Smartphone className="mr-1 h-4 w-4" /> Criar instância e conectar
              </Button>
            </div>
          )}
        </section>
      )}

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

      <section hidden className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 md:p-5">
        <h2 className="font-medium">Modo Demonstração</h2>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-slate-700">Oficina de demonstração</p>
            <p className="text-xs text-muted-foreground">Usuários desta oficina veem todos os dados mas não podem salvar (acesso demo de 24h).</p>
          </div>
          <Switch checked={form.is_demo} onCheckedChange={(v) => set("is_demo", v)} />
        </div>
        {false && form.is_demo && (
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

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>Abra o WhatsApp no celular, acesse Dispositivos conectados e leia este QR Code.</DialogDescription>
          </DialogHeader>
          {qrCode && <img src={qrCode} alt="QR Code para conectar o WhatsApp" className="mx-auto aspect-square w-full max-w-64 rounded-lg border bg-white p-2" />}
          <p className="text-center text-xs text-muted-foreground">A janela fecha automaticamente após a conexão. O código expira; se necessário, gere outro QR Code.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

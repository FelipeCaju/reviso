import { useState, useEffect } from "react";
import { Building2, Plus, Users, ArrowRight, Mail, Crown, Clock, CheckCircle2, Pencil, Power, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getValidationMessage } from "@/lib/workshopValidation";

const PLAN_LABELS = {
  free: { label: "Free", icon: Clock, badge: "bg-amber-100 text-amber-700 border-amber-200" },
  normal: { label: "Normal", icon: Crown, badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

function PlanBadge({ plan }) {
  const cfg = PLAN_LABELS[plan] || PLAN_LABELS.free;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

export default function AdminOnboarding() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", razao_social: "", cnpj: "", phone: "", whatsapp: "", email: "", address: "",
    ownerEmail: "", fiscal_module_enabled: false,
  });
  const [workshops, setWorkshops] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [editWs, setEditWs] = useState(null);
  const [editPlan, setEditPlan] = useState("free");
  const [editValue, setEditValue] = useState(0);
  const [editName, setEditName] = useState("");
  const [editRazao, setEditRazao] = useState("");
  const [editCnpj, setEditCnpj] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editEmailField, setEditEmailField] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editFiscalEnabled, setEditFiscalEnabled] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [workshopAction, setWorkshopAction] = useState(null);
  const [processingWorkshopAction, setProcessingWorkshopAction] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadWorkshops = async () => {
    setLoadingList(true);
    try {
      const res = await base44.functions.invoke("manageWorkshops", { action: "list" });
      setWorkshops(res.data.workshops);
    } catch (e) {
      toast({ title: "Erro ao carregar oficinas", description: e.message, variant: "destructive" });
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { loadWorkshops(); }, []);

  const submit = async () => {
    const profileMsg = getValidationMessage(form);
    if (profileMsg) {
      toast({ title: profileMsg, variant: "destructive" });
      return;
    }
    if (!form.ownerEmail.trim()) {
      toast({ title: "Informe o e-mail do proprietário", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke("manageWorkshops", {
        action: "create", ...form, ownerEmail: form.ownerEmail.trim().toLowerCase(),
      });
      toast({ title: "Oficina pré-cadastrada!", description: `${form.ownerEmail} já pode entrar com Google.` });
      setForm({ name: "", razao_social: "", cnpj: "", phone: "", whatsapp: "", email: "", address: "", ownerEmail: "", fiscal_module_enabled: false });
      loadWorkshops();
    } catch (e) {
      toast({ title: "Erro ao criar oficina", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (ws) => {
    setEditWs(ws);
    setEditPlan(ws.plan || "free");
    setEditValue(ws.plan_value || 0);
    setEditName(ws.isOrphan ? "" : (ws.name || ""));
    setEditRazao(ws.razao_social || "");
    setEditCnpj(ws.cnpj || "");
    setEditPhone(ws.phone || "");
    setEditWhatsapp(ws.whatsapp || "");
    setEditEmailField(ws.email || "");
    setEditAddress(ws.address || "");
    setEditFiscalEnabled(!!ws.fiscal_module_enabled);
  };

  const savePlan = async () => {
    setSavingPlan(true);
    try {
      const editData = { name: editName, phone: editPhone, email: editEmailField, address: editAddress };
      const profileMsg = getValidationMessage(editData);
      if (profileMsg) {
        toast({ title: profileMsg, variant: "destructive" });
        setSavingPlan(false);
        return;
      }
      if (editWs.isOrphan) {
        await base44.functions.invoke("manageWorkshops", {
          action: "provision",
          userId: editWs.userId,
          name: editName.trim(),
          razao_social: editRazao,
          cnpj: editCnpj,
          phone: editPhone,
          whatsapp: editWhatsapp,
          email: editEmailField,
          address: editAddress,
          plan: editPlan,
          plan_value: Number(editValue) || 0,
          fiscal_module_enabled: editFiscalEnabled,
        });
        toast({ title: "Oficina criada!", description: `${editName.trim()} agora está no plano ${PLAN_LABELS[editPlan].label}.` });
      } else {
        await base44.functions.invoke("manageWorkshops", {
          action: "update",
          workshopId: editWs.id,
          name: editName,
          razao_social: editRazao,
          cnpj: editCnpj,
          phone: editPhone,
          whatsapp: editWhatsapp,
          email: editEmailField,
          address: editAddress,
          plan: editPlan,
          plan_value: Number(editValue) || 0,
          fiscal_module_enabled: editFiscalEnabled,
        });
        toast({ title: "Dados atualizados!", description: `${editName || editWs.name} agora está no plano ${PLAN_LABELS[editPlan].label}.` });
      }
      setEditWs(null);
      loadWorkshops();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSavingPlan(false);
    }
  };

  const confirmWorkshopAction = async () => {
    if (!workshopAction?.workshop) return;
    const { workshop, type } = workshopAction;
    setProcessingWorkshopAction(true);
    try {
      if (type === "delete") {
        await base44.functions.invoke("manageWorkshops", { action: "deleteWorkshop", workshopId: workshop.id });
        toast({ title: "Oficina excluída", description: `${workshop.name} e seus dados foram removidos.` });
      } else {
        const isActive = type === "activate";
        await base44.functions.invoke("manageWorkshops", { action: "setActive", workshopId: workshop.id, is_active: isActive });
        toast({ title: isActive ? "Oficina ativada" : "Oficina inativada", description: workshop.name });
      }
      setWorkshopAction(null);
      await loadWorkshops();
    } catch (error) {
      toast({ title: "Não foi possível concluir a ação", description: error.response?.data?.error || error.message, variant: "destructive" });
    } finally {
      setProcessingWorkshopAction(false);
    }
  };

  const WorkshopActions = ({ workshop }) => {
    if (workshop.isOrphan) return null;
    const active = workshop.is_active !== false;
    return (
      <div className="flex flex-wrap items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
        <Button variant="ghost" size="sm" onClick={() => openEdit(workshop)}><Pencil className="w-3.5 h-3.5" /> Editar</Button>
        <Button variant="ghost" size="sm" className={active ? "text-amber-700 hover:text-amber-800" : "text-emerald-700 hover:text-emerald-800"} onClick={() => setWorkshopAction({ workshop, type: active ? "deactivate" : "activate" })}>
          <Power className="w-3.5 h-3.5" /> {active ? "Inativar" : "Ativar"}
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setWorkshopAction({ workshop, type: "delete" })}>
          <Trash2 className="w-3.5 h-3.5" /> Excluir
        </Button>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" /> Gestão de Oficinas
        </h1>
        <p className="text-sm text-muted-foreground">Cadastre novas oficinas, acompanhe planos e ative assinaturas</p>
      </div>

      {/* Formulário de nova oficina */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
        <h2 className="font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova Oficina
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nome da Oficina *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Auto Mecânica do João" />
          </div>
          <div className="space-y-1.5"><Label>Razão Social</Label><Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Telefone *</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>E-mail da Oficina *</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Endereço *</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
        </div>
        <div className="pt-2 border-t border-border">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Proprietário</h3>
          <div className="space-y-1.5">
            <Label>E-mail do Proprietário *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="email" className="pl-9" value={form.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} placeholder="proprietario@email.com" />
            </div>
            <p className="text-xs text-muted-foreground">O proprietário receberá um convite por e-mail. A oficina inicia no plano Free (24h).</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <div>
            <Label htmlFor="new-workshop-fiscal">Oficina fiscal</Label>
            <p className="text-xs text-muted-foreground">Ativa o cadastro tributário e a emissão de documentos fiscais para esta oficina.</p>
          </div>
          <Switch
            id="new-workshop-fiscal"
            checked={form.fiscal_module_enabled}
            onCheckedChange={(checked) => set("fiscal_module_enabled", checked)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={saving} size="lg">
            {saving ? "Criando..." : "Pré-cadastrar Oficina"} <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </section>

      {/* Tabela de oficinas cadastradas */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4 md:p-5">
        <h2 className="font-medium flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Oficinas Cadastradas
          <span className="text-xs text-muted-foreground font-normal">({workshops.length})</span>
        </h2>

        {loadingList ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : workshops.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma oficina cadastrada ainda.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Oficina</th>
                    <th className="py-2 px-3 font-medium">Proprietário</th>
                    <th className="py-2 px-3 font-medium">Contato</th>
                    <th className="py-2 px-3 font-medium">Plano</th>
                    <th className="py-2 px-3 font-medium">Fiscal</th>
                    <th className="py-2 px-3 font-medium">Valor</th>
                    <th className="py-2 pl-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {workshops.map((ws) => (
                    <tr key={ws.id} className={`border-b border-border/60 hover:bg-muted/30 cursor-pointer ${ws.is_active === false ? "opacity-60" : ""}`} onClick={() => openEdit(ws)}>
                      <td className="py-3 pr-3">
                        {ws.isOrphan ? (
                          <>
                            <div className="font-medium text-muted-foreground italic">Sem oficina cadastrada</div>
                            <div className="text-xs text-amber-600">Novo cadastro — clique para ativar</div>
                          </>
                        ) : (
                          <>
                            <div className="font-medium flex items-center gap-2">{ws.name || "—"}{ws.is_active === false && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">Inativa</span>}</div>
                            {ws.cnpj && <div className="text-xs text-muted-foreground">CNPJ: {ws.cnpj}</div>}
                          </>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {ws.owners.length > 0 ? (
                          ws.owners.map((o) => (
                            <div key={o.id}>
                              <div className="text-sm">{o.full_name || o.email}</div>
                              {o.full_name && <div className="text-xs text-muted-foreground">{o.email}</div>}
                            </div>
                          ))
                        ) : <span className="text-xs text-muted-foreground">Sem proprietário</span>}
                      </td>
                      <td className="py-3 px-3">
                        {ws.phone && <div className="text-xs">{ws.phone}</div>}
                        {ws.email && <div className="text-xs text-muted-foreground">{ws.email}</div>}
                      </td>
                      <td className="py-3 px-3"><PlanBadge plan={ws.plan} /></td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${ws.fiscal_module_enabled ? "border-blue-200 bg-blue-100 text-blue-700" : "border-border bg-muted text-muted-foreground"}`}>
                          {ws.fiscal_module_enabled ? "Sim" : "Não"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-sm">
                        {ws.plan_value > 0 ? `R$ ${ws.plan_value.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <WorkshopActions workshop={ws} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {workshops.map((ws) => (
                <div key={ws.id} className={`rounded-lg border border-border p-3 space-y-2 ${ws.is_active === false ? "opacity-60" : ""}`} onClick={() => openEdit(ws)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {ws.isOrphan ? (
                        <>
                          <div className="font-medium truncate text-muted-foreground italic">Sem oficina</div>
                          <div className="text-xs text-amber-600">Novo cadastro</div>
                        </>
                      ) : (
                        <>
                          <div className="font-medium truncate">{ws.name || "—"} {ws.is_active === false && <span className="text-xs text-amber-700">(Inativa)</span>}</div>
                          {ws.cnpj && <div className="text-xs text-muted-foreground">CNPJ: {ws.cnpj}</div>}
                        </>
                      )}
                    </div>
                    <PlanBadge plan={ws.plan} />
                  </div>
                  {ws.owners.length > 0 && (
                    <div className="text-sm">
                      {ws.owners.map((o) => (
                        <div key={o.id}>
                          <div>{o.full_name || o.email}</div>
                          {o.full_name && <div className="text-xs text-muted-foreground">{o.email}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-border/60">
                    <div className="text-xs text-muted-foreground">
                      <div>{ws.plan_value > 0 ? `R$ ${ws.plan_value.toFixed(2)}/mês` : "Sem valor definido"}</div>
                      <div>Fiscal: {ws.fiscal_module_enabled ? "sim" : "não"}</div>
                    </div>
                    <WorkshopActions workshop={ws} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Dialog de edição de plano */}
      <Dialog open={!!editWs} onOpenChange={(open) => !open && setEditWs(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editWs?.isOrphan ? "Cadastrar Oficina — Novo Usuário" : `Gerenciar Plano — ${editWs?.name}`}
            </DialogTitle>
            <DialogDescription>
              {editWs?.isOrphan ? "Crie a oficina para este usuário e defina o plano" : "Altere o plano e o valor mensal da assinatura"}
            </DialogDescription>
          </DialogHeader>

          {editWs && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div><span className="text-muted-foreground">Proprietário: </span>{editWs.owners[0]?.full_name || editWs.owners[0]?.email || "—"}</div>
                {!editWs.isOrphan && <div><span className="text-muted-foreground">Criada em: </span>{new Date(editWs.created_date).toLocaleDateString('pt-BR')}</div>}
              </div>

              <div className="space-y-1.5">
                <Label>Nome da Oficina *</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ex: Auto Mecânica do João" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Razão Social</Label><Input value={editRazao} onChange={(e) => setEditRazao(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>CNPJ</Label><Input value={editCnpj} onChange={(e) => setEditCnpj(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Telefone *</Label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>E-mail *</Label><Input value={editEmailField} onChange={(e) => setEditEmailField(e.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Endereço *</Label><Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} /></div>
              </div>

              <div className="space-y-1.5">
                <Label>Plano</Label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600" /> Free (24h)
                      </div>
                    </SelectItem>
                    <SelectItem value="normal">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-emerald-600" /> Normal (Assinatura ativa)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {editPlan === "free"
                    ? "Acesso limitado a 24 horas. Altere para Normal após receber o pagamento."
                    : "Assinatura ativa. Acesso completo sem limite de tempo."}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Valor Mensal (R$)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div><Label htmlFor="edit-workshop-fiscal">Oficina fiscal</Label><p className="text-xs text-muted-foreground">Pode ser ativada ou desativada depois; os documentos já emitidos permanecem preservados.</p></div>
                <Switch id="edit-workshop-fiscal" checked={editFiscalEnabled} onCheckedChange={setEditFiscalEnabled} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWs(null)}>Cancelar</Button>
            <Button onClick={savePlan} disabled={savingPlan}>
              {savingPlan ? "Salvando..." : (editWs?.isOrphan ? "Criar e Ativar" : "Salvar Plano")} <CheckCircle2 className="w-4 h-4 ml-1" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!workshopAction} onOpenChange={(open) => !open && !processingWorkshopAction && setWorkshopAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{workshopAction?.type === "delete" ? "Excluir oficina definitivamente?" : workshopAction?.type === "activate" ? "Ativar oficina?" : "Inativar oficina?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {workshopAction?.type === "delete"
                ? `A oficina ${workshopAction?.workshop?.name || "selecionada"}, todos os seus dados e vínculos de usuários serão removidos permanentemente.`
                : workshopAction?.type === "activate"
                  ? `A oficina ${workshopAction?.workshop?.name || "selecionada"} voltará a permitir acesso aos seus usuários.`
                  : `A oficina ${workshopAction?.workshop?.name || "selecionada"} deixará de permitir novos acessos até ser ativada novamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingWorkshopAction}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmWorkshopAction} disabled={processingWorkshopAction} className={workshopAction?.type === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>
              {processingWorkshopAction ? "Processando..." : workshopAction?.type === "delete" ? "Excluir definitivamente" : workshopAction?.type === "activate" ? "Ativar oficina" : "Inativar oficina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

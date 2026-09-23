import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Search, Truck, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { withWorkshop } from "@/lib/workshop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

const BR_STATES = [
  { value: "AC", label: "Acre" }, { value: "AL", label: "Alagoas" }, { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" }, { value: "BA", label: "Bahia" }, { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" }, { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" }, { value: "MA", label: "Maranhão" }, { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" }, { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" }, { value: "PB", label: "Paraíba" }, { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" }, { value: "PI", label: "Piauí" }, { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" }, { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" }, { value: "RR", label: "Roraima" }, { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" }, { value: "SE", label: "Sergipe" }, { value: "TO", label: "Tocantins" },
];

const EMPTY = {
  person_type: "PJ", name: "", razao_social: "", fantasy_name: "", cpf_cnpj: "", inscricao_estadual: "", inscricao_municipal: "", phone: "", whatsapp: "", email: "",
  cep: "", address: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  city_ibge_code: "", country: "Brasil", country_code: "1058", contact_name: "", notes: "", active: true,
};

export default function Suppliers() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Supplier.list("-updated_date", 500);
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((s) => {
    const sLower = q.toLowerCase();
    return !sLower || (s.name || "").toLowerCase().includes(sLower) ||
      (s.fantasy_name || "").toLowerCase().includes(sLower) ||
      (s.cpf_cnpj || "").toLowerCase().includes(sLower) ||
      (s.contact_name || "").toLowerCase().includes(sLower);
  });

  const openNew = () => { setForm(EMPTY); setEditingId(null); setOpen(true); };
  const openEdit = (s) => { setForm({ ...s }); setEditingId(s.id); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) await base44.entities.Supplier.update(editingId, form);
      else await base44.entities.Supplier.create(withWorkshop(form));
      setOpen(false);
      await load();
      toast({ title: "Fornecedor salvo" });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const lookupCep = async () => {
    const cep = (form.cep || "").replace(/\D/g, "");
    if (cep.length !== 8) {
      toast({ title: "CEP inválido", description: "Digite 8 dígitos", variant: "destructive" });
      return;
    }
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast({ title: "CEP não encontrado", variant: "destructive" });
        return;
      }
      setForm((f) => ({
        ...f,
        address: data.logradouro || f.address,
        neighborhood: data.bairro || f.neighborhood,
        city: data.localidade || f.city,
        state: data.uf || f.state,
        complement: data.complemento || f.complement,
      }));
      toast({ title: "Endereço preenchido" });
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setCepLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">{items.length} cadastrados</p>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Novo
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar fornecedor..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum fornecedor cadastrado.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/fornecedores/${s.id}`)}
              className="text-left rounded-xl border border-border bg-card p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  {s.fantasy_name && <div className="text-xs text-muted-foreground truncate">{s.fantasy_name}</div>}
                  <div className="text-xs text-muted-foreground mt-1">
                    {[s.contact_name, s.phone, s.city].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <span onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="p-1.5 rounded hover:bg-accent shrink-0">
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </span>
              </div>
              {!s.active && <div className="mt-2 text-xs text-muted-foreground">Inativo</div>}
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Tipo de pessoa</Label><Select value={form.person_type || "PJ"} onValueChange={(v) => set("person_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PF">Pessoa física</SelectItem><SelectItem value="PJ">Pessoa jurídica</SelectItem><SelectItem value="EXTERIOR">Exterior</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5">
              <Label>Nome / Razão Social *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5"><Label>Razão Social</Label><Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Nome Fantasia</Label>
              <Input value={form.fantasy_name} onChange={(e) => set("fantasy_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CPF/CNPJ</Label>
              <Input value={form.cpf_cnpj} onChange={(e) => set("cpf_cnpj", e.target.value)} />
            </div>
            <div className="space-y-1.5"><Label>Inscrição Estadual</Label><Input value={form.inscricao_estadual} onChange={(e) => set("inscricao_estadual", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Inscrição Municipal</Label><Input value={form.inscricao_municipal} onChange={(e) => set("inscricao_municipal", e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Nome do Contato</Label>
              <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
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
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <div className="flex gap-2">
                <Input value={form.cep} onChange={(e) => set("cep", e.target.value)} placeholder="00000-000" />
                <Button type="button" variant="outline" onClick={lookupCep} disabled={cepLoading} className="shrink-0">
                  {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input value={form.number} onChange={(e) => set("number", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.state || ""} onValueChange={(v) => set("state", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {BR_STATES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Código IBGE</Label><Input value={form.city_ibge_code} onChange={(e) => set("city_ibge_code", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>País</Label><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Código do País</Label><Input value={form.country_code} onChange={(e) => set("country_code", e.target.value)} /></div>
            <div className="space-y-1.5 flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
                Ativo
              </label>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

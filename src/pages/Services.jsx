import { useEffect, useState } from "react";
import { Plus, Pencil, Search, Wrench } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";

const EMPTY = {
  code: "", description: "", category: "", default_price: 0,
  estimated_time: "", notes: "", active: true,
};

export default function Services() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await base44.entities.Service.list("-updated_date", 500));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((m) => {
    const s = q.toLowerCase();
    return !s || (m.description || "").toLowerCase().includes(s) ||
      (m.code || "").toLowerCase().includes(s) || (m.category || "").toLowerCase().includes(s);
  });

  const openNew = () => { setForm(EMPTY); setEditingId(null); setOpen(true); };
  const openEdit = (m) => { setForm({ ...m }); setEditingId(m.id); setOpen(true); };

  const save = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      if (editingId) await base44.entities.Service.update(editingId, form);
      else await base44.entities.Service.create(form);
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m) => {
    await base44.entities.Service.update(m.id, { active: !m.active });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-semibold">Serviços / Mão de Obra</h1>
          <p className="text-sm text-muted-foreground">Cadastro de serviços</p>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Novo
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar serviço..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wrench className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum serviço cadastrado.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {[m.code, m.category, m.estimated_time].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-accent shrink-0">
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm font-semibold">{formatCurrency(m.default_price)}</div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${m.active ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {m.active ? "Ativo" : "Inativo"}
                  </span>
                  <Switch checked={m.active} onCheckedChange={() => toggleActive(m)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tempo Estimado</Label>
              <Input value={form.estimated_time} onChange={(e) => setForm({ ...form, estimated_time: e.target.value })} placeholder="ex: 1h30" />
            </div>
            <div className="space-y-1.5">
              <Label>Valor Padrão</Label>
              <Input type="number" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5 flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                Ativo
              </label>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observação</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={save} disabled={saving || !form.description.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
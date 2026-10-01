import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { withWorkshop } from "@/lib/workshop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

export default function MaterialCategories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setCategories(await base44.entities.MaterialCategory.list("name", 500)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const openNew = () => { setName(""); setEditing(null); setOpen(true); };
  const openEdit = (category) => { setName(category.name); setEditing(category); setOpen(true); };
  const save = async () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    if (categories.some((category) => category.id !== editing?.id && category.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
      toast({ title: "Esta categoria já existe", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      if (editing) await base44.entities.MaterialCategory.update(editing.id, { name: cleanName });
      else await base44.entities.MaterialCategory.create(withWorkshop({ name: cleanName }));
      setOpen(false); await load();
    } catch (error) { toast({ title: "Erro ao salvar categoria", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><button onClick={() => navigate("/materiais")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Materiais</button><Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Nova Categoria</Button></div>
    <div><h1 className="text-xl md:text-2xl font-heading font-semibold">Categorias de Materiais</h1><p className="text-sm text-muted-foreground">Cadastre e edite as categorias disponíveis para peças e materiais.</p></div>
    {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div> : categories.length === 0 ? <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada.</div> : <div className="rounded-xl border border-border bg-card divide-y divide-border">{categories.map((category) => <div key={category.id} className="flex items-center justify-between px-4 py-3"><span className="text-sm font-medium">{category.name}</span><Button size="sm" variant="ghost" onClick={() => openEdit(category)}><Pencil className="w-4 h-4 mr-1" /> Editar</Button></div>)}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader><div className="space-y-1.5"><Label>Nome *</Label><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); save(); } }} /></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving || !name.trim()}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

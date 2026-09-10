import { useState } from "react";
import { Mail, UserPlus, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { getWorkshopId } from "@/lib/workshop";

export default function DemoUserManager() {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const createDemoUser = async () => {
    if (!email.trim()) {
      toast({ title: "Informe o e-mail do usuário demo", variant: "destructive" });
      return;
    }
    const workshopId = getWorkshopId();
    if (!workshopId) {
      toast({ title: "Oficina não encontrada", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      try {
        await base44.users.inviteUser(email, "user");
      } catch {
        // User may already exist — that's fine
      }
      const users = await base44.entities.User.list("-created_date", 500);
      const user = users.find((u) => u.email === email);
      if (user) {
        await base44.entities.User.update(user.id, { workshop_id: workshopId });
      }
      toast({
        title: "Usuário demo criado!",
        description: `${email} agora pode acessar em modo demonstração.`,
      });
      setEmail("");
    } catch (e) {
      toast({ title: "Erro ao criar usuário demo", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 pt-4 border-t border-amber-200">
      <div className="space-y-1.5">
        <Label>E-mail do usuário demo</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="email" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="demo@email.com" />
        </div>
        <p className="text-xs text-muted-foreground">
          O usuário recebe um convite e ao logar verá todos os dados da oficina sem poder salvar.
        </p>
      </div>
      <Button onClick={createDemoUser} disabled={saving} variant="outline">
        {saving ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
        ) : (
          <><UserPlus className="w-4 h-4 mr-2" /> Criar Usuário Demo</>
        )}
      </Button>
    </div>
  );
}
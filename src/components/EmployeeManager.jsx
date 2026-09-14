import { useState, useEffect } from "react";
import { Mail, UserPlus, Loader2, Trash2, Shield, User as UserIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

const ROLE_LABELS = {
  admin: { label: "Administrador", icon: Shield, color: "text-primary" },
  user: { label: "Funcionário", icon: UserIcon, color: "text-muted-foreground" },
};

export default function EmployeeManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [saving, setSaving] = useState(false);


  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageWorkshops", { action: "listEmployees" });
      setUsers(res.data.users);
    } catch (e) {
      toast({ title: "Erro ao carregar funcionários", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const invite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast({ title: "Informe o e-mail do funcionário", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: "E-mail inválido", description: "Digite um e-mail válido.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Check if already invited
      const existing = users.find((u) => u.email === trimmed);
      if (existing) {
        toast({ title: "Este e-mail já está cadastrado", variant: "destructive" });
        return;
      }
      await base44.functions.invoke("manageWorkshops", { action: "inviteEmployee", email: trimmed, role });
      toast({
        title: "Convite enviado!",
        description: `${trimmed} recebeu um e-mail de convite. Ao aceitar, terá acesso à oficina como ${ROLE_LABELS[role].label}.`,
      });
      setEmail("");
      load();
    } catch (e) {
      toast({ title: "Erro ao convidar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (userId, newRole) => {
    try {
      await base44.functions.invoke("manageWorkshops", { action: "changeEmployeeRole", userId, role: newRole });
      toast({ title: "Acesso atualizado", description: `Agora: ${ROLE_LABELS[newRole].label}` });
      load();
    } catch (e) {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    }
  };

  const remove = async (userId, userEmail) => {
    if (!confirm(`Remover ${userEmail} da oficina? Ele perderá acesso ao sistema.`)) return;
    try {
      await base44.functions.invoke("manageWorkshops", { action: "removeEmployee", userId });
      toast({ title: "Funcionário removido", description: `${userEmail} não tem mais acesso à oficina.` });
      load();
    } catch (e) {
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Invite form */}
      <div className="space-y-2 rounded-lg border border-border p-3 bg-accent/20">
        <Label>Convidar Funcionário</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="email" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="funcionario@email.com" />
          </div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="user">Funcionário</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={invite} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Convidar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O funcionário recebe um e-mail de convite e precisa entrar com Google usando o e-mail cadastrado. O e-mail deve ser válido.
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-4">Carregando...</div>
      ) : users.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4">Nenhum funcionário cadastrado.</div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const roleInfo = ROLE_LABELS[u.role] || ROLE_LABELS.user;
            const RoleIcon = roleInfo.icon;
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                  {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{u.full_name || u.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <Select value={u.role || "user"} onValueChange={(v) => changeRole(u.id, v)}>
                  <SelectTrigger className="w-36 sm:w-44 h-8 text-xs">
                    <div className="flex items-center gap-1.5">
                      <RoleIcon className="w-3.5 h-3.5" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="user">Funcionário</SelectItem>
                  </SelectContent>
                </Select>
                <button onClick={() => remove(u.id, u.email)} className="p-1.5 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
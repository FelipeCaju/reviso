import { LogOut, Mail } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

export default function DemoExpired() {
  const { logout } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 px-4">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-slate-100 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-amber-100">
          <Mail className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Acesso Demo Expirado</h1>
        <p className="text-slate-600 mb-6">
          Seu período de demonstração de 24 horas terminou. Para continuar usando o Revisô com acesso completo, entre em contato com a equipe.
        </p>
        <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600 mb-6 space-y-1">
          <p className="font-medium text-slate-700">Leizen Dev</p>
          <p>Luiz Felipe Saraiva</p>
          <a href="https://wa.me/55199971729402" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
            +55 19 97172-9402
          </a>
        </div>
        <div className="space-y-2">
          <a href="https://wa.me/55199971729402" target="_blank" rel="noopener noreferrer">
            <Button className="w-full">
              <Mail className="w-4 h-4 mr-2" /> Falar no WhatsApp
            </Button>
          </a>
          <Button variant="outline" onClick={() => logout()} className="w-full">
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
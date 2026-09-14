import { base44 } from '@/api/base44Client';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';

export default function UserNotRegisteredError() {
  return (
    <AuthLayout title="Acesso não autorizado" subtitle="Não foi possível confirmar seu acesso à oficina.">
      <p className="text-sm text-muted-foreground mb-6">
        Entre com o e-mail Google pré-cadastrado como proprietário ou funcionário.
        Se ainda não tem acesso, fale com o administrador para cadastrar sua oficina.
      </p>
      <Button className="w-full" onClick={() => base44.auth.logout(window.location.origin + '/login')}>
        Sair e usar outra conta Google
      </Button>
      <a className="block text-center text-primary mt-4" href="https://wa.me/55199971729402" target="_blank" rel="noopener noreferrer">
        Entrar em contato
      </a>
    </AuthLayout>
  );
}

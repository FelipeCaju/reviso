import { useEffect, useState } from "react";
import { LifeBuoy, Phone, Mail, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image as ImgCmp } from "@/components/ui/image";

export default function Support() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.WorkshopSetting.list("-updated_date", 10);
        if (list.length) setSettings(list[0]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const name = settings?.name || settings?.razao_social || "Sua Oficina";
  const logoUrl = settings?.logo_url;
  const whatsapp = settings?.whatsapp || settings?.phone || "";
  const email = settings?.email || "";

  const whatsappDigits = (whatsapp || "").replace(/\D/g, "");
  const whatsappLink = whatsappDigits ? `https://wa.me/55${whatsappDigits}` : null;
  const emailLink = email ? `mailto:${email}` : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-md w-full p-8 bg-card rounded-lg shadow-lg border border-border">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-primary/10 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={name} className="w-full h-full object-contain" />
            ) : (
              <LifeBuoy className="w-8 h-8 text-primary" />
            )}
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">{name}</h1>
          <p className="text-muted-foreground mb-8">
            Precisa de ajuda? Entre em contato com o suporte da sua oficina.
          </p>

          <div className="space-y-3">
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-md bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors text-left"
              >
                <MessageCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-emerald-700 font-medium">WhatsApp</div>
                  <div className="text-sm text-emerald-900 truncate">{whatsapp}</div>
                </div>
              </a>
            )}
            {emailLink && (
              <a
                href={emailLink}
                className="flex items-center gap-3 p-4 rounded-md bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors text-left"
              >
                <Mail className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-blue-700 font-medium">E-mail</div>
                  <div className="text-sm text-blue-900 truncate">{email}</div>
                </div>
              </a>
            )}
            {!whatsappLink && !emailLink && !loading && (
              <div className="p-4 bg-muted rounded-md text-sm text-muted-foreground text-center">
                Nenhum contato cadastrado. Configure seu WhatsApp e e-mail em Configurações.
              </div>
            )}
            {loading && (
              <div className="p-4 text-sm text-muted-foreground text-center">Carregando...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
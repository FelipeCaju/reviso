import { FileText, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function WhatsAppPreviewDialog({ open, onOpenChange, recipientName, message, attachmentName, onConfirm, sending }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prévia da mensagem</DialogTitle>
          <DialogDescription>Confira o conteúdo antes de enviar pelo WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-[#e5ddd5] p-4 space-y-3">
          <div className="max-w-[90%] rounded-lg bg-white px-3 py-2 text-sm whitespace-pre-wrap shadow-sm">
            {message}
          </div>
          <div className="max-w-[90%] rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
            <div className="flex items-center gap-2 font-medium"><FileText className="w-4 h-4 text-[#25D366]" /> PDF anexado</div>
            <div className="mt-1 text-xs text-muted-foreground break-all">{attachmentName}</div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">Destinatário: <span className="font-medium text-foreground">{recipientName || "Não informado"}</span></div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={sending} className="bg-[#25D366] text-white hover:bg-[#1ebe5d]">
            <MessageCircle className="w-4 h-4 mr-1" /> {sending ? "Enviando..." : "Confirmar envio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

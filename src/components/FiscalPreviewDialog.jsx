import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, todayISO } from "@/lib/format";
import { fiscalErrorMessage, issueFiscalDocument, previewFiscalDocument } from "@/lib/fiscal";
import { toast } from "@/components/ui/use-toast";

export default function FiscalPreviewDialog({ open, onOpenChange, workOrderId }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [competenceDate, setCompetenceDate] = useState(todayISO());

  useEffect(() => {
    if (!open || !workOrderId) return;
    setLoading(true); setPreview(null);
    previewFiscalDocument(workOrderId)
      .then(setPreview)
      .catch((error) => toast({ title: "Erro na validação fiscal", description: fiscalErrorMessage(error), variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open, workOrderId]);

  const issue = async () => {
    setIssuing(true);
    try {
      await issueFiscalDocument(workOrderId, competenceDate);
      toast({ title: "Documento fiscal criado", description: "A emissão foi encaminhada ao provedor." });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Emissão bloqueada", description: fiscalErrorMessage(error), variant: "destructive" });
    } finally { setIssuing(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><FileCheck2 className="w-5 h-5" /> Prévia da NFS-e</DialogTitle></DialogHeader>
    {loading || !preview ? <div className="py-8 text-center text-sm text-muted-foreground">Validando dados fiscais...</div> : <div className="space-y-4">
      {preview.errors.length > 0 && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><div className="font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Emissão bloqueada</div><ul className="mt-2 list-disc pl-5">{preview.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      {preview.warnings.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><div className="font-medium">Avisos</div><ul className="mt-2 list-disc pl-5">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
      {preview.ready && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Validação interna concluída.</div>}
      <div className="space-y-2"><h3 className="font-medium text-sm">Serviços incluídos</h3>{preview.items.map((item) => <div key={item.source_item_id} className="flex justify-between gap-3 rounded-lg border border-border p-2 text-sm"><span>{item.description} × {item.quantity}</span><strong>{formatCurrency(item.total)}</strong></div>)}<div className="flex justify-between font-semibold"><span>Total de serviços</span><span>{formatCurrency(preview.totals.services)}</span></div></div>
      {preview.excludedItems.length > 0 && <div className="space-y-2"><h3 className="font-medium text-sm">Itens não incluídos nesta NFS-e</h3>{preview.excludedItems.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm text-muted-foreground"><span>{item.description}</span><span>{formatCurrency(item.total)}</span></div>)}</div>}
      <div className="space-y-1.5"><Label>Data de competência</Label><Input type="date" value={competenceDate} onChange={(event) => setCompetenceDate(event.target.value)} /></div>
    </div>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button><Button onClick={issue} disabled={!preview?.ready || issuing}>{issuing ? "Emitindo..." : "Emitir NFS-e"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

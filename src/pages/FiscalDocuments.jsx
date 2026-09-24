import { useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { getFiscalContext, fiscalErrorMessage } from "@/lib/fiscal";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";

export default function FiscalDocuments() {
  const [context, setContext] = useState(null);
  useEffect(() => { getFiscalContext().then(setContext).catch((error) => toast({ title: "Erro", description: fiscalErrorMessage(error), variant: "destructive" })); }, []);
  if (!context) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  const documents = context.documents.filter((document) => document.direction !== "INBOUND");
  return <div className="space-y-4"><div><h1 className="text-xl md:text-2xl font-heading font-semibold flex items-center gap-2"><FileCheck2 className="w-5 h-5" /> Documentos fiscais de saída</h1><p className="text-sm text-muted-foreground">NFS-e emitidas pela oficina</p></div>{documents.length === 0 ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhum documento fiscal emitido.</div> : <div className="space-y-2">{documents.map((doc) => <div key={doc.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3"><div><div className="font-medium">{doc.document_type} {doc.number ? `#${doc.number}` : "sem número"}</div><div className="text-xs text-muted-foreground">{doc.issue_date ? formatDateTime(doc.issue_date) : "Não emitido"} · Origem {doc.source_id}</div><div className="mt-1 flex gap-3 text-xs">{doc.xml_url && <a className="text-primary underline" href={doc.xml_url} target="_blank" rel="noreferrer">XML</a>}{doc.pdf_url && <a className="text-primary underline" href={doc.pdf_url} target="_blank" rel="noreferrer">PDF fiscal</a>}{doc.public_url && <a className="text-primary underline" href={doc.public_url} target="_blank" rel="noreferrer">Consultar</a>}</div></div><div className="text-right"><div className="font-semibold">{formatCurrency(doc.total_document || 0)}</div><div className="text-xs">{doc.status}</div></div></div>)}</div>}</div>;
}

// @ts-nocheck
import { useEffect, useState } from "react";
import { Archive, Download, FileCheck2, FileInput, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { accountingErrorMessage, downloadBase64, exportAccountingPackage, getAccountingSummary } from "@/lib/accounting";

const pad = (value) => String(value).padStart(2, "0");
const monthPeriod = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${pad(new Date(year, date.getMonth() + 1, 0).getDate())}` };
};

export default function AccountingCenter() {
  const defaults = monthPeriod();
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    if (!start || !end || start > end) return;
    setLoading(true);
    try { setSummary((await getAccountingSummary(start, end)).summary); }
    catch (error) { toast({ title: "Erro ao carregar a Central Contábil", description: accountingErrorMessage(error), variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const exportPackage = async () => {
    if (!start || !end || start > end) {
      toast({ title: "Período inválido", description: "A data inicial deve ser anterior ou igual à data final.", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const result = await exportAccountingPackage(start, end);
      downloadBase64(result);
      setSummary(result.summary);
      toast({ title: "Pacote contábil gerado", description: result.warnings?.length ? `${result.warnings.length} XML(s) não puderam ser incluídos. Consulte o relatório.` : "Todos os arquivos disponíveis foram incluídos." });
    } catch (error) {
      toast({ title: "Erro ao gerar o pacote", description: accountingErrorMessage(error), variant: "destructive" });
    } finally { setExporting(false); }
  };

  const cards = [
    ["NF-e de entrada", summary?.inbound ?? 0, FileInput], ["NF-e de saída", summary?.outbound ?? 0, FileCheck2],
    ["NFS-e de saída", summary?.service ?? 0, FileCheck2], ["Contas a pagar", summary?.payables ?? 0, FileSpreadsheet],
    ["Contas a receber", summary?.receivables ?? 0, FileSpreadsheet], ["XMLs disponíveis", summary?.xmlAvailable ?? 0, Archive],
  ];

  return <div className="space-y-5">
    <div><h1 className="text-xl md:text-2xl font-heading font-semibold flex items-center gap-2"><Archive className="h-6 w-6" />Central Contábil</h1><p className="text-sm text-muted-foreground">Exporte o movimento da oficina sem depender do sistema utilizado pelo contador.</p></div>
    <Card><CardHeader><CardTitle>Período da exportação</CardTitle><CardDescription>Os documentos usam a data fiscal; contas a pagar usam a data do lançamento; contas a receber usam a conclusão da OS.</CardDescription></CardHeader><CardContent className="flex flex-col md:flex-row md:items-end gap-3"><div className="space-y-1.5 flex-1"><Label htmlFor="accounting-start">Data inicial</Label><Input id="accounting-start" type="date" value={start} onChange={(event) => setStart(event.target.value)} /></div><div className="space-y-1.5 flex-1"><Label htmlFor="accounting-end">Data final</Label><Input id="accounting-end" type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></div><Button variant="outline" onClick={load} disabled={loading || !start || !end || start > end}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Conferir</Button></CardContent></Card>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{cards.map(([label, value, Icon]) => <Card key={label}><CardContent className="p-4 flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><Icon className="h-5 w-5 text-primary" /></div><div><div className="text-2xl font-semibold">{loading ? "—" : value}</div><div className="text-xs text-muted-foreground">{label}</div></div></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Pacote completo</CardTitle><CardDescription>Um único ZIP com os XMLs disponíveis, dois arquivos CSV, relatório de conferência e instruções. Documentos sem XML não bloqueiam a exportação: eles ficam identificados no relatório.</CardDescription></CardHeader><CardContent><Button className="w-full md:w-auto" onClick={exportPackage} disabled={exporting || loading}>{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{exporting ? "Preparando arquivos..." : "Baixar pacote contábil (.zip)"}</Button></CardContent></Card>
  </div>;
}


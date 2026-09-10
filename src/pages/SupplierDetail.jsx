import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, MessageCircle, Mail, ShoppingCart, Phone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, allOrders] = await Promise.all([
          base44.entities.Supplier.get(id),
          base44.entities.PurchaseOrder.filter({ supplier_id: id }, "-date", 50),
        ]);
        setSupplier(s);
        setOrders(allOrders);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>;
  if (!supplier) return <div className="text-sm text-muted-foreground py-8 text-center">Fornecedor não encontrado.</div>;

  const totalComprado = orders.reduce((s, o) => s + (o.total || 0), 0);
  const totalPago = orders.filter((o) => o.payment_status === "pago").reduce((s, o) => s + (o.total || 0), 0);
  const totalPendente = orders.filter((o) => o.payment_status !== "pago" && o.payment_status !== "cancelado").reduce((s, o) => s + (o.total || 0), 0);
  const ultimaCompra = orders[0];

  const contactWhatsApp = () => {
    let phone = (supplier.whatsapp || supplier.phone || "").replace(/\D/g, "");
    if (!phone) { toast({ title: "Fornecedor sem WhatsApp/telefone", variant: "destructive" }); return; }
    if (!phone.startsWith("55")) phone = "55" + phone;
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  const contactEmail = () => {
    if (!supplier.email) { toast({ title: "Fornecedor sem e-mail", variant: "destructive" }); return; }
    window.location.href = `mailto:${supplier.email}`;
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-6">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/compras/nova?fornecedor=${id}`)}>
            <ShoppingCart className="w-4 h-4 mr-1" /> Novo Pedido
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/fornecedores")}>
            <Pencil className="w-4 h-4 mr-1" /> Editar
          </Button>
        </div>
      </div>

      {/* Dados */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <h1 className="text-xl font-heading font-semibold">{supplier.name}</h1>
            {supplier.fantasy_name && <p className="text-sm text-muted-foreground">{supplier.fantasy_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {supplier.cpf_cnpj && <div><span className="text-muted-foreground">CPF/CNPJ: </span>{supplier.cpf_cnpj}</div>}
            {supplier.contact_name && <div><span className="text-muted-foreground">Contato: </span>{supplier.contact_name}</div>}
            {supplier.address && <div className="col-span-2"><span className="text-muted-foreground">Endereço: </span>{[supplier.address, supplier.number, supplier.neighborhood, supplier.city, supplier.state].filter(Boolean).join(", ")}</div>}
          </div>
        </CardContent>
      </Card>

      {/* Contato */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-medium text-sm">Contato</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {supplier.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> {supplier.phone}</div>}
            {supplier.whatsapp && <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-green-600" /> {supplier.whatsapp}</div>}
            {supplier.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> {supplier.email}</div>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={contactWhatsApp}><MessageCircle className="w-4 h-4 mr-1" /> WhatsApp</Button>
            <Button size="sm" variant="outline" onClick={contactEmail}><Mail className="w-4 h-4 mr-1" /> E-mail</Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo financeiro */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Total Comprado</div>
          <div className="text-lg font-bold">{formatCurrency(totalComprado)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Total Pago</div>
          <div className="text-lg font-bold text-emerald-600">{formatCurrency(totalPago)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Pendente</div>
          <div className="text-lg font-bold text-amber-600">{formatCurrency(totalPendente)}</div>
        </div>
      </div>

      {/* Últimas compras */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="font-medium text-sm">Últimas Compras</h2>
          {ultimaCompra && (
            <div className="text-xs text-muted-foreground">Última: {formatDate(ultimaCompra.date)} — {formatCurrency(ultimaCompra.total)}</div>
          )}
          {orders.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Nenhuma compra registrada.</div>
          ) : (
            <div className="divide-y divide-border">
              {orders.slice(0, 10).map((o) => (
                <button
                  key={o.id}
                  onClick={() => navigate("/pedidos")}
                  className="flex w-full items-center justify-between gap-2 py-2.5 text-left hover:bg-accent/30 rounded px-2 -mx-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">#{o.number}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(o.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{formatCurrency(o.total)}</div>
                    <div className={`text-xs ${o.payment_status === "pago" ? "text-emerald-600" : "text-amber-600"}`}>
                      {o.payment_status === "pago" ? "Pago" : o.payment_status === "cancelado" ? "Cancelado" : "Pendente"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
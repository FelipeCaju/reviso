# PROGRESSO-OFICINA — Revisô

## Estado Atual: 10/09/2026

### O que já existia (reaproveitado)
- **Entidades**: WorkshopSetting, WorkOrder, WorkOrderItem, Quote, QuoteItem, Customer, Vehicle, VehicleOwner, Appointment, AppointmentHistory, Material, Service
- **Telas**: Dashboard, Appointments, Quotes, QuoteEditor, WorkOrders, WorkOrderEditor, Reports, Customers, CustomerDetail, CustomerForm, Vehicles, VehicleDetail, VehicleForm, Materials, Services, Settings, AdminOnboarding
- **Funcionalidades**: Agenda com drag-and-drop, orçamentos com PDF + WhatsApp, OS com fotos e voz→texto, busca unificada, modo demo 24h, painel admin master, multi-tenant com RLS
- **Padrões**: snapshots preservam dados históricos, Promise.all para paralelização, CurrencyInput com máscara R$

### O que foi alterado
- **WorkOrder**: adicionados campos socorro, payment_status, paid_amount, customer_notified, notified_at, notified_channel, notified_by
- **Quote**: adicionado campo socorro
- **WorkshopSetting**: adicionado campo expense_categories (array editável)
- **Layout**: adicionados itens de menu (Fornecedores, Compras, Despesas, Financeiro)
- **App.jsx**: adicionadas rotas para novos módulos

### O que foi criado
- **Entidades novas (9)**:
  - Supplier — cadastro de fornecedores
  - SupplierMaterial — relação N:N material↔fornecedor com histórico de preços
  - PurchaseRequest — solicitação de cotação
  - PurchaseRequestItem — itens da cotação (com cotações embutidas por fornecedor)
  - PurchaseOrder — pedido de compra
  - PurchaseOrderItem — itens do pedido
  - Payment — pagamentos de OS (múltiplos, com forma e data)
  - Expense — despesas fixas/eventuais, recorrentes
  - FinancialTransaction — movimentação financeira central (entrada/saída)

- **Helper compartilhado**:
  - src/lib/finance.js — registerOSPayment, cancelOSPayment, markExpensePaid, markPurchaseOrderPaid, generateRecurringExpenses, calcPaymentStatus

- **Telas novas**:
  - Suppliers — lista + cadastro de fornecedores
  - SupplierDetail — detalhe com compras, totais, ações rápidas
  - PurchaseRequests — lista de solicitações de cotação
  - PurchaseRequestEditor — criar cotação, adicionar itens, selecionar fornecedores, registrar respostas, comparar, gerar pedido
  - PurchaseOrders — lista de pedidos + recebimento
  - Expenses — lista + cadastro de despesas (fixas/eventuais)
  - Finance — painel financeiro (entradas, saídas, saldo, a receber, a pagar)
  - FinanceReports — relatórios financeiros detalhados

### Decisões tomadas
1. **Entidade central de movimentações**: FinancialTransaction criada automaticamente quando um pagamento/despesa/pedido é registrado. Relatórios consultam uma fonte única.
2. **Despesas recorrentes**: geração de instâncias ao visualizar o Financeiro (generateRecurringExpenses). Cada mês tem seu próprio registro, preservando histórico.
3. **Campo Socorro**: aparece em ambos orçamento e OS. Soma no total cobrado ao cliente.
4. **Cotações dos fornecedores**: embutidas como array em PurchaseRequestItem.supplier_quotes (em vez de entidade separada). Mais simples, menos entidades.
5. **Categorias de despesa**: armazenadas como array em WorkshopSetting (editáveis nas configurações, não fixas no código).
6. **Cancelamento/estorno**: registros cancelados preservam histórico (status: cancelado, não deletados).
7. **Orçamento não é receita**: apenas pagamentos de OS entram como entrada financeira.

### Pendências
- Atualizar WorkOrderEditor: adicionar campo Socorro, seção de Pagamentos, controle de Cliente Notificado
- Atualizar QuoteEditor: adicionar campo Socorro
- Atualizar WorkOrders (listagem): adicionar badges de pagamento/notificação, filtros avançados
- Atualizar Dashboard: adicionar indicadores financeiros + botão "Ver Financeiro"
- Atualizar Reports: evoluir com relatórios financeiros
- Testes completos do fluxo de compra e financeiro

### Testes realizados
- [ ] Cadastrar fornecedor
- [ ] Relacionar materiais com fornecedores
- [ ] Criar solicitação de cotação
- [ ] Selecionar vários fornecedores
- [ ] Registrar preços diferentes
- [ ] Selecionar menor preço por item
- [ ] Selecionar fornecedores diferentes por item
- [ ] Gerar pedido de compra
- [ ] Registrar recebimento
- [ ] Registrar pagamento do pedido
- [ ] Confirmar saída financeira
- [ ] Criar despesa fixa
- [ ] Gerar mês seguinte (ao visualizar Financeiro)
- [ ] Alterar valor futuro sem alterar passado
- [ ] Criar despesa eventual
- [ ] Registrar pagamento de OS
- [ ] Pagamento parcial
- [ ] Pagamento com duas formas
- [ ] Marcar cliente notificado
- [ ] Filtrar OS não pagas
- [ ] Filtrar OS finalizadas e não notificadas
- [ ] Gerar relatório financeiro
- [ ] Confirmar que orçamento não entra como receita
- [ ] Confirmar que valores pendentes não entram como recebidos
- [ ] Confirmar que despesas pendentes não entram como pagas
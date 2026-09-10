# PLANO-MESTRE-OFICINA — Revisô

## Visão Geral
Sistema de gestão inteligente para oficinas mecânicas. Mobile-first, multi-tenant (SaaS), com foco em mobilidade, agendamento digital e histórico permanente de veículos.

## Módulos do Sistema

### 1. Agenda (Lousa Digital)
- Visualização de capacidade por dia
- Drag-and-drop (desktop) via @hello-pangea/dnd
- Botão "+ agendar" no topo de cada coluna de dia
- Status: agendado, confirmado, veículo_recebido, em_atendimento, concluído, cancelado, não_compareceu

### 2. Orçamentos
- Busca unificada de veículos e clientes
- Itens (peças + serviços) via QuoteItemPicker
- Campo de Mão de Obra direta
- Campo Socorro (deslocamento/atendimento externo)
- Desconto sobre o total
- Fotos anexadas
- Voz→texto nos campos de relato e diagnóstico
- Status: rascunho, aguardando_aprovacao, aprovado, parcialmente_aprovado, aguardando_agendamento, agendado, recusado, convertido_os, cancelado
- Aprovação com registro de método (WhatsApp, telefone, presencial, e-mail, outro)
- Agendamento direto do orçamento aprovado
- Conversão em OS
- Exportação PDF + compartilhamento WhatsApp
- **REGRA: Orçamento NÃO é entrada financeira. É apenas previsão/proposta.**

### 3. Ordens de Serviço
- Itens (peças + serviços) com mesma estrutura do orçamento
- Campo Socorro (deslocamento/atendimento externo) — soma no total
- Desconto sobre o total
- Fotos anexadas
- Voz→texto nos campos de relato e diagnóstico
- Status: aberta, aguardando_pecas, em_execucao, aguardando_aprovacao_adicional, finalizada, pronta_retirada, entregue, cancelada
- Itens adicionados após aprovação ficam marcados como "aguardando"
- **Pagamentos**: múltiplos pagamentos por OS (valor, forma, data, usuário)
  - Status de pagamento: nao_pago, parcialmente_pago, pago, isento_cancelado
  - Formas: dinheiro, pix, cartao_debito, cartao_credito, outro
  - Cada pagamento gera movimentação financeira (entrada)
  - Cancelamento/estorno preserva histórico
- **Cliente Notificado**: controle de cobrança
  - Campos: customer_notified, notified_at, notified_channel, notified_by
  - Canais: WhatsApp, telefone, e-mail, presencial, outro

### 4. Clientes
- Cadastro completo (CPF/CNPJ, contato, endereço)
- Detalhe com histórico de veículos, OS e orçamentos

### 5. Veículos
- Cadastro completo (placa, marca, modelo, ano, chassi, renavam)
- Histórico de proprietários (VehicleOwner)
- Detalhe com histórico permanente de OS e orçamentos
- Snapshots preservam dados históricos

### 6. Materiais / Peças
- Cadastro com código, descrição, marca, categoria, custo, preço de venda
- Relação N:N com fornecedores (SupplierMaterial)
- Histórico de preços por fornecedor

### 7. Serviços
- Cadastro com código, descrição, categoria, valor padrão, tempo estimado

### 8. Fornecedores (NOVO)
- Cadastro de fornecedores (empresas/pessoas que fornecem peças, materiais, equipamentos)
- Campos: nome/razão social, nome fantasia, CPF/CNPJ, contato, endereço, nome do contato, observações
- Detalhe mostra: dados, contato, últimas compras, pedidos enviados, cotações, total comprado, total pago, pendentes
- Ações rápidas: novo pedido, ver histórico, editar, contatar via WhatsApp/e-mail

### 9. Compras / Cotações (NOVO)
- **Solicitação de Cotação**: lista de itens que a oficina precisa comprar
  - Campos: número, data, responsável, observação, status, itens
  - Itens: material ou manual, descrição, quantidade, unidade, observação
  - Seleção de múltiplos fornecedores
  - Geração de texto para envio (copiar/WhatsApp/e-mail)
- **Respostas dos Fornecedores**: registradas manualmente por item
  - Cada item tem array de cotações (fornecedor, preço unitário, observação)
- **Comparação**: tela mostra preços lado a lado, destaca menor preço
  - Seleção de fornecedor vencedor por item (não obrigatoriamente um único fornecedor)
- **Pedido de Compra**: gerado da comparação
  - Se itens de fornecedores diferentes, gera pedidos separados
  - Campos: número, data, fornecedor, itens, quantidade, valor unitário, total, previsão, observações, status, responsável
  - Status: rascunho, pedido_realizado, parcialmente_recebido, recebido, cancelado
  - Recebimento: data, itens recebidos, quantidade, observação
  - Pagamento do pedido gera saída financeira

### 10. Despesas (NOVO)
- Despesas que não vêm de pedidos de fornecedores
- **Tipos**: fixa (recorrente) ou eventual
- Campos: descrição, categoria, fornecedor/beneficiário (opcional), valor, data, vencimento, pagamento, status, forma de pagamento, observação, comprovante
- **Categorias editáveis** (armazenadas em WorkshopSetting.expense_categories)
- **Despesas Recorrentes**: geração de instâncias ao visualizar o Financeiro
  - Cada mês tem seu próprio registro (preserva histórico)
  - Mudança de valor futuro não altera meses anteriores
  - Campos de recorrência: periodicidade, dia de vencimento, início, fim
- Status: pendente, pago, vencido, cancelado
- Pagamento de despesa gera saída financeira

### 11. Financeiro (NOVO)
- Controle financeiro gerencial (NÃO contabilidade fiscal/bancária)
- **Entidade central**: FinancialTransaction
  - Cada entrada/saída é derivada da origem (pagamento OS, pedido, despesa)
  - Tipo: entrada/saída
  - Origem: os, pedido, despesa, outro
  - Vinculada ao registro original (origin_id)
  - Status: ativo, cancelado (estorno preserva histórico)
- **Entradas**: pagamentos de OS (NÃO orçamentos)
- **Saídas**: pedidos de compra pagos, despesas pagas
- **Visões**:
  - Painel principal: entradas, saídas, saldo do período
  - A receber: OS com saldo pendente
  - Recebimentos: pagamentos registrados
  - A pagar: saídas pendentes
- **Detalhamento de entradas**: por forma de pagamento (dinheiro, pix, cartão)
- **Detalhamento de saídas**: fornecedores, despesas fixas, eventuais, funcionários, impostos, outros
- **Resultado**: Saldo Operacional do período (NÃO "lucro contábil")

### 12. Relatórios (EVOLUÍDO)
- **Financeiro**: entradas, saídas, saldo por período (hoje, semana, mês, ano, personalizado)
- **OS**: quantidade, valor total, recebido, pendente, socorro, peças, mão de obra
- **Orçamentos**: criados, aprovados, recusados, aguardando, convertidos, taxa de conversão
  - **REGRA: valores de orçamento são PREVISÃO/POTENCIAL, não receita**
- **Fornecedores**: compras, total comprado, pago, pendente, última compra, materiais mais comprados
- **Despesas**: total, fixas, eventuais, principais categorias

### 13. Dashboard
- Indicadores operacionais (capacidade, agendamentos, OS)
- Indicadores financeiros: recebido no mês, a receber, saídas do mês, resultado do mês
- Botão "Ver Financeiro"

### 14. Configurações
- Dados da oficina, capacidade, padrões de documentos
- Categorias de despesa (editáveis)
- Modo demonstração (24h)
- Plano (Free 24h / Normal)

### 15. Admin (Master)
- Painel de controle para gestão de oficinas
- Criação de novas oficinas + convite de proprietários
- Controle de planos (Free vs Normal) e valor mensal

## Regras de Negócio Essenciais

### Entradas Financeiras
- Apenas pagamentos efetivamente registrados de OS
- Orçamentos NÃO são entradas (mesmo aprovados)
- Valores pendentes NÃO são recebidos

### Saídas Financeiras
- Pedidos de compra pagos
- Despesas pagas (fixas e eventuais)
- Evitar duplicidade: pedido pago NÃO deve ser registrado novamente como despesa manual

### Histórico Financeiro
- Pagamentos e despesas históricos NÃO mudam quando cadastros são alterados
- Snapshots preservam nomes de clientes, fornecedores, veículos
- Preços de materiais antigos permanecem em compras antigas
- Formas de pagamento não desaparecem do histórico
- Cancelamento/estorno preserva o registro (não deleta)

### Competência vs Pagamento
- Priorizar visualização por recebido/pago real
- Guardar: data da OS, data da despesa, vencimento, data do pagamento

## Arquitetura de Dados

### Entidades Existentes (atualizadas)
- WorkshopSetting (+ expense_categories)
- WorkOrder (+ socorro, payment_status, paid_amount, customer_notified, notified_at, notified_channel, notified_by)
- Quote (+ socorro)
- Customer, Vehicle, VehicleOwner, Appointment, AppointmentHistory
- Material, Service, QuoteItem, WorkOrderItem

### Entidades Novas
- Supplier — fornecedores
- SupplierMaterial — relação N:N material↔fornecedor com histórico de preços
- PurchaseRequest — solicitação de cotação
- PurchaseRequestItem — itens da cotação (com cotações dos fornecedores embutidas)
- PurchaseOrder — pedido de compra
- PurchaseOrderItem — itens do pedido
- Payment — pagamentos de OS (múltiplos por OS)
- Expense — despesas (fixas/eventuais, recorrentes)
- FinancialTransaction — movimentação financeira central

### Multi-tenant
- Todas as entidades têm workshop_id
- RLS: data.workshop_id = {{user.data.workshop_id}}
- WorkshopSetting: read/update por id = {{user.data.workshop_id}}

## Stack
- React + Tailwind CSS + Vite
- shadcn/ui, lucide-react, recharts, @hello-pangea/dnd, react-quill-new
- @tanstack/react-query
- Base44 SDK (entidades, integrações, auth)
- Mobile-first (breakpoint desktop em 1024px)
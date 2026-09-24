# Checklist — documentos fiscais de entrada

Legenda: `[x]` concluído; `[ ]` pendente; `[!]` depende de ambiente externo.

## Reuso e modelo

- [x] Reutilizar `FiscalDocument`, `FiscalDocumentItem` e `FiscalDocumentEvent`.
- [x] Adicionar direção `INBOUND`/`OUTBOUND` sem quebrar a emissão existente.
- [x] Reutilizar `Supplier`, `Material`, `SupplierMaterial` e `Expense`.
- [x] Não criar uma entidade separada de contas a pagar.
- [x] Criar `StockMovement` para histórico e idempotência do estoque.

## Entrada manual e XML

- [x] Criar tela de documentos de entrada com filtros.
- [x] Permitir NF-e de mercadorias e NFS-e de serviço tomado.
- [x] Permitir lançamento manual com itens mínimos.
- [x] Processar e validar XML no backend.
- [x] Bloquear XML cujo destinatário não seja a oficina autenticada.
- [x] Bloquear duplicidade por chave ou por fornecedor/tipo/número.
- [x] Mostrar prévia antes da confirmação.
- [x] Armazenar XML em arquivo privado e gerar somente URL temporária.
- [x] Permitir vincular XML posterior a um lançamento manual correspondente.

## Cadastros e vínculos

- [x] Localizar fornecedor por CPF/CNPJ sem criá-lo automaticamente.
- [x] Criar fornecedor somente após ação explícita do usuário.
- [x] Localizar materiais por código do fornecedor ou GTIN.
- [x] Permitir vincular, criar ou não controlar estoque por item.
- [x] Ampliar `SupplierMaterial` com código, descrição e GTIN do fornecedor.

## Estoque e financeiro

- [x] Movimentar estoque somente após confirmação explícita.
- [x] Impedir que documento/item movimente estoque duas vezes.
- [x] Permitir concluir NF-e cujos itens foram todos marcados como “não controlar estoque”.
- [x] Aplicar bloqueio otimista e eleição de uma única gravação em confirmações simultâneas.
- [x] Corrigir pedido de compra para não aumentar estoque na criação.
- [x] Registrar recebimento de pedido em `StockMovement`.
- [x] Gerar `Expense` opcionalmente, sem confundir documento e pagamento.
- [x] Impedir conta a pagar duplicada para o mesmo documento.
- [x] Bloquear edição livre no fluxo após o processamento; correções ficam registradas por eventos.
- [x] Exibir detalhes, itens, eventos, movimentações e conta a pagar vinculada.

## Validação

- [x] Validar esquemas, lint, 32 testes de arquitetura/comportamento e build da versão 1.3.0.
- [!] Validar amostras reais de XML de NF-e e dos padrões municipais de NFS-e usados pela oficina.
- [!] Homologar armazenamento privado e URLs assinadas no aplicativo Base44 vinculado.

# REDESENHO DA ARQUITETURA FISCAL E CADASTRAL DO SISTEMA

Quero evoluir o sistema atual para que ele fique preparado para trabalhar com emissão fiscal de forma genérica e multiempresa.

Leia primeiro toda a estrutura atual do projeto, principalmente:

* entidades do Base44;
* banco atual;
* `WorkshopSetting`;
* `Customer`;
* `Supplier`, caso exista;
* `Material`;
* `Service`;
* `Quote` / `QuoteItem`;
* `WorkOrder` / `WorkOrderItem`;
* `Payment`;
* `FinancialTransaction`;
* funções server-side;
* regras RLS;
* telas de cadastro;
* configurações da oficina.

Use também como referência o diagnóstico de NFS-e já produzido anteriormente.

## OBJETIVO PRINCIPAL

Não quero criar regras específicas no código para cada oficina.

Quero uma arquitetura em que:

EMPRESA/OFICINA
↓
CONFIGURAÇÕES CADASTRAIS E FISCAIS
↓
CLIENTES / FORNECEDORES
↓
SERVIÇOS / PEÇAS E MATERIAIS
↓
ORÇAMENTO
↓
ORDEM DE SERVIÇO
↓
FINALIZAÇÃO
↓
DOCUMENTO FISCAL

Cada oficina deverá possuir suas próprias configurações fiscais.

O contador da empresa deverá conseguir fornecer/configurar os dados fiscais necessários sem que seja necessário alterar o código do sistema para cada novo cliente.

---

# 1. PRINCÍPIO DA NOVA ARQUITETURA

Separar claramente três tipos de informação.

### Dados operacionais

Informações utilizadas no funcionamento da oficina:

* nome do cliente;
* telefone;
* veículo;
* descrição da peça;
* descrição do serviço;
* preço;
* orçamento;
* OS;
* pagamento;
* agenda.

### Dados cadastrais/fiscais

Informações utilizadas para documentos fiscais:

* razão social;
* nome fantasia;
* CPF/CNPJ;
* inscrição municipal;
* inscrição estadual quando aplicável;
* endereço estruturado;
* município;
* UF;
* CEP;
* código IBGE;
* regime tributário;
* códigos fiscais dos serviços;
* classificação fiscal das mercadorias;
* tributação;
* retenções;
* demais informações necessárias.

### Dados históricos

Dados que NÃO podem mudar em documentos antigos quando um cadastro for alterado posteriormente.

Exemplo:

O cliente tinha determinado endereço quando a nota foi emitida.

Um mês depois ele altera o endereço.

A nota antiga deve continuar contendo o endereço utilizado no momento da emissão.

Portanto documentos fiscais devem trabalhar com snapshots.

---

# 2. EMPRESA / OFICINA

Hoje existe `WorkshopSetting`.

Avalie se deve continuar sendo a entidade principal ou se é melhor separar:

```text
Workshop
    |
    +-- WorkshopSetting
    |
    +-- WorkshopAddress
    |
    +-- FiscalSetting
    |
    +-- FiscalCredential
```

Não alterar desnecessariamente a arquitetura atual caso `WorkshopSetting` possa ser evoluído de forma segura.

Porém os dados da empresa precisam deixar de depender de um endereço em texto único.

Estruturar, no mínimo:

```text
razao_social
nome_fantasia
cnpj
cpf, quando aplicável
inscricao_municipal
inscricao_estadual
telefone
whatsapp
email

cep
logradouro
numero
complemento
bairro
cidade
uf
codigo_ibge
pais
codigo_pais
```

Separar os dados fiscais em `FiscalSetting`.

Exemplo conceitual:

```text
FiscalSetting
-------------
id
workshop_id

regime_tributario
simples_nacional
mei
inscricao_municipal
inscricao_estadual

municipio_codigo_ibge
municipio_nome
uf

ambiente_fiscal
provedor_fiscal
modo_emissao

configuracoes adicionais necessárias

created_at
updated_at
```

Não colocar certificado, senha ou token fiscal diretamente nessa tabela.

---

# 3. ENDEREÇOS

Quero avaliar a criação de uma estrutura reutilizável de endereço.

Hoje diferentes cadastros podem possuir campos diferentes.

Padronizar conceitualmente:

```text
Address
-------
cep
logradouro
numero
complemento
bairro
cidade
uf
codigo_ibge
pais
codigo_pais
```

Não é obrigatório transformar tudo em uma única tabela `Address` se isso complicar o Base44.

O importante é que:

* empresa;
* cliente;
* fornecedor;

tenham o mesmo padrão de endereço necessário para integrações fiscais.

---

# 4. CLIENTES

Revisar `Customer`.

O cadastro atual já possui boa parte do endereço.

Prepará-lo para pessoa física e jurídica.

Estrutura conceitual:

```text
Customer
--------
id
workshop_id

tipo_pessoa
nome
razao_social
nome_fantasia

cpf_cnpj
inscricao_estadual
inscricao_municipal

email
phone
whatsapp

cep
address
number
complement
neighborhood
city
state
city_ibge_code
country
country_code

consumidor_final
indicador_exterior

active
created_at
updated_at
```

Não adicionar campos fiscais apenas porque existem em algum layout.

Verifique quais realmente serão necessários antes de implementar.

Criar validações de formato e obrigatoriedade dependendo do tipo de documento fiscal.

Exemplo:

Pessoa física não deve ser obrigada a preencher razão social.

---

# 5. FORNECEDORES

Verificar como fornecedor existe atualmente.

Caso seja simples ou incompleto, preparar uma estrutura semelhante à de clientes.

```text
Supplier
--------
id
workshop_id

tipo_pessoa
nome
razao_social
nome_fantasia

cpf_cnpj
inscricao_estadual
inscricao_municipal

email
phone
whatsapp

cep
address
number
complement
neighborhood
city
state
city_ibge_code
country

active
```

Fornecedor deverá futuramente poder ser relacionado a:

```text
Supplier
   ↓
Purchase / SupplierOrder
   ↓
PurchaseItem
   ↓
Material
```

Não precisamos obrigatoriamente construir agora um módulo fiscal completo de compras.

Mas o banco não deve ser desenhado de maneira que impeça isso posteriormente.

---

# 6. PEÇAS / MATERIAIS

Revisar profundamente a entidade atual `Material`.

Hoje uma peça não deve ser apenas:

```text
nome
descrição
valor
quantidade
```

Precisamos separar informação comercial de informação fiscal.

Estrutura conceitual:

```text
Material
--------
id
workshop_id

internal_code
barcode
gtin

name
description
brand

unit
cost_price
sale_price

stock_quantity
minimum_stock

supplier_id

active
```

E criar uma configuração fiscal separada:

```text
MaterialFiscalProfile
---------------------
id
workshop_id
material_id

ncm
cest
origem_mercadoria

demais classificações fiscais necessárias

created_at
updated_at
```

IMPORTANTE:

Não inventar tributação automática.

Campos como CFOP, CST, CSOSN, ICMS, PIS, COFINS e outros NÃO devem simplesmente ser gravados diretamente na peça sem uma análise do contexto.

Algumas dessas informações podem depender de:

* regime da empresa;
* operação;
* origem;
* destino;
* consumidor;
* tipo de documento.

Projete o banco para suportar essas regras futuramente.

---

# 7. SERVIÇOS

Manter `Service` como catálogo comercial.

Exemplo:

```text
Service
-------
id
workshop_id

code
description
category
default_price
estimated_time
notes
active
```

Separar tributação em:

```text
ServiceFiscalProfile
--------------------
id
workshop_id
service_id

codigo_servico_municipal
item_lista_servico
nbs

aliquota_iss
iss_retido
municipio_incidencia

natureza_operacao
exigibilidade

configuracoes_retencao
observacao_fiscal

active
```

Não obrigar que todas essas informações sejam configuradas no cadastro do serviço se algumas puderem ser herdadas da configuração geral da oficina.

Criar hierarquia conceitual:

```text
Configuração fiscal da oficina
            ↓
Configuração fiscal padrão
            ↓
Configuração específica do serviço
```

O serviço só sobrescreve aquilo que for diferente do padrão.

Isso evita que o contador tenha que configurar dezenas de campos repetidos em todos os serviços.

---

# 8. OS COMO ORIGEM DO FATURAMENTO

A OS continua sendo operacional.

Não quero transformar `WorkOrder` em nota fiscal.

Fluxo:

```text
Customer
    ↓
Vehicle
    ↓
Quote
    ↓
WorkOrder
    ↓
WorkOrderItem
    ↓
Finalização
    ↓
FiscalDocument
```

A OS pode possuir:

```text
SERVIÇO
PEÇA
SOCORRO
DESLOCAMENTO
OUTROS
```

Cada item precisa possuir classificação suficientemente clara para o módulo fiscal saber como tratar.

Não presumir que tudo deve entrar em uma NFS-e.

---

# 9. NÃO LIMITAR A ARQUITETURA SOMENTE À NFS-e

O projeto inicial será emissão de NFS-e.

Porém não quero criar um banco tão acoplado à NFS-e que futuramente seja necessário reescrever tudo para outro documento.

Criar conceito de:

```text
FiscalDocument
```

Ou uma arquitetura equivalente.

Exemplo:

```text
FiscalDocument
--------------
id
workshop_id

document_type

source_type
source_id

customer_id

status

issue_date
competence_date

provider
environment

number
series
external_id
verification_code
protocol

total_services
total_products
discount
deductions
taxes
total_document

xml_url
pdf_url
public_url

created_at
updated_at
```

`document_type` poderá inicialmente trabalhar somente com:

```text
NFSE
```

Mas estruturalmente deve permitir futuramente outros documentos sem destruir o módulo.

Não implementar emissão de outros documentos neste momento sem necessidade.

Apenas deixar a arquitetura preparada.

---

# 10. ITENS DO DOCUMENTO FISCAL

Criar algo equivalente a:

```text
FiscalDocumentItem
------------------
id
fiscal_document_id
workshop_id

source_item_type
source_item_id

item_type

description
quantity
unit
unit_price
discount
total

service_fiscal_snapshot
product_fiscal_snapshot
tax_snapshot
```

Ou utilizar campos estruturados adequados ao Base44.

O principal requisito é:

A nota autorizada não pode depender dos dados atuais de `Service`, `Material`, `Customer` ou `WorkshopSetting`.

Ela precisa manter snapshot dos dados utilizados na emissão.

---

# 11. EVENTOS FISCAIS

Criar:

```text
FiscalDocumentEvent
-------------------
id
workshop_id
fiscal_document_id

event_type
status

provider
request_id
protocol
error_code
error_message

created_by
created_at
```

Eventos possíveis:

```text
CREATED
VALIDATION_ERROR
SENT
PROCESSING
AUTHORIZED
REJECTED
CANCELED
REPLACED
RETRY
```

Nunca excluir uma nota simplesmente porque foi cancelada.

---

# 12. CREDENCIAIS FISCAIS

Criar conceito de:

```text
FiscalCredential
```

Mas nunca salvar em banco comum:

```text
senha
certificado
token completo
chave privada
```

Guardar somente:

```text
workshop_id
provider
credential_type
credential_reference
certificate_expiration
status
```

O segredo real deverá ficar no backend/cofre seguro.

---

# 13. CAMADA DE INTEGRAÇÃO

Não quero que o sistema fique preso a uma empresa de API.

Criar uma abstração:

```text
FiscalProvider
```

Conceitualmente:

```text
FiscalProvider
      |
      +-- validate()
      +-- issue()
      +-- query()
      +-- cancel()
      +-- replace()
      +-- downloadXml()
      +-- downloadPdf()
```

Depois poderemos possuir:

```text
NationalNfseProvider

ou

ThirdPartyFiscalProvider
```

A entidade `FiscalDocument` não pode depender do formato interno de um provedor específico.

---

# 14. CONFIGURAÇÃO PELO CONTADOR

Criar no sistema uma área:

```text
Configurações
    ↓
Fiscal
```

Ela deverá ser dividida de forma simples.

### Empresa

Dados fiscais do estabelecimento.

### Tributação

Regime e parâmetros gerais.

### Serviços

Configuração fiscal de cada serviço.

### Produtos/Peças

Informações fiscais necessárias dos materiais.

### Emissão

Modo de emissão.

Exemplo:

```text
Manual
```

e futuramente:

```text
Automática ao finalizar OS
```

### Integração

Provedor, ambiente e status da conexão.

### Contador

Opcionalmente cadastrar:

```text
nome
escritório
telefone
email
```

Isso é contato administrativo.

Não confundir contador com usuário obrigatório do sistema.

---

# 15. EXPERIÊNCIA DO USUÁRIO

Não quero uma tela fiscal cheia de campos técnicos aparecendo para todos.

Criar comportamento progressivo.

Exemplo:

```text
Configurações fiscais
Status: INCOMPLETO

Faltam:
• inscrição municipal
• regime tributário
• código fiscal de 3 serviços
```

Quando estiver completo:

```text
Configurações fiscais
Status: PRONTO PARA EMISSÃO
```

Na OS:

```text
OS #00125
Finalizada

Serviços: R$ 450
Peças: R$ 780

[ Emitir documento fiscal ]
```

Ao clicar:

```text
Prévia da emissão

Tomador:
João da Silva

Serviços:
Troca de embreagem      R$ 300
Diagnóstico             R$ 150

Total serviços          R$ 450

Peças não incluídas nesta NFS-e:
Kit embreagem           R$ 780

[Voltar]
[Emitir]
```

Essa separação deverá ser baseada nas regras configuradas.

---

# 16. VALIDAÇÃO ANTES DA EMISSÃO

Criar um serviço de validação fiscal.

Exemplo conceitual:

```text
validateFiscalDocument(workshop, customer, workOrder)
```

Resultado:

```text
ready: true/false

errors: []
warnings: []
```

Exemplo:

```text
ERRO
Serviço "Alinhamento" não possui configuração fiscal.

ERRO
Cliente não possui CPF/CNPJ.

AVISO
Cliente não possui e-mail.
```

Uma emissão nunca deverá chegar ao provedor antes de passar pelas validações internas.

---

# 17. MIGRAÇÃO DO BANCO ATUAL

MUITO IMPORTANTE:

Não recriar todas as entidades do zero.

Primeiro analise os dados existentes e produza um mapa:

```text
CAMPO ATUAL
↓
CAMPO NOVO
↓
MANTER / ALTERAR / MIGRAR / DESCONTINUAR
```

Priorizar migração incremental.

Exemplo:

```text
Customer.city
→ manter

Customer.state
→ manter

WorkshopSetting.address
→ preservar temporariamente
→ criar campos estruturados novos
→ migrar progressivamente
```

Não apagar dados existentes.

Não alterar IDs existentes desnecessariamente.

Não quebrar:

* orçamentos antigos;
* OS antigas;
* clientes;
* veículos;
* pagamentos;
* relatórios;
* PDFs;
* integrações existentes;
* Z-API;
* permissões atuais.

---

# 18. RELACIONAMENTO CONCEITUAL FINAL

Quero que a arquitetura se aproxime deste desenho:

```text
                       WORKSHOP
                           |
          +----------------+----------------+
          |                |                |
   WorkshopSetting   FiscalSetting   FiscalCredential
          |
          |
    +-----+-----------------------------+
    |                   |               |
 Customer            Supplier       Employee/User
    |                   |
 Vehicle            Purchase
    |                   |
    |               PurchaseItem
    |                   |
    |                Material
    |                   |
    |          MaterialFiscalProfile
    |
 Quote
    |
 QuoteItem
    |
 WorkOrder
    |
 WorkOrderItem
    |
    +-----------------------+
                            |
                     FiscalDocument
                            |
                +-----------+-----------+
                |                       |
       FiscalDocumentItem      FiscalDocumentEvent
```

Serviços:

```text
Service
   |
ServiceFiscalProfile
   |
WorkOrderItem
   |
FiscalDocumentItem
```

---

# 19. MULTIEMPRESA

Tudo que for configuração fiscal deverá possuir isolamento por:

```text
workshop_id
```

Nunca aceitar simplesmente um `workshop_id` enviado pelo frontend.

O backend deverá validar que o usuário autenticado realmente pertence à oficina.

Operações críticas:

```text
emitir
cancelar
substituir
alterar configuração fiscal
alterar credencial
```

devem possuir autorização server-side.

---

# 20. O QUE NÃO QUERO

Não quero:

* lógica fiscal espalhada pelas páginas React;
* valores fiscais hardcoded;
* regra específica para uma oficina;
* regra específica para Rio Claro diretamente no código;
* certificado salvo em texto puro;
* senha fiscal no frontend;
* emissão diretamente pelo navegador;
* nota fiscal dependente do cadastro atual após ser autorizada;
* apagar nota cancelada;
* misturar pagamento com emissão automaticamente;
* considerar toda peça como serviço;
* considerar toda OS como NFS-e;
* reconstruir o projeto inteiro sem necessidade.

---

# 21. O QUE QUERO DO CODEX PRIMEIRO

Antes de começar alterações grandes, faça uma análise comparativa entre:

```text
ESTRUTURA ATUAL
x
ESTRUTURA PROPOSTA
```

Para cada entidade informe:

```text
MANTER
ALTERAR
CRIAR
MIGRAR
```

Mostre especialmente:

```text
WorkshopSetting
Customer
Supplier
Material
Service
Quote
QuoteItem
WorkOrder
WorkOrderItem
Payment
FinancialTransaction
```

Depois apresente as novas entidades propostas.

Somente crie novas tabelas/campos quando houver justificativa real.

Não duplique informações que já existem.

---

# 22. ORDEM DE EVOLUÇÃO

Planejar a implementação nesta sequência:

```text
FASE 1
Reorganizar cadastros básicos
Empresa
Cliente
Fornecedor
Serviço
Material

FASE 2
Criar configurações fiscais

FASE 3
Criar perfis fiscais de serviços e materiais

FASE 4
Criar FiscalDocument + itens + eventos

FASE 5
Criar validação e prévia fiscal

FASE 6
Criar FiscalProvider

FASE 7
Integrar emissão real

FASE 8
Cancelamento, consulta, XML, PDF e histórico
```

Não começar pela API externa antes de o modelo interno estar correto.

---

# 23. DOCUMENTAÇÃO

Atualizar a documentação do sistema explicando:

* arquitetura fiscal;
* entidades;
* relacionamento;
* campos;
* regras;
* snapshots;
* permissões;
* fluxo de emissão;
* provider;
* segurança;
* migração;
* pendências que ainda dependem de decisão da contadora.

Também criar um diagrama Mermaid com as entidades e relacionamentos.

---

# RESULTADO ESPERADO

Quero transformar o sistema atual em uma plataforma de oficina preparada para fiscal, sem transformar todo o sistema em um ERP contábil.

O sistema deve cuidar do processo:

```text
OPERAÇÃO
↓
CLASSIFICAÇÃO
↓
VALIDAÇÃO
↓
DOCUMENTO FISCAL
↓
PROVEDOR
↓
AUTORIZAÇÃO
```

O contador continua sendo responsável pelas definições tributárias da empresa.

O sistema deve permitir que essas definições sejam configuradas de maneira genérica.

A entrada de uma nova oficina não deve exigir alteração no código.

A regra deve ser:

NOVO CLIENTE
→ configurar empresa
→ configurar fiscal
→ configurar serviços/produtos
→ validar
→ emitir

e NÃO:

NOVO CLIENTE
→ programador altera código
→ cria regra específica
→ publica nova versão.


# 24. MODO FISCAL E MODO NÃO FISCAL

O sistema deve continuar sendo uma única aplicação e uma única base de código.

NÃO criar duas aplicações separadas.

Cada oficina deverá poder operar em um destes cenários:

```text
MODO NÃO FISCAL
ou
MODO FISCAL
```

Essa definição deve ser controlada por configuração/plano da própria oficina.

Exemplo conceitual:

```text
fiscal_module_enabled
fiscal_provider_configured
fiscal_configuration_status
```

## MODO NÃO FISCAL

Quando:

```text
fiscal_module_enabled = false
```

A oficina continua utilizando normalmente:

* clientes;
* fornecedores;
* veículos;
* peças/materiais;
* serviços;
* orçamento;
* agenda;
* ordem de serviço;
* pagamentos;
* financeiro;
* relatórios;
* recibo não fiscal;
* PDF;
* WhatsApp.

Nenhum cadastro fiscal adicional deve ser obrigatório para a operação normal do sistema.

Não exigir:

* inscrição municipal;
* código fiscal de serviço;
* NCM;
* configurações de ISS;
* certificado;
* provedor fiscal;

apenas porque essas estruturas existem no banco.

Os recursos fiscais devem permanecer ocultos ou indisponíveis.

---

## MODO FISCAL

Quando:

```text
fiscal_module_enabled = true
```

Liberar:

* configurações fiscais;
* perfis fiscais dos serviços;
* perfis fiscais das peças quando aplicável;
* prévia fiscal;
* emissão;
* consulta;
* histórico fiscal;
* cancelamento;
* XML;
* PDF fiscal;
* status da integração.

Porém ativar o módulo fiscal NÃO significa que a oficina já está pronta para emitir.

Utilizar estados como:

```text
DISABLED
INCOMPLETE
READY
ERROR
```

Exemplo:

```text
fiscal_module_enabled = true

fiscal_configuration_status = INCOMPLETE
```

Resultado:

```text
Módulo Fiscal
Ativado

Configuração fiscal incompleta.
Emissão bloqueada.
```

Quando todos os requisitos estiverem atendidos:

```text
fiscal_configuration_status = READY
```

Resultado:

```text
Módulo Fiscal
Ativado

Configuração concluída.
Pronto para emissão.
```

---

# 25. REGRAS DE PLANO

Preparar o sistema para que o módulo fiscal possa futuramente fazer parte de planos comerciais.

Exemplo conceitual:

```text
PLAN BASIC
fiscal_module = false

PLAN FISCAL
fiscal_module = true
```

Não hardcodar nomes ou valores dos planos.

Criar apenas a capacidade de habilitar/desabilitar funcionalidades por plano ou feature.

Preferencialmente utilizar conceito de:

```text
feature flags
```

Exemplo:

```text
FEATURE_FISCAL_MODULE
FEATURE_NFSE
```

A regra de acesso deve ser validada no backend.

Não confiar apenas em esconder botões no frontend.

---

# 26. CADASTROS COMPARTILHADOS

Cliente, fornecedor, serviço e material continuam sendo entidades únicas.

NÃO criar:

```text
FiscalCustomer
NonFiscalCustomer

FiscalMaterial
NonFiscalMaterial
```

A arquitetura correta deve ser:

```text
Customer
   |
   +-- dados operacionais
   |
   +-- dados fiscais opcionais
```

e:

```text
Material
   |
   +-- dados operacionais
   |
   +-- MaterialFiscalProfile opcional
```

e:

```text
Service
   |
   +-- dados operacionais
   |
   +-- ServiceFiscalProfile opcional
```

Assim uma oficina que hoje utiliza o modo não fiscal pode futuramente ativar o módulo fiscal sem precisar recadastrar:

* clientes;
* fornecedores;
* serviços;
* materiais;
* veículos;
* OS anteriores.

---

# 27. MIGRAÇÃO ENTRE PLANOS

O sistema deve permitir:

```text
NÃO FISCAL
      ↓
ATIVA MÓDULO FISCAL
      ↓
COMPLETA CONFIGURAÇÕES
      ↓
CONFIGURA SERVIÇOS/PRODUTOS
      ↓
VALIDAÇÃO
      ↓
READY
```

Sem reconstruir os cadastros existentes.

Também deve ser possível desativar comercialmente o módulo fiscal sem apagar os documentos fiscais já existentes.

Exemplo:

```text
cliente deixa de contratar módulo fiscal
```

O sistema:

* bloqueia novas emissões;
* mantém histórico das notas anteriores;
* mantém XML/PDF quando permitido;
* não exclui dados fiscais históricos.

---

# 28. IMPACTO NAS TELAS

Evitar poluir a experiência do cliente não fiscal.

Quando o módulo fiscal estiver desativado:

```text
Configurações
- Empresa
- Usuários
- Sistema
```

Quando ativado:

```text
Configurações
- Empresa
- Usuários
- Sistema
- Fiscal
```

Na OS não fiscal:

```text
[Finalizar OS]
[Gerar recibo]
```

Na OS fiscal, quando READY:

```text
[Finalizar OS]
[Gerar recibo]
[Emitir NFS-e]
```

Se fiscal estiver ativado mas incompleto:

```text
[Emitir NFS-e]
bloqueado

Configuração fiscal incompleta.
```

---

# 29. REGRA PRINCIPAL DA ARQUITETURA

O sistema deve ser:

```text
UMA APLICAÇÃO
+
UMA BASE DE CÓDIGO
+
MÓDULOS OPCIONAIS
```

e NÃO:

```text
VERSÃO FISCAL
+
VERSÃO NÃO FISCAL
+
DOIS PROJETOS DIFERENTES
```

O módulo fiscal deve ser apenas uma extensão das funcionalidades já existentes.

Todos os fluxos normais da oficina devem continuar funcionando independentemente da ativação do módulo fiscal.

# Diagnóstico do sistema para futura emissão de NFS-e

**Data da análise:** 21 de setembro de 2026  
**Escopo:** diagnóstico técnico e funcional do repositório atual. Nenhuma alteração de código, dados, banco, telas, regras ou integrações foi realizada.

## 1. Como o sistema funciona hoje

O sistema é uma aplicação React/Vite com backend Base44. As entidades de dados ficam em `base44/entities`; o frontend usa o SDK configurado em `src/api/base44Client.js`; e as funções server-side existentes tratam de gestão de oficinas/usuários, demonstração e envio de PDFs pelo WhatsApp.

Fluxo operacional atual:

```text
Cliente + veículo
       ↓
Orçamento com peças e serviços
       ↓
Aprovação e/ou agendamento
       ↓
Conversão em Ordem de Serviço
       ↓
Execução/finalização da OS
       ↓
Registro de pagamentos
       ↓
Lançamento financeiro e recibo não fiscal
```

- Clientes são cadastrados em `Customer`.
- Serviços são cadastrados em `Service`; materiais/peças ficam em `Material`.
- Orçamentos usam `Quote` (cabeçalho) e `QuoteItem` (itens).
- Ordens de Serviço usam `WorkOrder` (cabeçalho) e `WorkOrderItem` (itens).
- Pagamentos usam `Payment`, com reflexo financeiro em `FinancialTransaction`.
- Os dados da empresa/oficina ficam em `WorkshopSetting`.
- Há geração de PDF para orçamento, OS e recibo. O recibo é explicitamente não fiscal e não substitui NFS-e.
- A única integração externa atual é a Z-API para envio de PDFs por WhatsApp. Não há emissão fiscal, XML, consulta de NFS-e ou integração com prefeitura/API fiscal.

Arquivos de referência principais:

- `src/pages/Settings.jsx`
- `src/pages/CustomerForm.jsx`
- `src/pages/Services.jsx`
- `src/pages/QuoteEditor.jsx`
- `src/pages/WorkOrderEditor.jsx`
- `src/lib/finance.js`
- `src/lib/pdf.js`
- `base44/functions/manageWorkshops/entry.ts`
- `base44/functions/sendWhatsAppDocument/entry.ts`

## 2. Dados atuais reaproveitáveis para NFS-e

| Domínio | Entidade e campos existentes | Observação |
|---|---|---|
| Prestador | `WorkshopSetting.name`, `razao_social`, `cnpj`, `phone`, `whatsapp`, `email`, `address`, `logo_url` | Endereço é texto único; faltam CEP, número, bairro, cidade/UF e código IBGE separados. |
| Tomador | `Customer.name`, `cpf_cnpj`, `phone`, `whatsapp`, `email`, `cep`, `address`, `number`, `complement`, `neighborhood`, `city`, `state` | Boa base cadastral; não há validação de CPF/CNPJ, código IBGE do município, país ou indicador de exterior. |
| Catálogo de serviços | `Service.code`, `description`, `category`, `default_price`, `estimated_time`, `notes`, `active` | `code` é interno; não há código fiscal do serviço nem tributação. |
| Serviço efetivamente prestado | `WorkOrderItem.type`, `description`, `quantity`, `unit_price`, `discount`, `total`, `service_id` | Principal origem da nota. Para NFS-e, devem ser selecionados somente itens com `type = servico`. |
| Cabeçalho da prestação | `WorkOrder.number`, `customer_id`, `customer_name_snapshot`, `entry_date`, `completion_date`, `status`, `subtotal_labor`, `discount`, `total` | `completion_date` é preenchida na finalização. O total inclui peças, serviços, socorro e desconto. |
| Contexto comercial | `Quote` e `QuoteItem` | Úteis como referência comercial; a fonte fiscal deve ser a OS/conclusão, não o orçamento. |
| Recebimento | `Payment.amount`, `method`, `date`, `status`; `FinancialTransaction` | Útil para conciliação; pagamento não deve definir automaticamente a data fiscal sem regra contábil. |

Entidades e esquemas relevantes:

- `base44/entities/WorkshopSetting.jsonc`
- `base44/entities/Customer.jsonc`
- `base44/entities/Service.jsonc`
- `base44/entities/WorkOrder.jsonc`
- `base44/entities/WorkOrderItem.jsonc`
- `base44/entities/Payment.jsonc`
- `base44/entities/FinancialTransaction.jsonc`

## 3. Informações fiscais ausentes

Não há atualmente nenhum campo, regra ou entidade para:

- inscrição municipal do prestador;
- regime tributário, opção pelo Simples Nacional, MEI, CRT ou enquadramentos especiais;
- endereço fiscal estruturado da oficina e código IBGE do município;
- CNAE, código tributário municipal, item da lista de serviços, NBS e classificação fiscal do serviço;
- município de incidência, local da prestação, natureza da operação e exigibilidade do ISS;
- alíquota de ISS, ISS retido, responsável pela retenção, deduções e demais retenções federais aplicáveis;
- dados fiscais complementares do tomador;
- separação fiscal entre mão de obra, deslocamento/socorro e peças;
- série, número fiscal, chave/identificador, código de verificação, competência e status fiscal;
- XML, PDF/DANFSe, URL pública, protocolos, rejeições, cancelamentos, substituições ou eventos;
- credenciamento, ambiente de homologação/produção, certificado digital, autenticação e credenciais por empresa;
- auditoria e histórico de tentativas de emissão.

### Ponto fiscal crítico: peças e serviços

Uma OS pode conter itens `material` e `servico`. A NFS-e cobre a prestação de serviços. Peças não devem ser incluídas automaticamente na NFS-e: a contadora deve definir qual documento fiscal se aplica a cada cenário. O campo `socorro` também precisa de classificação fiscal confirmada.

## 4. Banco de dados: reaproveitamento e estrutura futura

### Entidades a reaproveitar

- `WorkshopSetting`: dados cadastrais básicos do prestador.
- `Customer`: tomador do serviço.
- `Service`: catálogo comercial de serviços.
- `WorkOrder` e `WorkOrderItem`: origem da prestação, itens e valores.
- `Payment`: vínculo informativo de recebimento.
- `FinancialTransaction`: conciliação financeira, não como documento fiscal.

### Novas entidades sugeridas

Seguindo o padrão atual do projeto, os nomes sugeridos são:

- `FiscalSetting`: configuração fiscal por `workshop_id`; regime, inscrição municipal, município/IBGE, ambiente, política de emissão e parâmetros do prestador.
- `ServiceFiscalProfile`: vínculo por serviço/oficina; código municipal, item da lista, NBS quando aplicável, ISS, retenções e regras de incidência.
- `FiscalCredential`: somente metadados e referência segura à credencial. Nunca senha ou certificado em texto puro.
- `Invoice`: NFS-e emitida, referência à OS, tomador e prestador em snapshot, competência, totais fiscais, status, número, chave, protocolo, XML/PDF/URL.
- `InvoiceItem`: itens fiscais imutáveis, derivados exclusivamente das linhas de serviço da OS.
- `InvoiceEvent`: tentativa de emissão, consulta, autorização, rejeição, cancelamento, substituição e protocolos/erros associados.
- `MunicipalityFiscalConfiguration`: opcional; necessária se houver regras específicas por município ou múltiplos provedores.

Todas as entidades fiscais devem ter `workshop_id` obrigatório e regras RLS equivalentes às entidades operacionais. A nota deve manter snapshots completos: alterações posteriores no cliente, serviço ou empresa não podem modificar uma NFS-e já autorizada.

## 5. Fluxo ideal de emissão

```text
OS finalizada
   ↓
Validar cadastro fiscal da oficina, tomador e serviços
   ↓
Separar somente itens de serviço faturáveis
   ↓
Usuário revisa prévia fiscal
   ↓
Criar Invoice em “pendente”
   ↓
Enviar DPS/payload à integração
   ↓
Autorizada? ── não → registrar erro, protocolo e nova tentativa controlada
   ↓ sim
Salvar número, chave, XML, PDF/link e status “autorizada”
   ↓
Disponibilizar impressão, e-mail e WhatsApp
```

### Regras recomendadas

- Começar com emissão manual disponível quando a OS estiver `finalizada`.
- Permitir automação posteriormente por política da oficina: na finalização da OS, no pagamento, ou ambos — sujeito à validação contábil.
- Impedir duplicidade: uma OS não pode emitir duas NFS-e sem fluxo explícito de substituição.
- Cancelamento deve exigir motivo, obedecer a prazo/regra aplicável, chamar a API e registrar evento. Nunca apagar a nota.
- Erros devem manter a nota como `rejeitada` ou `pendente_retentativa`, incluindo data, usuário, código/mensagem do provedor e protocolo.

## 6. Estratégia de integração

A NFS-e Nacional oferece emissão por API para ERP, mas exige credenciamento prévio no Painel do Contribuinte. A documentação oficial atual possui layouts, XSDs, APIs e ambientes de produção/homologação.

| Critério | Integração direta Nacional | API fiscal especializada |
|---|---|---|
| Complexidade inicial | Alta: layouts, credenciamento, assinatura, regras e evolução técnica | Menor no sistema; o provedor abstrai parte da complexidade |
| Manutenção | Responsabilidade do sistema | Compartilhada, mas há dependência do fornecedor |
| Custo recorrente | Sem intermediário, porém com maior custo de desenvolvimento/suporte | Cobrança por nota/plano, menor operação própria |
| Cobertura | Boa para empresas/municípios aptos ao emissor nacional | Pode cobrir Nacional e prefeituras/provedores legados |
| Certificado | Pode exigir autenticação mútua e certificado ICP-Brasil | Alguns provedores abstraem parte do fluxo, mas a responsabilidade fiscal é do prestador |
| Multiempresa | Exige credenciamento e credenciais isoladas por oficina | Facilita escala se conta/credencial for segregada por oficina |

### Recomendação técnica

Criar futuramente uma camada interna de integração neutra, por exemplo `FiscalProvider`, sem acoplar `Invoice` ao formato de uma API específica.

Para oficinas optantes pelo Simples Nacional, a integração Nacional deve ser o caminho prioritário: ME e EPP optantes passaram a usar obrigatoriamente o Emissor Nacional a partir de 1º de setembro de 2026. Uma API especializada permanece útil como adaptador/fallback para cenários municipais específicos, cobertura ampliada e redução da operação própria.

Fontes oficiais:

- https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual
- https://www.gov.br/pt-br/servicos/emitir-nota-fiscal-de-servico-eletronica
- https://www.gov.br/nfse/pt-br/noticias/nfs-e-e-simples-nacional-obrigatoriedade-de-emissao-atraves-do-emissor-nacional

## 7. Multiempresa

O sistema já é multi-tenant de forma consistente:

- Registros operacionais possuem `workshop_id`.
- As regras RLS exigem que o `workshop_id` do dado corresponda ao usuário.
- `WorkshopSetting` só permite leitura/alteração da oficina do usuário; atualização exige papel `admin`.
- `WorkshopAccess` e `manageWorkshops` fazem o vínculo entre usuário e oficina.

A estrutura suporta configurações fiscais distintas por empresa, desde que toda entidade fiscal possua `workshop_id` e o servidor nunca aceite o identificador de oficina fornecido pelo navegador sem validá-lo contra o usuário autenticado.

### Atenção sobre permissões

Nas entidades operacionais, a RLS isola bem uma oficina da outra, mas em geral não restringe escrita por papel `admin`; parte da proteção atual é de interface. O módulo fiscal deve implementar autorização server-side explícita por papel para emitir, cancelar e acessar credenciais.

## 8. Segurança

Situação atual:

- Não há armazenamento de certificado, senha fiscal ou token de NFS-e.
- A única credencial externa encontrada é a da Z-API, lida por variáveis de ambiente no backend e não exposta no repositório.
- O PDF enviado por WhatsApp é carregado como arquivo público. Esse mecanismo não é apropriado para certificado, XML ou documentos fiscais com acesso controlado.

Recomendações para a futura NFS-e:

- Guardar certificado A1, senha, tokens e chaves somente em cofre/secret manager do backend, com criptografia.
- Guardar em `FiscalCredential` apenas referência, validade, tipo e metadados mascarados.
- Executar emissão, consulta, cancelamento e download somente em função server-side.
- Nunca registrar em log senha, certificado, token completo, XML assinado completo ou dados pessoais desnecessários.
- Aplicar controle de acesso por papel em todas as operações fiscais.

O guia oficial de APIs cita comunicação HTTPS com autenticação mútua e certificado ICP-Brasil em cenários documentados:

- https://www.gov.br/nfse/pt-br/nfs-e-via/documentacao-tecnica/anexo-ii-guia-para-utilizacao-das-api2019s-nfs-e_via-v1-0_producao.pdf

## 9. Perguntas para a contadora

1. Para cada oficina, qual é o regime tributário e há opção pelo Simples Nacional ou enquadramento MEI?
2. Qual é a inscrição municipal e qual município/código IBGE deve constar como estabelecimento prestador?
3. A oficina deve emitir NFS-e somente pela mão de obra? Como devem ser tratados peças, materiais e deslocamento/socorro?
4. Para cada serviço atual, qual código municipal, item da lista de serviços e NBS devem ser configurados?
5. Qual alíquota de ISS deve ser usada por serviço, município e regime?
6. Em quais situações há retenção de ISS e quem é o responsável pelo recolhimento?
7. Há retenções de IR, INSS, PIS, Cofins ou CSLL a informar para esses serviços?
8. A competência e a emissão devem ocorrer na conclusão da OS, no pagamento, na entrega do veículo ou em outro momento?
9. Quais serviços podem usar uma descrição genérica de “mão de obra” e quais exigem discriminação específica?
10. Qual natureza de operação, exigibilidade e município de incidência devem ser usados nos casos mais comuns?
11. Há deduções permitidas para peças/materiais dentro do serviço? Se houver, como comprovar e informar?
12. O município utiliza plenamente o padrão nacional ou há configuração/localidade que exija tratamento específico?
13. Há necessidade de certificado digital? Qual tipo e quem será o responsável legal pelo credenciamento?
14. Qual prazo e procedimento de cancelamento, substituição ou correção de NFS-e?
15. A empresa precisa informar IBS/CBS ou outros grupos ligados à transição da reforma tributária no seu cenário?

## 10. Resultado final

### Já temos

- Multiempresa por oficina, com isolamento por `workshop_id`.
- Cadastro básico de empresa, clientes, serviços e valores.
- OS com itens de serviço e materiais separados.
- Controle de finalização, pagamentos, financeiro, PDF e WhatsApp.
- Base técnica para incluir módulo fiscal sem reestruturar o fluxo comercial.

### Precisamos criar

- Cadastro fiscal do prestador por oficina.
- Perfil fiscal por serviço.
- Entidades de nota, itens fiscais, eventos e tentativas.
- Integração server-side para emissão, consulta, cancelamento e armazenamento seguro.
- Interface de prévia, emissão, status, histórico e compartilhamento da NFS-e.
- Regras de separação de serviço versus peça/material.

### Precisamos confirmar com a contadora

- Regime, inscrição municipal, códigos de serviço, ISS, retenções e momento de emissão.
- Tratamento de mão de obra, peças, socorro/deslocamento e descontos.
- Regras municipais e requisitos de cancelamento/substituição.
- Obrigatoriedades do Simples Nacional e da reforma tributária.

### Precisamos definir tecnicamente

- Uso direto da API Nacional, intermediário especializado ou adaptador híbrido.
- Política manual/automática de emissão.
- Cofre de segredos e estratégia para certificados.
- Ambiente de homologação, autorização por papel, observabilidade e retenção de XML/PDF/eventos.


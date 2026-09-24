# Checklist de evolução da arquitetura fiscal

Legenda: `[x]` concluído e verificado; `[ ]` pendente; `[!]` depende de decisão/serviço externo.

## Preparação

- [x] Ler o redesenho fiscal e o diagnóstico anterior.
- [x] Atualizar as skills oficiais da Base44 exigidas pelo projeto.
- [x] Preservar entidades, IDs e fluxos operacionais existentes.
- [x] Validar todos os esquemas JSONC das entidades.
- [x] Executar lint dos arquivos alterados.
- [x] Executar 26 testes de acesso, multiempresa e arquitetura fiscal.
- [x] Executar build de produção e conferir versão `1.2.0` no build.
- [!] `npm run typecheck` permanece bloqueado por erros de tipagem preexistentes nos componentes UI; o build e o lint dos arquivos alterados passam.
- [!] Gerar tipos Base44 após vincular este clone com `npx base44 link` (a CLI retornou “App not configured”).

## Fase 1 — Cadastros básicos

- [x] Estruturar endereço da oficina sem remover `WorkshopSetting.address`.
- [x] Preparar `Customer` para PF/PJ, exterior e endereço fiscal.
- [x] Preparar `Supplier` com estrutura cadastral equivalente.
- [x] Evoluir `Material` sem renomear/remover os campos atuais.
- [x] Manter `Service` como catálogo comercial.
- [x] Atualizar telas de empresa, cliente, fornecedor e material.
- [x] Documentar mapa de migração campo atual → campo novo.

## Fase 2 — Configurações e habilitação fiscal

- [x] Criar `FiscalSetting` isolada por `workshop_id`.
- [x] Criar feature flag do módulo fiscal e estados `DISABLED/INCOMPLETE/READY/ERROR`.
- [x] Permitir ativação comercial sem apagar histórico ao desativar.
- [x] Criar contato administrativo opcional do contador.
- [x] Garantir alteração somente por administrador no backend.
- [x] Permitir que o administrador da plataforma defina oficina fiscal ou não fiscal ao criar, provisionar ou editar.

## Fase 3 — Perfis fiscais

- [x] Criar `ServiceFiscalProfile` com herança dos padrões da oficina.
- [x] Criar `MaterialFiscalProfile` sem tributação automática inventada.
- [x] Criar telas progressivas de configuração por serviço/material.
- [x] Exibir pendências de configuração.

## Fase 4 — Documentos fiscais

- [x] Criar `FiscalDocument` genérico, inicialmente com `document_type = NFSE`.
- [x] Criar `FiscalDocumentItem` com snapshots imutáveis.
- [x] Criar `FiscalDocumentEvent` sem exclusão de histórico.
- [x] Criar `FiscalCredential` somente com metadados/referência segura.
- [x] Preservar separação entre OS, pagamento e documento fiscal.

## Fase 5 — Validação e prévia

- [x] Criar validação fiscal server-side com erros e avisos.
- [x] Impedir envio ao provedor quando houver erro interno.
- [x] Criar prévia de NFS-e na OS, separando serviços e peças.
- [x] Bloquear duplicidade de emissão por OS.
- [x] Manter fluxo não fiscal inalterado quando o módulo estiver desativado.

## Fase 6 — Camada de integração

- [x] Criar contrato interno de provedor fiscal.
- [x] Implementar ações `validate`, `issue`, `query`, `cancel`, `replace` e downloads.
- [x] Garantir que formatos externos não vazem para `FiscalDocument`.
- [x] Executar operações críticas somente no backend.

## Fase 7 — Emissão real

- [x] Criar checklist operacional por oficina.
- [x] Configurar série e próximo RPS por oficina.
- [x] Criar contrato e ação genérica de teste de conexão.
- [x] Bloquear produção até uma emissão autorizada em homologação.
- [x] Reiniciar conexão/homologação ao trocar de provedor.
- [x] Documentar decisões por responsável em `DECISOES-PENDENTES-EMISSAO-FISCAL.md`.
- [!] Escolher provedor/API e obter documentação/credenciais de homologação.
- [!] Confirmar regras tributárias com a contadora.
- [!] Configurar cofre de segredos/certificado por oficina.
- [!] Homologar emissão real de NFS-e.

## Fase 8 — Pós-emissão

- [x] Implementar consulta, cancelamento e substituição no domínio interno.
- [x] Disponibilizar histórico, XML, PDF e URL pública quando retornados.
- [x] Manter documentos antigos persistidos quando o módulo for desativado.
- [!] Integrar compartilhamento por WhatsApp/e-mail após definir armazenamento privado e URLs temporárias do provedor.

## Segurança e multiempresa

- [x] Exigir `workshop_id` em todas as entidades fiscais.
- [x] Validar oficina autenticada no backend; não confiar no frontend.
- [x] Exigir papel administrativo nas operações críticas.
- [x] Nunca armazenar senha, token completo, certificado ou chave privada nas entidades.
- [x] Mascarar dados sensíveis em erros e logs.

## Documentação

- [x] Documentar entidades, campos, regras, snapshots e migração.
- [x] Documentar permissões, provider e segurança.
- [x] Criar diagrama Mermaid.
- [x] Registrar decisões ainda dependentes da contadora/provedor.


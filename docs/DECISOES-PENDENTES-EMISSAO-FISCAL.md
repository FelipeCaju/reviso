# Decisões pendentes para emissão fiscal

Este documento separa o que precisa ser decidido pelo proprietário da plataforma, pelo escritório contábil e por cada oficina. O sistema não deve inventar dados tributários nem liberar produção sem homologação.

## Felipe — proprietário da plataforma

- [ ] Escolher o provedor fiscal que atenderá as oficinas e fornecer a documentação da API.
- [ ] Definir se o contrato com o provedor será centralizado pela plataforma ou contratado por cada oficina.
- [ ] Definir quais documentos entram na primeira integração: somente NFS-e ou também NF-e/NFC-e.
- [ ] Definir quem arca com o custo por emissão e como esse custo entra nos planos comerciais.
- [ ] Obter credenciais de sandbox/homologação e informar os limites e regras do provedor.
- [ ] Aprovar o mecanismo de cofre seguro indicado pelo provedor/Base44 para certificados e tokens.
- [ ] Definir canal e responsável pelo suporte quando uma prefeitura ou SEFAZ rejeitar uma nota.

## Escritório contábil

- [ ] Confirmar o regime tributário de cada oficina, inclusive MEI/Simples Nacional.
- [ ] Confirmar inscrição municipal, inscrição estadual e município de incidência.
- [ ] Informar código municipal, item da lista de serviços, NBS e alíquota de ISS por serviço.
- [ ] Definir natureza da operação, exigibilidade, retenções e regras de ISS.
- [ ] Confirmar NCM, CEST e origem das mercadorias quando houver emissão de produtos.
- [ ] Informar se deslocamento, socorro, descontos e materiais devem compor a NFS-e ou outro documento.
- [ ] Confirmar série e próximo RPS inicial, considerando a numeração já utilizada fora do sistema.
- [ ] Validar os dados e o resultado dos documentos emitidos em homologação.
- [ ] Autorizar formalmente a passagem da oficina para produção.

## Cada oficina

- [ ] Conferir razão social, nome fantasia, CNPJ, endereço e contatos.
- [ ] Disponibilizar certificado A1 e senha, token ou credencial exigida pelo provedor, somente pelo fluxo seguro que será integrado.
- [ ] Confirmar a série e o próximo RPS informados pelo contador.
- [ ] Emitir e conferir os documentos solicitados durante a homologação.

## O que o sistema já garante

- [x] O módulo fiscal de cada oficina só pode ser habilitado pelo administrador da plataforma.
- [x] Dados e documentos fiscais são isolados por oficina.
- [x] O administrador da oficina preenche dados cadastrais, tributários, serviços, produtos e contador.
- [x] Existe contrato neutro para integrar um provedor sem acoplar o domínio ao formato externo.
- [x] Série e próximo RPS são configuráveis por oficina e validados no backend.
- [x] Existe teste de conexão genérico, a ser atendido pelo adaptador do provedor escolhido.
- [x] A produção fica bloqueada até existir uma emissão autorizada em homologação.
- [x] Trocar o provedor reinicia o teste de conexão, a homologação e retorna o ambiente para homologação.
- [x] Certificados, senhas, tokens e chaves privadas não são gravados nas entidades comuns.

## Dependências externas inevitáveis

- [!] Adaptador real do provedor escolhido.
- [!] Cofre de segredos/certificados suportado pelo ambiente e pelo provedor.
- [!] Credenciais de homologação e produção.
- [!] Regras e eventuais cadastros específicos de cada prefeitura/SEFAZ.
- [!] Emissão autorizada em homologação antes da liberação de produção.


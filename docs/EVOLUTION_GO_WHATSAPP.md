# Envio de documentos pelo WhatsApp — Evolution GO

O sistema envia PDFs de orçamento, Ordem de Serviço e solicitação de cotação pelo Evolution GO configurado para cada oficina. O envio só acontece quando o usuário confirma a prévia; gerar ou salvar um documento não dispara mensagens.

## Criação da instância pela oficina

O administrador de cada oficina pode criar e conectar a própria instância em **Configurações → WhatsApp**. O sistema gera um nome único para a instância, cria um token exclusivo no backend e mostra apenas o QR Code para vincular o celular.

Antes de liberar esse fluxo, configure estes segredos no ambiente das funções Base44 (nunca no frontend nem no repositório):

- `EVOLUTION_GO_BASE_URL`: URL única do servidor Evolution GO, por exemplo `https://evolution.seudominio.com`;
- `EVOLUTION_GO_GLOBAL_API_KEY`: chave global usada exclusivamente para `POST /instance/create`.

A chave global não sai do backend. O token de cada instância também fica em um registro sem leitura direta e só é usado pelas funções de backend. A função usa a oficina do usuário autenticado, portanto um administrador não consegue criar ou consultar instâncias de outra oficina.

## Configuração manual por oficina

Somente o administrador da plataforma (`felipecaju172@gmail.com`) pode configurar a integração, no modal **Editar** da oficina em Gestão de Oficinas.

Para cada oficina, informe:

- URL da Evolution GO, por exemplo `https://evolution.seudominio.com`;
- nome da instância, para identificação administrativa;
- API key ou token da instância.

A chave não volta para o navegador depois de salva. A tela apenas confirma que há uma chave cadastrada e mostra os quatro últimos caracteres; deixe o campo em branco para preservar a chave atual.

As credenciais ficam em um registro sem leitura direta por usuários e são acessadas exclusivamente pelas funções de backend. Cada envio usa a configuração da oficina vinculada ao usuário autenticado.

## Envio

O backend envia um `POST /send/media` autenticado pelo cabeçalho `apikey`, com:

- `number`: telefone brasileiro normalizado para DDI + DDD + número;
- `url`: URL pública temporária do PDF;
- `type`: `document`;
- `filename` e `caption`.

Se uma oficina não tiver a integração configurada, o envio é bloqueado com uma mensagem orientando a criar ou conectar a instância em Configurações.

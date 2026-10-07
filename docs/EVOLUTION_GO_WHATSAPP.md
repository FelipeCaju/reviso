# Envio de documentos pelo WhatsApp — Evolution GO

O sistema envia PDFs de orçamento, Ordem de Serviço e solicitação de cotação pelo Evolution GO configurado para cada oficina. O envio só acontece quando o usuário confirma a prévia; gerar ou salvar um documento não dispara mensagens.

## Configuração por oficina

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

Se uma oficina não tiver a integração configurada, o envio é bloqueado com uma mensagem orientando a solicitar a configuração ao administrador.

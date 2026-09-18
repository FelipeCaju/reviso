# Envio de documentos pelo WhatsApp (Z-API)

O sistema envia PDFs de orçamento, Ordem de Serviço e solicitação de cotação pela instância Z-API configurada no Base44. O envio só acontece quando o usuário aciona o botão com o ícone do WhatsApp; gerar ou salvar um documento não dispara mensagens.

## Identificação da oficina e isolamento

A identificação da origem é montada no backend com o nome da oficina vinculada ao usuário autenticado. A tela não informa esse nome ao servidor. Assim, cada mensagem contém `Aqui é {nome da oficina}` e um usuário só pode enviar documentos da própria oficina.

As credenciais atuais da Z-API são globais para este aplicativo e o número remetente é o número conectado a essa instância. Para que cada oficina envie de um número próprio, será necessário cadastrar e armazenar uma conexão Z-API por oficina em uma evolução posterior; tokens nunca devem ficar no navegador.

## Segredos necessários no Base44

Configure estes segredos no painel do Base44, sem adicionar seus valores ao Git:

- `ZAPI_INSTANCE_ID`
- `ZAPI_INSTANCE_TOKEN`
- `ZAPI_CLIENT_TOKEN`
- `ZAPI_WHATSAPP_NUMBER` (referência do número conectado)

O envio usa `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN` e `ZAPI_CLIENT_TOKEN`. O número conectado é administrado pela própria instância Z-API.

## Telefone e erros

O telefone pode ser cadastrado com ou sem `+55`; o sistema aceita número brasileiro com DDD e normaliza antes do envio. Sem um telefone válido, o usuário vê `Número de Telefone incorreto`. Se a Z-API identificar que o destinatário é inválido, o mesmo aviso é exibido.

Cada PDF é enviado como documento com a mensagem de apresentação no próprio envio. O link temporário do PDF é criado pelo armazenamento público do Base44 apenas para a entrega pela Z-API.

# Conect Services

Plataforma de marketplace de serviços inicialmente direcionada para Angola.
O backend será a fonte das regras de negócio, consumido pela aplicação Web e,
posteriormente, pelas aplicações Android e iOS através da mesma API.

## Arquitetura inicial

- Monólito modular Django com Django REST Framework.
- API REST versionada em `/api/v1/`.
- SQLite para desenvolvimento local e PostgreSQL para produção.
- Redis está disponível no Compose e armazena o cache partilhado usado por
  rate limiting; Celery será integrado quando existirem tarefas assíncronas.
- Next.js e React Native serão clientes da API, sem lógica de negócio duplicada.

## Requisitos

- Python 3.14 (usado na imagem Docker) ou uma versão compatível com as
  dependências de `requirements.txt`.
- PostgreSQL e Redis em produção.

## Desenvolvimento local

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py check
python manage.py migrate
```

Para carregar categorias, prestadores e serviços de demonstração apenas no
ambiente local:

```powershell
python manage.py seed_catalog_demo
```

O comando recusa execução com `DEBUG=False`. As contas criadas são apenas para
desenvolvimento; não disponibilize esses dados nem as credenciais de demonstração
em ambientes acessíveis ao público.

O ficheiro `.env.example` é uma referência; as variáveis de ambiente não são
carregadas automaticamente pelo Django. Configure-as no terminal, no ambiente
de execução ou pelo Docker Compose.

O modelo de utilizador personalizado já está definido como `AUTH_USER_MODEL`;
por isso, a migração inicial já pode ser aplicada.

## Aplicação Web

A primeira versão Web usa Next.js e TypeScript e consome a API Django. Com o
backend em execução em `http://localhost:8000`, inicia o frontend noutro
terminal:

```powershell
Set-Location .\web
Copy-Item .env.example .env.local
npm install
npm run dev
```

A aplicação fica disponível em `http://localhost:3000`. Configura
`NEXT_PUBLIC_API_BASE_URL` em `web/.env.local` se a API estiver noutro endereço.
O MVP Web permite pesquisar prestadores verificados, filtrar por categoria e
município, ordenar resultados e consultar os serviços publicados. O registo e
login usam os endpoints `/api/v1/auth/` do backend. A sessão Web guarda os
tokens JWT em cookies HttpOnly através de rotas servidoras do Next.js; não
exponha esses tokens ao JavaScript do navegador. A API permite criar a conta
básica e, depois de entrar, consultar a área pessoal. A criação de perfil de
cliente ou prestador está disponível em `/perfil`: o perfil pessoal e o perfil
profissional podem ser criados separadamente e atualizados depois.
Clientes autenticados podem criar pedidos de serviço em `/pedidos/novo` e
acompanhar os estados dos próprios pedidos em `/pedidos`. Os tokens continuam
guardados em cookies HttpOnly e as operações autenticadas passam pelo servidor
Next.js. Prestadores verificados podem consultar oportunidades em
`/prestador/pedidos` e enviar propostas; os clientes podem comparar, aceitar
ou rejeitar propostas na lista dos seus pedidos. A aceitação cria a contratação
na API e exige que o pedido tenha duração definida. A página `/contratacoes`
permite consultar horários disponíveis em Africa/Luanda, marcar e confirmar o
horário, acompanhar a execução e confirmar a conclusão.

Opcionalmente, define `API_BASE_URL` em `web/.env.local` para especificar o
endereço da API apenas no servidor. Caso contrário, as rotas servidoras também
usam `NEXT_PUBLIC_API_BASE_URL`.

Para validar o frontend:

```powershell
Set-Location .\web
npm run lint
npm run build
```

## Configuração

`config/settings/base.py` contém as opções comuns.
`config/settings/development.py` é usado por omissão em desenvolvimento local.
`config/settings/production.py` exige segredo, hosts permitidos e PostgreSQL,
além de Redis para o cache partilhado e proteções HTTPS.

Selecione o ambiente com `DJANGO_SETTINGS_MODULE`. Em produção, use
`config.settings.production` e configure os segredos fora do código-fonte.
HSTS para subdomínios e preload só devem ser ativados explicitamente depois de
confirmar que todo o domínio é servido por HTTPS.

### Verificação de prestadores e armazenamento privado

Na página `/perfil`, um prestador pode enviar comprovativos em PDF, JPEG ou PNG
com até 10 MB e submeter a candidatura para revisão. O estado e o feedback da
revisão são visíveis ao próprio prestador. Apenas administradores autorizados
podem transferir os ficheiros pelo Django Admin; a API não devolve URLs dos
documentos e estes não são servidos por `MEDIA_URL`.

Em desenvolvimento, os documentos ficam em `private_uploads/`, separados dos
ficheiros públicos. Em produção, configure no ambiente do backend
`AWS_STORAGE_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e
`AWS_S3_REGION_NAME`. `AWS_S3_ENDPOINT_URL` é opcional para serviços compatíveis
com S3. O bucket e os objetos devem permanecer privados; o Django usa URLs
assinadas com validade de cinco minutos quando o storage precisar de gerar uma
URL. O download administrativo é autenticado e transmitido pelo backend. Não
coloque credenciais no repositório nem exponha o prefixo
`private-verification` através de um servidor público de ficheiros.

## Docker Compose

O Compose inicia o backend, PostgreSQL e Redis para desenvolvimento:

```powershell
docker compose up --build
```

O backend fica disponível em `http://localhost:8000`. Não há migrações
automáticas no arranque; aplique-as manualmente após iniciar os serviços:

```powershell
docker compose exec backend python manage.py migrate
```

## API

- Prefixo: `/api/v1/`
- Esquema OpenAPI: `/api/v1/schema/`
- Interface Swagger: `/api/v1/docs/`
- Paginação DRF configurada para 20 resultados por página.

Perfil e prestador:

- `POST /api/v1/profiles/` cria o perfil da conta autenticada.
- `GET/PATCH /api/v1/profiles/me/` consulta ou atualiza o próprio perfil.
- `POST /api/v1/providers/` inicia um perfil de prestador.
- `GET/PATCH /api/v1/providers/me/` consulta ou atualiza os próprios dados
  comerciais.

Cada conta pode ter no máximo um perfil pessoal e um perfil de prestador. Um
prestador novo inicia como pendente; o estado e a data de verificação são
somente de leitura na API e podem ser alterados por um administrador
autorizado. Fotos de perfil aceitam JPEG, PNG e WebP, até 5 MB e 20 megapíxeis,
com nomes de ficheiro aleatórios.
Os endpoints `/me/` devolvem `404` enquanto o perfil correspondente ainda não
foi criado; tentativas de criar um segundo registo devolvem `409`.

Categorias e serviços:

- `GET /api/v1/categories/` pesquisa categorias ativas; administradores podem
  consultar e gerir categorias através dos métodos de escrita da mesma rota.
- `GET /api/v1/categories/{id}/` consulta uma categoria.
- `GET /api/v1/services/` lista serviços publicados, com filtros `search`,
  `category` e `provider`.
- `POST /api/v1/services/` cria um rascunho associado ao prestador autenticado.
- `GET/PATCH/DELETE /api/v1/services/{id}/` consulta, atualiza ou desativa um
  serviço próprio.
- `GET /api/v1/services/mine/` lista os serviços do prestador autenticado,
  incluindo rascunhos.

Categorias são geridas por administradores; a desativação preserva o registo e
é auditada. Categorias hierárquicas não permitem ciclos nem desativação de um
pai com subcategorias ativas. Prestadores podem guardar rascunhos enquanto
pendentes, mas só prestadores verificados podem publicar. Preços são validados
conforme o tipo escolhido e armazenados em AOA; constraints da base de dados
protegem a coerência entre valores e tipo de preço.

Localizações:

- `GET /api/v1/provinces/` lista províncias ativas.
- `GET /api/v1/municipalities/?province={id}` lista municípios ativos por
  província; ambos os catálogos são geridos por administradores e as
  desativações ficam auditadas.
- `GET/POST /api/v1/locations/` lista ou guarda endereços da conta autenticada.
- `GET/PATCH/DELETE /api/v1/locations/{id}/` consulta, altera ou arquiva apenas
  uma localização própria.
- `GET /api/v1/provider-coverage/` lista áreas públicas de prestadores
  verificados, com filtros `province` e `municipality`.
- `POST/PATCH/DELETE /api/v1/provider-coverage/{id}/` permite ao prestador
  gerir as próprias áreas; `GET /api/v1/provider-coverage/mine/` inclui as
  áreas privadas do próprio.

Endereços guardados não são públicos. Latitude e longitude são opcionais, mas
têm de ser fornecidas em conjunto e dentro dos limites geográficos. As áreas
de atendimento são inicialmente definidas por município, com raio opcional;
coordenadas e pesquisa geográfica avançada ficam para uma fase posterior. A
lista de províncias e municípios deve ser carregada a partir de uma fonte
administrativa angolana confirmada; não foi incluída uma lista estática não
verificada.

Pedidos, propostas e contratações:

- `POST /api/v1/orders/` cria um pedido com a conta autenticada como cliente.
  `requested_duration_minutes` é opcional e aceita 1 a 1.440 minutos; torna-se
  necessário se a proposta aceite não tiver serviço com duração definida.
- `GET /api/v1/orders/` e `GET /api/v1/orders/{id}/` mostram apenas pedidos do
  próprio cliente, incluindo a morada detalhada.
- `GET /api/v1/orders/opportunities/` lista pedidos elegíveis para prestadores
  verificados. A resposta não inclui morada, coordenadas nem dados do cliente;
  se o prestador definir áreas de atendimento, os resultados são filtrados por
  município.
- `POST /api/v1/orders/{id}/cancel/` permite ao cliente cancelar pedidos ainda
  abertos ou em negociação.
- `POST /api/v1/proposals/` envia uma proposta como prestador verificado;
  `GET /api/v1/proposals/` mostra propostas próprias ou recebidas nos pedidos
  do cliente autenticado.
- `POST /api/v1/proposals/{id}/accept/` aceita uma proposta pendente e cria a
  contratação de forma atómica, rejeitando as restantes propostas pendentes
  do mesmo pedido.
- `POST /api/v1/proposals/{id}/reject/` permite ao cliente rejeitar uma
  proposta; `POST /api/v1/proposals/{id}/cancel/` permite ao prestador cancelar
  a própria proposta pendente.
- `GET /api/v1/bookings/` lista contratações das quais a conta é participante.
- `POST /api/v1/bookings/{id}/confirm/` confirma o agendamento pelo cliente;
  `POST /api/v1/bookings/{id}/start/` inicia pelo prestador; `POST
  /api/v1/bookings/{id}/complete/` confirma a conclusão pelo cliente.
- `POST /api/v1/bookings/{id}/cancel/` permite a um dos participantes cancelar
  antes de o serviço começar.
- `GET /api/v1/reviews/?provider_id={id}` consulta publicamente as avaliações
  de um prestador; `GET /api/v1/reviews/` lista avaliações públicas.
- `GET /api/v1/reviews/summary/?provider_id={id}` devolve a classificação média
  e a quantidade de avaliações públicas desse prestador.
- `POST /api/v1/reviews/` permite ao cliente avaliar uma contratação concluída,
  com classificação de 1 a 5 e comentário opcional até 2.000 caracteres. Cada
  contratação só pode ser avaliada uma vez; a resposta pública não identifica
  o cliente. Os dados da contratação e do prestador são determinados pelo
  servidor.
- `GET /api/v1/payments/` lista registos de pagamento das contratações em que
  a conta autenticada participa; `POST /api/v1/payments/` regista uma tentativa
  de pagamento externo integral pelo cliente da contratação. Os métodos
  aceites são `BANK_TRANSFER`, `CASH`, `MULTICAIXA`, `MOBILE_MONEY` e `OTHER`;
  estes identificam o meio usado fora da plataforma, não uma integração.
- Os pagamentos externos ficam pendentes até um administrador os confirmar ou
  rejeitar no Django Admin. Uma tentativa rejeitada pode ser substituída; uma
  contratação só pode ter um pagamento pendente ou confirmado. Valor e moeda
  são obtidos da contratação, e pagamentos não podem ser registados para
  contratações canceladas.
- `GET /api/v1/dashboard/` devolve os indicadores privados da conta autenticada:
  atividade do cliente e, se existir, atividade do seu perfil de prestador.
  O resumo do prestador inclui serviços ativos/inativos, propostas, contratações,
  média de avaliações, valor de contratações concluídas e pagamentos confirmados.
  Contas da equipa (`is_staff`) recebem também contagens agregadas da plataforma;
  não são incluídos dados pessoais nem detalhes dos pedidos.
- `GET /api/v1/providers/discover/` lista prestadores verificados com pelo
  menos um serviço ativo numa categoria ativa. Aceita pesquisa por nome,
  descrição ou serviço (`search`), categoria (`category`), município de
  atendimento (`municipality`) e ordenação (`ordering=name`, `-name`, `rating`,
  `-rating`, `services` ou `-services`). Os resultados são paginados e incluem
  contagem de serviços ativos e resumo agregado de avaliações; não expõem
  contactos nem dados da conta do prestador.
- `GET/POST /api/v1/favorites/providers/` e
  `GET/POST /api/v1/favorites/services/` gerem listas privadas de favoritos;
  `DELETE /api/v1/favorites/providers/{id}/` e
  `DELETE /api/v1/favorites/services/{id}/` removem o favorito da própria conta.
  A criação recebe `provider` ou `service`; favoritos repetidos são idempotentes
  e devolvem `200`. Só se podem adicionar perfis e serviços atualmente públicos
  e disponíveis; não se pode favoritar o próprio perfil/serviço nem alterar o
  proprietário do favorito.
- `POST /api/v1/conversations/` abre ou recupera a conversa privada de uma
  proposta. `GET /api/v1/conversations/` lista as conversas da conta e
  `GET/POST /api/v1/conversations/{id}/messages/` consulta o histórico ou envia
  uma mensagem (máximo de 5.000 caracteres). Só o cliente do pedido e o
  prestador da proposta participam; mensagens deixam de ser aceites depois de
  a proposta ser rejeitada/cancelada ou o pedido cancelado. O histórico mantém-se.
- `GET /api/v1/notifications/` lista notificações internas da conta;
  `GET /api/v1/notifications/unread_count/` consulta o total não lido;
  `POST /api/v1/notifications/{id}/read/` marca uma notificação como lida e
  `POST /api/v1/notifications/read_all/` marca todas as notificações próprias.
  Cada mensagem recebida gera uma notificação visível apenas ao destinatário e
  um email ao endereço registado na conta. A entrega ocorre depois da transação
  da mensagem, tem estado de envio auditável e pode ser repetida por um
  administrador no Django Admin. Em desenvolvimento, os emails aparecem na
  consola; em produção, configura `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`,
  `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` ou `EMAIL_USE_SSL` e
  `DEFAULT_FROM_EMAIL`. `WEB_APP_URL` é opcional e adiciona um link base no
  email. Email pode ser desativado com `EMAIL_NOTIFICATIONS_ENABLED=false`;
  notificações push ainda não estão disponíveis.
- `GET/POST /api/v1/availability/`, `PATCH /api/v1/availability/{id}/` e
  `DELETE /api/v1/availability/{id}/` permitem ao prestador gerir os seus
  horários semanais, usando dias de segunda-feira (`0`) a domingo (`6`) e horas
  locais de Luanda. Os intervalos do mesmo dia não podem sobrepor-se.
- Depois de uma proposta ser aceite, o cliente consulta
  `GET /api/v1/bookings/{id}/available-slots/?date=AAAA-MM-DD` e escolhe um
  horário com `POST /api/v1/bookings/{id}/schedule/`, enviando `scheduled_at`
  com fuso horário. As opções são calculadas pela duração do serviço da
  proposta (de 1 a 1.440 minutos); se não existir ou não tiver duração,
  usa-se `requested_duration_minutes` indicado no pedido. Sem uma duração
  disponível, a proposta não pode ser aceite. A seleção verifica conflitos e
  reserva o horário numa transação.
  O cliente confirma depois a contratação com `/confirm/`.

Os pedidos preservam um snapshot do nome do município, província e morada
informados. Propostas são únicas por pedido/prestador. A aceitação bloqueia o
pedido numa transação e só cria uma contratação por pedido; preço, prestador e
serviço da contratação são copiados da proposta aceite. Valores monetários são
persistidos em AOA.

O registo de pagamentos não movimenta fundos nem confirma automaticamente um
pagamento: o cliente informa o meio e, opcionalmente, uma referência externa;
um administrador verifica a operação fora da plataforma e confirma ou rejeita
o registo. Não há gateway integrado nesta fase.

O envio de email usa o backend configurado do Django. Em produção, a aplicação
exige configuração SMTP e regista falhas sem descartar a mensagem ou a
notificação interna; emails falhados ou interrompidos podem ser repetidos no
admin, após corrigir a configuração.

Autenticação inicial:

- `POST /api/v1/auth/register/`
- `POST /api/v1/auth/token/`
- `POST /api/v1/auth/token/refresh/`
- `GET/PATCH /api/v1/auth/me/`
- `POST /api/v1/auth/logout/`

O login fornece JWT com access token de 15 minutos e refresh token de 7 dias.
Os refresh tokens são rotacionados e revogados no logout. O limite inicial é
de 5 tentativas de login por minuto e 5 registos por hora. Respostas de registo
e falha de login evitam revelar se um e-mail já possui conta.

Os restantes endpoints de domínio serão adicionados incrementalmente, após
definição e testes das regras de autenticação, autorização e validação.

## Próximas fases

1. Notificações push para dispositivos móveis.
2. Integração com provedor de pagamentos, após definição do provedor e do fluxo
   de processamento de fundos.

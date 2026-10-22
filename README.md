# Conect Services

Plataforma de marketplace de serviços inicialmente direcionada para Angola.
O backend é a fonte das regras de negócio, consumido pelas aplicações Web e
Mobile através da mesma API.

## Arquitetura inicial

- Monólito modular Django com Django REST Framework.
- API REST versionada em `/api/v1/`.
- SQLite para desenvolvimento local e PostgreSQL para produção.
- Redis armazena o cache partilhado e serve de broker Celery para notificações
  e emails processados em segundo plano.
- Next.js e React Native são clientes da API, sem lógica de negócio duplicada.

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

Noutro terminal, mantenha a API ativa enquanto utiliza a aplicacao Web:

```powershell
python manage.py runserver 127.0.0.1:8000
```

## Painel administrativo

Crie uma conta de superutilizador no terminal do backend:

```powershell
python manage.py createsuperuser
```

Depois, aceda a `http://localhost:8000/admin/` e entre com o email e a senha
definidos. O Django Admin exige uma conta com permissões administrativas.

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

## Aplicação Mobile

A app Mobile usa React Native, Expo Router e TypeScript. Permite pesquisar
prestadores públicos, criar conta, iniciar sessão, publicar e acompanhar os
próprios pedidos e terminar sessão. Os pedidos usam os endpoints
existentes em `/api/v1/`; tokens de acesso e renovação ficam no armazenamento
seguro do dispositivo, e os tokens de renovação são rotacionados pela API.

```powershell
Set-Location .\mobile
Copy-Item .env.example .env.local
npm install
npm run start
```

Configura `EXPO_PUBLIC_API_BASE_URL` em `mobile/.env.local`. No Android
Emulator, usa normalmente `http://10.0.2.2:8000/api/v1`; num telemóvel físico,
usa o endereço IP local do computador e permite a ligação na rede. A API tem
de ouvir em `0.0.0.0:8000`, e o endereço usado pelo dispositivo deve estar em
`DJANGO_ALLOWED_HOSTS`. Para desenvolvimento local fora do Docker, por exemplo:

```powershell
$env:DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1,10.0.2.2"
python manage.py runserver 0.0.0.0:8000
```

Ao usar Docker Compose, define `DJANGO_ALLOWED_HOSTS` no ambiente antes de
iniciar os serviços. Para abrir a app, usa Expo Go ou um emulador Android;
compilar para iOS requer macOS com Xcode ou um serviço de build remoto.

As notificações push são registadas na API quando o utilizador as ativa em
**A minha conta**. Para emitir notificações, define
`PUSH_NOTIFICATIONS_ENABLED=true` no backend. A app precisa de
`EXPO_PUBLIC_EAS_PROJECT_ID` e de uma development build com credenciais
Android/iOS; o Expo Go não suporta notificações push remotas desde o SDK 53.
O texto da mensagem privada nunca é incluído no aviso visível.

As contas criadas pela aplicação não podem iniciar sessão até à confirmação do email.
O email inclui uma ligação válida por 24 horas; se expirar, a página permite
pedir uma nova ligação. A recuperação de palavra-passe usa um token de uso
único e uma ligação enviada para o email registado. Em produção, configura
`WEB_APP_URL` com o endereço HTTPS da aplicação Web.

O serviço `worker` do Docker Compose processa notificações e emails pela fila
Celery/Redis. Em instalações fora do Compose, inicia um worker com
`celery -A config worker --loglevel=info` junto do backend. Se o broker estiver
indisponível, notificações internas continuam guardadas; os emails com falha
podem ser reenviados pelo Django Admin.

Valida os tipos com `npm run check:types` dentro da pasta `mobile`.

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

As mudanças administrativas do estado de verificação ficam registadas numa
trilha de auditoria de leitura no Django Admin, com o responsável, o estado
anterior e novo, a data e o feedback associado.

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

O backend do Compose usa `runserver` apenas para desenvolvimento. A imagem
`Dockerfile` usa Gunicorn para servir a aplicação WSGI; configura
`DJANGO_SETTINGS_MODULE=config.settings.production` e as variáveis de produção
ao executar a imagem fora do Compose de desenvolvimento.

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

Empresas:

- `POST /api/v1/businesses/` cria um perfil empresarial ligado ao perfil de
  prestador da conta autenticada, ou completa um perfil de prestador existente.
- `GET/PATCH /api/v1/businesses/me/` consulta ou actualiza os dados da empresa
  pertencente à conta autenticada.
- Uma conta pode ter um único perfil empresarial. O nome legal, endereço,
  website, horário e logótipo são opcionais; a informação legal não é exigida
  para criar o perfil.

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
  `POST /api/v1/push-tokens/` regista ou atualiza o token Expo do dispositivo;
  `POST /api/v1/push-tokens/deactivate/` desativa o token da própria conta.
  Cada mensagem recebida gera uma notificação visível apenas ao destinatário e
  um email ao endereço registado na conta. A entrega ocorre depois da transação
  da mensagem, tem estado de envio auditável e pode ser repetida por um
  administrador no Django Admin. Com `PUSH_NOTIFICATIONS_ENABLED=true`, também
  envia um aviso push genérico aos dispositivos ativos da conta. Em desenvolvimento, os emails aparecem na
  consola; em produção, configura `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`,
  `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` ou `EMAIL_USE_SSL` e
  `DEFAULT_FROM_EMAIL`. `WEB_APP_URL` é opcional e adiciona um link base no
  email. `EMAIL_NOTIFICATIONS_ENABLED=false` desativa emails de mensagens, mas
  emails de confirmação de conta e recuperação continuam ativos.
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
- `POST /api/v1/auth/verify-email/`
- `POST /api/v1/auth/verify-email/resend/`
- `POST /api/v1/auth/password-reset/`
- `POST /api/v1/auth/password-reset/confirm/`
- `POST /api/v1/auth/token/`
- `POST /api/v1/auth/token/refresh/`
- `GET/PATCH /api/v1/auth/me/`
- `POST /api/v1/auth/logout/`

O login fornece JWT com access token de 15 minutos e refresh token de 7 dias.
Os refresh tokens são rotacionados e revogados no logout. O limite inicial é
de 5 tentativas de login por minuto e 5 registos por hora. Respostas de registo
e falha de login evitam revelar se um e-mail já possui conta. Novas contas só
podem iniciar sessão depois da confirmação do email; contas existentes ficam
confirmadas por omissão na migração. A confirmação expira após 24 horas e pode
ser reenviada sem revelar se a conta existe. A recuperação também responde de
forma genérica e revoga os refresh tokens emitidos quando a palavra-passe muda.

Os endpoints de domínio descritos acima estão disponíveis incrementalmente,
com as regras de autenticação, autorização e validação implementadas no backend.

## Próximas fases

1. Validar notificações push em development builds Android/iOS e configurar as
   credenciais do Expo para cada plataforma.
2. Integração com provedor de pagamentos, após definição do provedor e do fluxo
   de processamento de fundos.

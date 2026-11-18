# Guia da API

## Base e contrato

A API HTTP está versionada sob `/api/v1/`. Em desenvolvimento local, o backend
usa normalmente `http://localhost:8000`; a Web encaminha os pedidos pelo proxy
do Vite. O Mobile deve configurar a URL base para incluir `/api/v1`.

O schema OpenAPI e a interface Swagger são servidos por:

- `GET /api/v1/schema/`
- `GET /api/v1/docs/`

Em desenvolvimento, estes recursos estão disponíveis para facilitar o
trabalho local. Fora de `DEBUG`, exigem um utilizador administrador. O schema
gerado pelo projecto é a referência para parâmetros, formatos de payload e
respostas de cada operação. A [referência detalhada dos endpoints](api-reference.md)
lista métodos, acessos, parâmetros e schemas de pedido/resposta.
Os [exemplos dos fluxos principais](api-examples.md) mostram pedidos e
respostas representativas para autenticação, contratação e encomendas.

## Autenticação

### Web: sessão e CSRF

O browser não guarda JWTs. A autenticação usa uma sessão Django em cookie
HttpOnly:

1. `GET /api/v1/auth/web/csrf/` inicia a sessão CSRF e prepara o cookie.
2. `POST /api/v1/auth/web/session/` recebe `email` e `password`; enviar o
   token CSRF no cabeçalho `X-CSRFToken`.
3. Enviar o cookie da sessão nas chamadas autenticadas seguintes. As operações
   de escrita também têm de enviar `X-CSRFToken`.
4. `POST /api/v1/auth/web/session/logout/` termina a sessão e também exige
   CSRF.

As chamadas Web devem ser feitas à mesma origem do frontend para que o browser
possa aplicar as protecções dos cookies.

### Mobile e outros clientes: JWT

- `POST /api/v1/auth/token/` autentica com email e palavra-passe e devolve
  tokens de acesso e renovação.
- `POST /api/v1/auth/token/refresh/` renova o acesso. A renovação roda os
  refresh tokens; guardar o novo token recebido e deixar de usar o anterior.
- `POST /api/v1/auth/logout/` recebe o refresh token do utilizador autenticado
  para o revogar.

O tempo de vida configurado é de 15 minutos para o access token e 7 dias para
o refresh token. Os clientes Mobile devem guardar tokens em armazenamento
seguro do dispositivo, nunca em código ou logs.
Nas chamadas autenticadas, envia o cabeçalho HTTP de autorização com o esquema
`Bearer` seguido do access token.

## Endpoints por domínio

Os endpoints abaixo mostram as raízes e operações dedicadas mais importantes.
Os routers REST podem expor detalhes, acções e métodos adicionais: consulta o
schema OpenAPI para confirmar o contrato exacto.

| Prefixo | Uso |
|---|---|
| `/auth/` | Registo, confirmação e reenvio de email, recuperação de palavra-passe, login JWT, sessão Web, conta actual e logout. |
| `/providers/` | Descoberta e detalhe público de prestadores; perfil profissional actual; documentos de verificação e submissão para análise. |
| `/businesses/` | Criação e consulta/actualização do perfil empresarial actual. |
| `/profiles/` | Criação e consulta/actualização do perfil pessoal. |
| `/categories/` | Catálogo de categorias. |
| `/services/` | Publicação, consulta e gestão de serviços. |
| `/provinces/`, `/municipalities/` | Divisões administrativas usadas na pesquisa. |
| `/locations/`, `/provider-coverage/` | Localização do utilizador e áreas de cobertura profissional. |
| `/orders/` | Pedidos de serviço criados por clientes. |
| `/proposals/` | Propostas submetidas por prestadores para pedidos elegíveis. |
| `/bookings/` | Contratações e acompanhamento do serviço aceite. |
| `/availability/` | Disponibilidade semanal dos prestadores. |
| `/reviews/` | Avaliações permitidas pelas regras do domínio. |
| `/products/`, `/product-orders/` | Catálogo de produtos e encomendas. |
| `/favorites/providers/`, `/favorites/services/` | Favoritos do utilizador autenticado. |
| `/conversations/`, `/notifications/`, `/push-tokens/` | Mensagens, notificações e registo de dispositivos push. |
| `/payments/` | Registos e operações de pagamento suportadas. |
| `/dashboard/` | Painel do utilizador autenticado. |
| `/dashboard/analytics/` | Análise do desempenho do profissional autenticado. |
| `/dashboard/admin/` | Indicadores administrativos; requer privilégios de administrador. |
| `/dashboard/analytics/views/` | Registo público limitado de visualização de uma publicação elegível. |

Os prefixos da tabela são relativos a `/api/v1/`; por exemplo, a descoberta de
prestadores é `GET /api/v1/providers/discover/`.

## Respostas e paginação

- Listas paginadas usam o formato do Django REST Framework: `count`,
  `next`, `previous` e `results`.
- O tamanho de página predefinido é 20. Endpoints podem aplicar filtros,
  ordenação e validações próprias, descritos no OpenAPI.
- `400` indica dados ou parâmetros inválidos; `401` falta autenticação válida;
  `403` falta permissão ou falha da protecção CSRF; `404` recurso não
  encontrado; `409` conflito de domínio; `429` limite de pedidos atingido.
- Erros de validação podem devolver detalhes por campo; não assumir que todos
  os erros têm apenas a propriedade `detail`.
- O comportamento de uma operação depende também do estado do recurso e das
  permissões do utilizador, não apenas do método HTTP.

## Limites de pedidos

Os limites predefinidos da aplicação são 60 pedidos por minuto para clientes
anónimos e 120 por minuto para clientes autenticados. Login: 5 por minuto;
registo: 5 por hora; recuperação de acesso: 5 por hora; registo de
visualizações: 30 por minuto. Os limites usam o cache configurado. Em
produção, Redis deve ser partilhado pelos processos da API. O proxy ou
fornecedor de alojamento deve fornecer protecção adicional contra abuso e
DDoS.

## Exemplos

### Pesquisar prestadores verificados

```http
GET /api/v1/providers/discover/?search=canalização&municipality=1&ordering=-rating&page=1
Accept: application/json
```

### Consultar a conta autenticada

```http
GET /api/v1/auth/me/
Accept: application/json
```

Para a Web, usa a sessão HttpOnly e envia o token CSRF em vez do cabeçalho
Bearer.

## Alterações incompatíveis

As regras e representações públicas pertencem ao backend. Ao alterar campos,
estados ou permissões, actualizar o schema, os testes relevantes, a
documentação deste guia e os consumidores Web/Mobile afectados. Mudanças que
quebrem clientes devem ser introduzidas numa nova versão da API, não como
alterações silenciosas ao contrato existente.

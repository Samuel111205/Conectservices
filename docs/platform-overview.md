# Visão geral da plataforma

## Objectivo

A Conect Services é um marketplace que aproxima clientes de prestadores de
serviços, empresas e empreendedores em Angola. Os clientes podem descobrir
perfis verificados, comparar serviços e avaliações e iniciar uma contratação.
Os prestadores podem publicar serviços, responder a pedidos e gerir o trabalho
aceite. As empresas podem também apresentar produtos.

## Aplicações

- **Web:** aplicação React e Vite. Serve as páginas públicas do marketplace,
  as áreas de cliente, prestador e empresa e o painel de administração React.
- **Mobile:** aplicação React Native com Expo Router e TypeScript.
- **Backend:** monólito modular Django e Django REST Framework. É a fonte
  autoritativa das regras de negócio, permissões e dados; Web e Mobile usam a
  mesma API versionada em `/api/v1/`.
- **Serviços de apoio:** PostgreSQL é a base de dados de produção; Redis
  partilha cache e serve de broker para Celery; o worker processa notificações
  e emails em segundo plano.

## Módulos de negócio

| Módulo | Responsabilidade |
|---|---|
| `accounts` | Contas, confirmação de email, autenticação, sessões e recuperação de acesso. |
| `profiles` | Perfil pessoal do utilizador. |
| `providers` | Perfil profissional, verificação, documentos privados e descoberta pública. |
| `businesses` | Dados do perfil empresarial e classificação como empresa ou empreendedor. |
| `catalog` | Categorias e serviços publicados. |
| `locations` | Províncias, municípios, localização e áreas de cobertura dos prestadores. |
| `orders`, `proposals`, `bookings` | Pedidos de serviço, propostas dos prestadores e contratações. |
| `availability` | Disponibilidade semanal para marcação. |
| `reviews` | Avaliações associadas a serviços concluídos ou encomendas elegíveis. |
| `commerce` | Produtos, stock e encomendas de produtos. |
| `messaging`, `favorites` | Conversas, notificações, dispositivos push e favoritos. |
| `payments` | Registos e operações de pagamento associados ao fluxo suportado. |
| `dashboard` | Painéis, métricas e registo agregado de visualizações. |

Os módulos são aplicações Django separadas no mesmo backend, não serviços
independentes. A divisão organiza o domínio e permite que as operações que
envolvem vários módulos mantenham as regras e transacções no backend.

## Fluxos principais

### Descoberta e contratação de serviços

1. Um cliente pesquisa prestadores verificados e serviços activos, usando
   categoria e município quando necessário.
2. O cliente cria um pedido de serviço.
3. Prestadores elegíveis consultam pedidos e enviam propostas.
4. O cliente aceita uma proposta; a API cria a contratação correspondente.
5. A contratação pode ser agendada com base na disponibilidade, acompanhada
   até à conclusão e avaliada segundo as regras do domínio.

### Produtos

Empresas e outros prestadores elegíveis publicam produtos com preço, categoria
e stock. Clientes consultam o catálogo e criam encomendas de produtos. Este
fluxo é separado dos pedidos de serviços e das respectivas contratações.

### Pagamentos no MVP

O fluxo actual regista a declaração de pagamento do cliente para uma
contratação de serviço. O valor e a moeda vêm da contratação; o registo fica
pendente até um administrador o confirmar ou rejeitar. A plataforma não
processa fundos nem confirma transacções junto de bancos ou operadores. A
confirmação administrativa fica registada num histórico imutável. Encomendas
de produtos ainda não estão ligadas a pagamentos. Reembolsos e disputas entre
as partes exigem um processo operacional definido antes de aceitar pagamentos
reais pela plataforma.

### Confiança e verificação

O perfil profissional tem um estado de verificação. A verificação é analisada
administrativamente; um utilizador não pode aprovar o próprio perfil. Os
comprovativos são tratados como documentos privados e não são expostos por
URLs públicas. A descoberta pública filtra contas inactivas e perfis não
verificados. Perfis empresariais podem ser classificados como empresa ou
empreendedor; um perfil sem registo empresarial é apresentado como prestador.

## Dados e segurança

- SQLite é suportado para desenvolvimento local; produção exige PostgreSQL e
  Redis partilhado.
- A aplicação Web usa sessão Django em cookie HttpOnly e protecção CSRF. A
  aplicação Mobile usa JWT, com renovação rotativa e revogação de tokens.
- A API aplica permissões por endpoint, limites de pedidos anónimos e
  autenticados e limites mais estritos para autenticação, recuperação e
  métricas.
- Em produção, usar `config.settings.production`, HTTPS, uma chave secreta
  própria e origens/hosts explicitamente configurados. Os limites da aplicação
  não substituem firewall, WAF ou protecção contra DDoS na infraestrutura.
- O email de confirmação e a recuperação de acesso dependem da configuração de
  email do ambiente. O worker Celery processa tarefas assíncronas.

## Estrutura do repositório

- `apps/`: domínios e API Django.
- `config/`: URLs, ASGI/WSGI, Celery e configurações por ambiente.
- `web/`: aplicação React/Vite.
- `mobile/`: aplicação React Native/Expo.
- `postman/`: colecções, ambientes e materiais de teste da API.
- `docs/`: documentação funcional e técnica.

Para instalação local e execução das aplicações, consulta o
[README](../README.md). Para contratos, autenticação e endpoints da API,
consulta o [guia da API](api.md).

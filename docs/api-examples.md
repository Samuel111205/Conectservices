# Exemplos de utilização da API

Os exemplos usam identificadores fictícios. Substitui-os pelos IDs devolvidos
pelas tuas chamadas. Os corpos de resposta são excertos representativos; os
schemas completos estão na [referência dos endpoints](api-reference.md).
Nas chamadas autenticadas, envia o cabeçalho HTTP de autorização com o esquema
`Bearer` seguido do access token indicado para cada utilizador.

## 1. Criar conta e obter token

O registo responde `202 Accepted`. A conta só pode iniciar sessão depois de
confirmar o email através do token enviado pela plataforma.

```http
POST /api/v1/auth/register/
Content-Type: application/json

{
  "email": "cliente@example.com",
  "phone": "+244900000000",
  "password": "<palavra-passe-segura>"
}
```

```json
{
  "detail": "Pedido recebido. Se os dados forem válidos, enviaremos instruções para confirmar o email."
}
```

Depois de confirmar o endereço de email:

```http
POST /api/v1/auth/token/
Content-Type: application/json

{
  "email": "cliente@example.com",
  "password": "<palavra-passe-segura>"
}
```

Resposta `200 OK`:

```json
{
  "access": "<access-token>",
  "refresh": "<refresh-token>"
}
```

Envia o access token nas chamadas privadas. Quando expirar, usa o refresh
token; guarda o refresh token novo devolvido, pois a renovação é rotativa.

## 2. Pedido de serviço, proposta e contratação

### Criar o pedido como cliente

Categoria e município devem existir e estar activos. O horário pedido, se
indicado, deve estar no futuro. Orçamento mínimo e máximo não podem estar
invertidos. A duração é necessária para agendar a contratação, salvo se o
serviço escolhido na proposta tiver duração definida.

```http
POST /api/v1/orders/
Content-Type: application/json

{
  "category": 3,
  "title": "Reparar uma fuga de água",
  "description": "Fuga de água debaixo do lava-loiça da cozinha.",
  "minimum_budget": "15000.00",
  "maximum_budget": "25000.00",
  "requested_duration_minutes": 120,
  "municipality": 1,
  "neighborhood": "Maianga",
  "address": "Rua de exemplo, casa 10"
}
```

Resposta `201 Created` (excerto):

```json
{
  "id": 42,
  "category": 3,
  "title": "Reparar uma fuga de água",
  "currency": "AOA",
  "municipality": 1,
  "municipality_name": "Luanda",
  "province_name": "Luanda",
  "status": "OPEN"
}
```

### Enviar proposta como prestador

O prestador tem de estar activo e verificado. Só pode enviar uma proposta por
pedido; o pedido tem de continuar aberto ou em negociação.

```http
POST /api/v1/proposals/
Content-Type: application/json

{
  "order_id": 42,
  "service": 8,
  "price": "18000.00",
  "description": "Posso reparar a fuga e testar a canalização no local.",
  "estimated_days": 1
}
```

Resposta `201 Created` (excerto):

```json
{
  "id": 71,
  "order_id": 42,
  "provider_id": 12,
  "provider_name": "Canalizador Exemplo",
  "price": "18000.00",
  "currency": "AOA",
  "status": "PENDING"
}
```

### Aceitar e agendar a proposta

Só o cliente dono do pedido pode aceitá-la. A aceitação cria a contratação,
marca o pedido como contratado e rejeita as outras propostas ainda pendentes.
O endpoint devolve `201 Created` com a representação da contratação.

```http
POST /api/v1/proposals/71/accept/
```

Consulta os horários disponíveis para a data desejada. As datas e horas usam o
fuso `Africa/Luanda`.

```http
GET /api/v1/bookings/55/available-slots/?date=2026-12-10
```

Escolhe um dos valores devolvidos em `slots`:

```http
POST /api/v1/bookings/55/schedule/
Content-Type: application/json

{
  "scheduled_at": "2026-12-10T09:00:00+01:00"
}
```

O cliente confirma o horário; o prestador inicia o serviço; depois da execução,
o cliente confirma a conclusão:

```http
POST /api/v1/bookings/55/confirm/

POST /api/v1/bookings/55/start/

POST /api/v1/bookings/55/complete/
```

Os estados da contratação avançam de `SCHEDULED` para `CONFIRMED`,
`IN_PROGRESS` e `COMPLETED`. Cada acção valida o papel do utilizador e o estado
actual; chamadas fora de ordem são rejeitadas.

## 3. Encomenda de produto

Todos os produtos de uma encomenda têm de pertencer à mesma empresa. A criação
reserva o stock; se a empresa recusar ou uma encomenda pendente for cancelada,
o stock é reposto.

```http
POST /api/v1/product-orders/
Content-Type: application/json

{
  "items": [
    {
      "product_id": 19,
      "quantity": 2
    }
  ],
  "delivery_notes": "Contactar antes da entrega."
}
```

Resposta `201 Created` (excerto):

```json
{
  "id": 91,
  "status": "PENDING",
  "total_amount": "12000.00",
  "currency": "AOA",
  "items": [
    {
      "product_id": 19,
      "product_name": "Candeeiro artesanal",
      "unit_price": "6000.00",
      "quantity": 2,
      "subtotal": "12000.00"
    }
  ]
}
```

A empresa responsável pode aceitar a encomenda e, após combinar entrega e
pagamento directamente com o cliente, marcá-la como concluída:

```http
POST /api/v1/product-orders/91/accept/

POST /api/v1/product-orders/91/complete/
```

O pagamento e a entrega não são processados por estes endpoints. Quando a
encomenda estiver `COMPLETED`, o cliente pode avaliá-la:

```http
POST /api/v1/reviews/
Content-Type: application/json

{
  "product_order_id": 91,
  "rating": 5,
  "comment": "Produto conforme e entrega combinada."
}
```

## 4. Consultar dashboards

```http
GET /api/v1/dashboard/

GET /api/v1/dashboard/analytics/?period=30

GET /api/v1/dashboard/admin/?period=30
```

`period` aceita `7`, `30` ou `90` na análise profissional e no dashboard
administrativo; o valor predefinido é `30`. O dashboard normal agrega os dados
de cliente e, se existir, de prestador. A resposta administrativa contém
contagens, séries diárias, comparação com o período anterior, funil de pedidos
e listas de actividade. A [referência dos endpoints](api-reference.md)
descreve os schemas tipados de cada resposta.

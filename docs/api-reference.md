# Referência dos endpoints da API

Esta referência cobre todas as operações publicadas no schema OpenAPI. Campos, tipos, obrigatoriedade, formatos e permissões são extraídos do contrato; a interface em `/api/v1/docs/` continua a ser a fonte de verdade.

Todos os caminhos incluem `/api/v1`. Parâmetros `path` fazem parte do URL; `query` são enviados após `?`. Os pedidos usam JSON; para campos de ficheiro, usa `multipart/form-data`. Os códigos indicam respostas de sucesso; erros são descritos no [guia da API](api.md).

## Autenticação

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/logout/` | JWT ou sessão | - | `Logout` | `204` - |
| `GET` | `/api/v1/auth/me/` | JWT ou sessão | - | - | `200` Account |
| `PATCH` | `/api/v1/auth/me/` | JWT ou sessão | - | `PatchedAccount` | `200` Account |
| `PUT` | `/api/v1/auth/me/` | JWT ou sessão | - | `Account` | `200` Account |
| `POST` | `/api/v1/auth/password-reset/` | Público | - | `EmailOnly` | `200` RegistrationResponse |
| `POST` | `/api/v1/auth/password-reset/confirm/` | Público | - | `PasswordResetConfirm` | `200` RegistrationResponse |
| `POST` | `/api/v1/auth/register/` | Público | - | `Registration` | `202` RegistrationResponse |
| `POST` | `/api/v1/auth/token/` | Público | - | `VerifiedTokenObtainPair` | `200` TokenPairResponse |
| `POST` | `/api/v1/auth/token/refresh/` | Público | - | `TokenRefresh` | `200` TokenRefresh |
| `POST` | `/api/v1/auth/verify-email/` | Público | - | `TokenBody` | `200` RegistrationResponse |
| `POST` | `/api/v1/auth/verify-email/resend/` | Público | - | `EmailOnly` | `200` RegistrationResponse |
| `GET` | `/api/v1/auth/web/csrf/` | Público | - | - | `200` CsrfToken |
| `POST` | `/api/v1/auth/web/session/` | Público | - | `WebLogin` | `200` RegistrationResponse |
| `POST` | `/api/v1/auth/web/session/logout/` | JWT ou sessão | - | - | `204` - |

## Avaliações

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/reviews/` | Público | `page` (query: integer), `provider_id` (query: integer) | - | `200` PaginatedReviewList |
| `POST` | `/api/v1/reviews/` | JWT ou sessão | - | `Review` | `201` Review |
| `GET` | `/api/v1/reviews/summary/` | Público | `provider_id` (query, obrigatório: integer) | - | `200` ReviewSummaryResponse |

## Categorias

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/categories/` | Público | `page` (query: integer), `parent` (query: string), `search` (query: string) | - | `200` PaginatedCategoryList |
| `POST` | `/api/v1/categories/` | JWT ou sessão | - | `Category` | `201` Category |
| `DELETE` | `/api/v1/categories/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `204` - |
| `GET` | `/api/v1/categories/{id}/` | Público | `id` (path, obrigatório: integer) | - | `200` Category |
| `PATCH` | `/api/v1/categories/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `PatchedCategory` | `200` Category |
| `PUT` | `/api/v1/categories/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `Category` | `200` Category |

## Contratações

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/bookings/` | JWT ou sessão | `page` (query: integer) | - | `200` PaginatedBookingList |
| `GET` | `/api/v1/bookings/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` Booking |
| `GET` | `/api/v1/bookings/{id}/available-slots/` | JWT ou sessão | `date` (query, obrigatório: string/date), `id` (path, obrigatório: integer) | - | `200` AvailableSlotsResponse |
| `POST` | `/api/v1/bookings/{id}/cancel/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` Booking |
| `POST` | `/api/v1/bookings/{id}/complete/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` Booking |
| `POST` | `/api/v1/bookings/{id}/confirm/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` Booking |
| `POST` | `/api/v1/bookings/{id}/schedule/` | JWT ou sessão | `id` (path, obrigatório: integer) | `ScheduleBooking` | `200` Booking |
| `POST` | `/api/v1/bookings/{id}/start/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` Booking |

## Conversas

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/conversations/` | JWT ou sessão | `page` (query: integer) | - | `200` PaginatedConversationList |
| `POST` | `/api/v1/conversations/` | JWT ou sessão | - | `OpenConversation` | `200` Conversation; `201` Conversation |
| `GET` | `/api/v1/conversations/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` Conversation |
| `GET` | `/api/v1/conversations/{id}/messages/` | JWT ou sessão | `id` (path, obrigatório: integer), `page` (query: integer) | - | `200` PaginatedMessageList |
| `POST` | `/api/v1/conversations/{id}/messages/` | JWT ou sessão | `id` (path, obrigatório: integer) | `Message` | `201` Message |

## Disponibilidade

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/availability/` | Público | `page` (query: integer), `provider` (query: integer) | - | `200` PaginatedWeeklyAvailabilityList |
| `POST` | `/api/v1/availability/` | JWT ou sessão | - | `WeeklyAvailability` | `201` WeeklyAvailability |
| `DELETE` | `/api/v1/availability/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `204` - |
| `GET` | `/api/v1/availability/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` WeeklyAvailability |
| `PATCH` | `/api/v1/availability/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `PatchedWeeklyAvailability` | `200` WeeklyAvailability |

## Empresas

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `POST` | `/api/v1/businesses/` | JWT ou sessão | - | `BusinessProfile` | `201` BusinessProfile |
| `GET` | `/api/v1/businesses/me/` | JWT ou sessão | - | - | `200` BusinessProfile |
| `PATCH` | `/api/v1/businesses/me/` | JWT ou sessão | - | `PatchedBusinessProfile` | `200` BusinessProfile |

## Favoritos

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/favorites/providers/` | JWT ou sessão | `page` (query: integer) | - | `200` PaginatedFavoriteProviderList |
| `POST` | `/api/v1/favorites/providers/` | JWT ou sessão | - | `FavoriteProvider` | `201` FavoriteProvider |
| `DELETE` | `/api/v1/favorites/providers/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `204` - |
| `GET` | `/api/v1/favorites/services/` | JWT ou sessão | `page` (query: integer) | - | `200` PaginatedFavoriteServiceList |
| `POST` | `/api/v1/favorites/services/` | JWT ou sessão | - | `FavoriteService` | `201` FavoriteService |
| `DELETE` | `/api/v1/favorites/services/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `204` - |

## Localizações

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/locations/` | JWT ou sessão | `include_inactive` (query: boolean), `page` (query: integer) | - | `200` PaginatedUserLocationList |
| `POST` | `/api/v1/locations/` | JWT ou sessão | - | `UserLocation` | `201` UserLocation |
| `DELETE` | `/api/v1/locations/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `204` - |
| `GET` | `/api/v1/locations/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` UserLocation |
| `PATCH` | `/api/v1/locations/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `PatchedUserLocation` | `200` UserLocation |
| `GET` | `/api/v1/municipalities/` | Público | `page` (query: integer), `province` (query: integer), `search` (query: string) | - | `200` PaginatedMunicipalityList |
| `POST` | `/api/v1/municipalities/` | JWT ou sessão | - | `Municipality` | `201` Municipality |
| `DELETE` | `/api/v1/municipalities/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `204` - |
| `GET` | `/api/v1/municipalities/{id}/` | Público | `id` (path, obrigatório: integer) | - | `200` Municipality |
| `PATCH` | `/api/v1/municipalities/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `PatchedMunicipality` | `200` Municipality |
| `PUT` | `/api/v1/municipalities/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `Municipality` | `200` Municipality |

## Notificações

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/notifications/` | JWT ou sessão | `page` (query: integer) | - | `200` PaginatedNotificationList |
| `POST` | `/api/v1/notifications/read_all/` | JWT ou sessão | - | - | `200` MarkNotificationsRead |
| `GET` | `/api/v1/notifications/unread_count/` | JWT ou sessão | - | - | `200` UnreadNotificationCount |
| `POST` | `/api/v1/notifications/{id}/read/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` Notification |

## Pagamentos

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/payments/` | JWT ou sessão | `page` (query: integer) | - | `200` PaginatedPaymentList |
| `POST` | `/api/v1/payments/` | JWT ou sessão | - | `Payment` | `201` Payment |

## Painéis

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/dashboard/` | JWT ou sessão | - | - | `200` DashboardResponse |
| `GET` | `/api/v1/dashboard/admin/` | JWT ou sessão | `period` (query: integer) | - | `200` AdminDashboardResponse |
| `GET` | `/api/v1/dashboard/analytics/` | JWT ou sessão | `period` (query: integer) | - | `200` ProfessionalAnalyticsResponse |
| `POST` | `/api/v1/dashboard/analytics/views/` | Público | - | `ListingView` | `200` ListingViewResponse; `201` ListingViewResponse |

## Pedidos

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/orders/` | JWT ou sessão | `page` (query: integer) | - | `200` PaginatedServiceOrderList |
| `POST` | `/api/v1/orders/` | JWT ou sessão | - | `ServiceOrder` | `201` ServiceOrder |
| `GET` | `/api/v1/orders/opportunities/` | JWT ou sessão | `category` (query: integer), `municipality` (query: integer), `page` (query: integer), `search` (query: string) | - | `200` PaginatedOrderOpportunityList |
| `GET` | `/api/v1/orders/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` ServiceOrder |
| `POST` | `/api/v1/orders/{id}/cancel/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` OrderStatus |

## Perfis

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `POST` | `/api/v1/profiles/` | JWT ou sessão | - | `Profile` | `201` Profile |
| `GET` | `/api/v1/profiles/me/` | JWT ou sessão | - | - | `200` Profile |
| `PATCH` | `/api/v1/profiles/me/` | JWT ou sessão | - | `PatchedProfile` | `200` Profile |

## Prestadores

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `POST` | `/api/v1/providers/` | JWT ou sessão | - | `Provider` | `201` Provider |
| `GET` | `/api/v1/providers/discover/` | Público | `audience` (query: string), `category` (query: integer), `municipality` (query: integer), `ordering` (query: string), `page` (query: integer), `search` (query: string) | - | `200` PaginatedProviderDiscoveryList |
| `GET` | `/api/v1/providers/me/` | JWT ou sessão | - | - | `200` Provider |
| `PATCH` | `/api/v1/providers/me/` | JWT ou sessão | - | `PatchedProvider` | `200` Provider |
| `POST` | `/api/v1/providers/me/submit-verification/` | JWT ou sessão | - | - | `200` Provider |
| `GET` | `/api/v1/providers/me/verification-documents/` | JWT ou sessão | `page` (query: integer) | - | `200` PaginatedProviderVerificationDocumentList |
| `POST` | `/api/v1/providers/me/verification-documents/` | JWT ou sessão | - | `ProviderVerificationDocument` | `201` ProviderVerificationDocument |
| `DELETE` | `/api/v1/providers/me/verification-documents/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `204` - |
| `GET` | `/api/v1/providers/{id}/` | Público | `id` (path, obrigatório: integer) | - | `200` ProviderDiscovery |

## Product-Orders

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/product-orders/` | JWT ou sessão | `page` (query: integer) | - | `200` PaginatedProductOrderList |
| `POST` | `/api/v1/product-orders/` | JWT ou sessão | - | `ProductOrderCreate` | `201` ProductOrder |
| `GET` | `/api/v1/product-orders/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` ProductOrder |
| `POST` | `/api/v1/product-orders/{id}/accept/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` ProductOrder |
| `POST` | `/api/v1/product-orders/{id}/cancel/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` ProductOrder |
| `POST` | `/api/v1/product-orders/{id}/complete/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` ProductOrder |
| `POST` | `/api/v1/product-orders/{id}/reject/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` ProductOrder |

## Produtos

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/products/` | Público | `category` (query: integer), `page` (query: integer), `search` (query: string) | - | `200` PaginatedProductList |
| `POST` | `/api/v1/products/` | JWT ou sessão | - | `Product` | `201` Product |
| `GET` | `/api/v1/products/mine/` | JWT ou sessão | - | - | `200` Product |
| `DELETE` | `/api/v1/products/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `204` - |
| `GET` | `/api/v1/products/{id}/` | Público | `id` (path, obrigatório: integer) | - | `200` Product |
| `PATCH` | `/api/v1/products/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `PatchedProduct` | `200` Product |
| `PUT` | `/api/v1/products/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `Product` | `200` Product |

## Propostas

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/proposals/` | JWT ou sessão | `page` (query: integer) | - | `200` PaginatedProposalList |
| `POST` | `/api/v1/proposals/` | JWT ou sessão | - | `Proposal` | `201` Proposal |
| `GET` | `/api/v1/proposals/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` Proposal |
| `POST` | `/api/v1/proposals/{id}/accept/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `201` Booking |
| `POST` | `/api/v1/proposals/{id}/cancel/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` Proposal |
| `POST` | `/api/v1/proposals/{id}/reject/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `200` Proposal |

## Provider-Coverage

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/provider-coverage/` | Público | `municipality` (query: integer), `page` (query: integer), `province` (query: integer) | - | `200` PaginatedProviderCoverageList |
| `POST` | `/api/v1/provider-coverage/` | JWT ou sessão | - | `ProviderCoverage` | `201` ProviderCoverage |
| `GET` | `/api/v1/provider-coverage/mine/` | JWT ou sessão | - | - | `200` ProviderCoverage |
| `DELETE` | `/api/v1/provider-coverage/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `204` - |
| `GET` | `/api/v1/provider-coverage/{id}/` | Público | `id` (path, obrigatório: integer) | - | `200` ProviderCoverage |
| `PATCH` | `/api/v1/provider-coverage/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `PatchedProviderCoverage` | `200` ProviderCoverage |

## Províncias

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/provinces/` | Público | `page` (query: integer), `search` (query: string) | - | `200` PaginatedProvinceList |
| `POST` | `/api/v1/provinces/` | JWT ou sessão | - | `Province` | `201` Province |
| `DELETE` | `/api/v1/provinces/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `204` - |
| `GET` | `/api/v1/provinces/{id}/` | Público | `id` (path, obrigatório: integer) | - | `200` Province |
| `PATCH` | `/api/v1/provinces/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `PatchedProvince` | `200` Province |
| `PUT` | `/api/v1/provinces/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `Province` | `200` Province |

## Push-Tokens

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `POST` | `/api/v1/push-tokens/` | JWT ou sessão | - | `PushDeviceToken` | `201` PushDeviceToken |
| `POST` | `/api/v1/push-tokens/deactivate/` | JWT ou sessão | - | `DeactivatePushToken` | `200` DeactivatePushTokenResponse |

## Serviços

| Método | Caminho | Acesso | Parâmetros | Pedido | Respostas de sucesso |
|---|---|---|---|---|---|
| `GET` | `/api/v1/services/` | Público | `category` (query: integer), `page` (query: integer), `provider` (query: integer), `search` (query: string) | - | `200` PaginatedServiceList |
| `POST` | `/api/v1/services/` | JWT ou sessão | - | `Service` | `201` Service |
| `GET` | `/api/v1/services/mine/` | JWT ou sessão | `page` (query: integer) | - | `200` PaginatedServiceList |
| `DELETE` | `/api/v1/services/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | - | `204` - |
| `GET` | `/api/v1/services/{id}/` | Público | `id` (path, obrigatório: integer) | - | `200` Service |
| `PATCH` | `/api/v1/services/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `PatchedService` | `200` Service |
| `PUT` | `/api/v1/services/{id}/` | JWT ou sessão | `id` (path, obrigatório: integer) | `Service` | `200` Service |

## Campos dos contratos

Propriedades geradas pelos serializers. `obrigatório` indica presença requerida; `read-only` e `write-only` indicam o sentido do campo. Em listas paginadas, `results` contém os itens indicados.

- **Account** - `id`: integer, obrigatório, read-only; `email`: string/email, obrigatório, read-only; `phone`: string | null.
- **AdminAnalytics** - `period_days`: integer, obrigatório; `summary`: AdminAnalyticsSummary, obrigatório; `series`: array[AdminAnalyticsSeries], obrigatório; `analysis`: AdminAnalyticsAnalysis, obrigatório.
- **AdminAnalyticsAnalysis** - `method`: string, obrigatório; `rolling_window_days`: integer, obrigatório; `metrics`: object, obrigatório.
- **AdminAnalyticsMetric** - `total`: integer, obrigatório; `daily_average`: number/double, obrigatório; `daily_standard_deviation`: number/double | null, obrigatório; `active_days`: integer, obrigatório; `zero_days`: integer, obrigatório; `trend_per_day`: number/double, obrigatório; `trend_direction`: TrendDirectionEnum, obrigatório; `r_squared`: number/double | null, obrigatório.
- **AdminAnalyticsSeries** - `date`: string/date, obrigatório; `registrations`: integer, obrigatório; `publications`: integer, obrigatório; `service_orders`: integer, obrigatório; `product_orders`: integer, obrigatório; `conversations`: integer, obrigatório; `views`: integer, obrigatório; `registrations_average_7d`: number/double | null, obrigatório; `publications_average_7d`: number/double | null, obrigatório; `service_orders_average_7d`: number/double | null, obrigatório; `product_orders_average_7d`: number/double | null, obrigatório; `conversations_average_7d`: number/double | null, obrigatório; `views_average_7d`: number/double | null, obrigatório.
- **AdminAnalyticsSummary** - `registrations`: integer, obrigatório; `publications`: integer, obrigatório; `service_orders`: integer, obrigatório; `product_orders`: integer, obrigatório; `conversations`: integer, obrigatório; `views`: integer, obrigatório.
- **AdminDashboardResponse** - `summary`: AdminDashboardSummary, obrigatório; `analytics`: AdminAnalytics, obrigatório; `period_comparison`: PeriodComparison, obrigatório; `service_order_funnel`: ServiceOrderFunnel, obrigatório; `user_growth`: array[UserGrowthPoint], obrigatório; `business_growth`: array[BusinessGrowthPoint], obrigatório; `services_by_category`: array[CategoryDistribution], obrigatório; `recent_users`: array[RecentUser], obrigatório; `pending_verifications`: array[PendingVerification], obrigatório; `pending_businesses`: array[PendingBusiness], obrigatório; `inactive_services`: array[InactiveService], obrigatório; `recent_activity`: array[VerificationActivity], obrigatório; `reports_available`: boolean, obrigatório.
- **AdminDashboardSummary** - `users_total`: integer, obrigatório; `businesses_total`: integer, obrigatório; `providers_total`: integer, obrigatório; `services_total`: integer, obrigatório; `products_total`: integer, obrigatório; `publications_total`: integer, obrigatório; `service_orders_total`: integer, obrigatório; `product_orders_total`: integer, obrigatório; `conversations_total`: integer, obrigatório; `views_total`: integer, obrigatório; `new_users_30d`: integer, obrigatório; `verifications_pending`: integer, obrigatório; `business_verifications_pending`: integer, obrigatório; `inactive_services`: integer, obrigatório.
- **AvailableSlotsResponse** - `date`: string/date, obrigatório; `duration_minutes`: integer, obrigatório; `timezone`: string, obrigatório; `slots`: array[string/date-time], obrigatório.
- **Booking** - `id`: integer, obrigatório, read-only; `order_id`: integer, obrigatório, read-only; `proposal_id`: integer, obrigatório, read-only; `is_client`: boolean, obrigatório, read-only; `is_provider`: boolean, obrigatório, read-only; `provider_name`: string, obrigatório, read-only; `service_name`: string, obrigatório, read-only; `final_price`: string/decimal, obrigatório, read-only; `duration_minutes`: integer | null, obrigatório, read-only; `currency`: string, obrigatório, read-only; `scheduled_at`: string/date-time | null, obrigatório, read-only; `status`: BookingStatusEnum, obrigatório, read-only; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only; `completed_at`: string/date-time | null, obrigatório, read-only; `review`: BookingReviewSummary | null, obrigatório, read-only.
- **BookingReviewSummary** - `rating`: integer, obrigatório; `comment`: string, obrigatório; `created_at`: string/date-time, obrigatório.
- **BookingStatusEnum** - string.
- **BusinessGrowthPoint** - `month`: string, obrigatório; `businesses`: integer, obrigatório.
- **BusinessProfile** - `id`: integer, obrigatório, read-only; `business_type`: BusinessTypeEnum; `commercial_name`: string, obrigatório; `description`: string; `business_phone`: string; `business_email`: string/email | string; `verification_status`: string, obrigatório, read-only; `verified_at`: string/date-time, obrigatório, read-only; `registered_name`: string; `logo`: string/uri | null; `website`: string/uri | string; `address`: string; `opening_hours`: object; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **BusinessProfilePublic** - `business_type`: BusinessTypeEnum, obrigatório, read-only; `logo`: string/uri | null, obrigatório, read-only; `website`: string/uri, obrigatório, read-only; `opening_hours`: object, obrigatório, read-only.
- **BusinessTypeEnum** - string.
- **Category** - `id`: integer, obrigatório, read-only; `name`: string, obrigatório; `description`: string; `parent`: integer | null; `is_active`: boolean; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **CategoryDistribution** - `id`: integer, obrigatório; `name`: string, obrigatório; `total`: integer, obrigatório; `percentage`: integer, obrigatório.
- **ClientDashboard** - `orders_by_status`: object, obrigatório; `proposals_received_by_status`: object, obrigatório; `bookings_by_status`: object, obrigatório; `payments_by_status`: object, obrigatório.
- **Conversation** - `id`: integer, obrigatório, read-only; `proposal_id`: integer, obrigatório, read-only; `order_id`: integer, obrigatório, read-only; `order_title`: string, obrigatório, read-only; `order_status`: string, obrigatório, read-only; `proposal_status`: string, obrigatório, read-only; `provider_name`: string, obrigatório, read-only; `contact_name`: string, obrigatório, read-only; `unread_count`: integer, obrigatório, read-only; `last_message_at`: string/date-time | null, obrigatório, read-only; `last_message_preview`: string | null, obrigatório, read-only; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **CsrfToken** - `csrf_token`: string, obrigatório.
- **DashboardResponse** - `client`: ClientDashboard, obrigatório; `provider`: ProviderDashboard | null, obrigatório; `platform`: PlatformDashboard | null, obrigatório.
- **DeactivatePushToken** - `token`: string, obrigatório.
- **DeactivatePushTokenResponse** - `deactivated`: boolean, obrigatório.
- **DocumentTypeEnum** - string.
- **EmailOnly** - `email`: string/email, obrigatório.
- **FavoriteProvider** - `id`: integer, obrigatório, read-only; `provider`: integer, obrigatório; `commercial_name`: string, obrigatório, read-only; `created_at`: string/date-time, obrigatório, read-only.
- **FavoriteService** - `id`: integer, obrigatório, read-only; `service`: integer, obrigatório; `service_name`: string, obrigatório, read-only; `provider_name`: string, obrigatório, read-only; `minimum_price`: string/decimal | null, obrigatório, read-only; `maximum_price`: string/decimal | null, obrigatório, read-only; `currency`: string, obrigatório, read-only; `created_at`: string/date-time, obrigatório, read-only.
- **InactiveService** - `id`: integer, obrigatório; `name`: string, obrigatório; `provider_name`: string, obrigatório; `created_at`: string/date-time, obrigatório.
- **KindEnum** - string.
- **ListingTypeEnum** - string.
- **ListingView** - `listing_type`: ListingTypeEnum, obrigatório; `listing_id`: integer, obrigatório; `session_key`: string/uuid, obrigatório.
- **ListingViewResponse** - `recorded`: boolean, obrigatório; `listing_type`: ListingTypeEnum, obrigatório.
- **Logout** - `refresh`: string, obrigatório, write-only.
- **MarkNotificationsRead** - `marked_read`: integer, obrigatório.
- **Message** - `id`: integer, obrigatório, read-only; `sender_id`: integer, obrigatório, read-only; `body`: string, obrigatório; `created_at`: string/date-time, obrigatório, read-only.
- **MethodEnum** - string.
- **Municipality** - `id`: integer, obrigatório, read-only; `province`: integer, obrigatório; `province_name`: string, obrigatório, read-only; `name`: string, obrigatório; `is_active`: boolean.
- **Notification** - `id`: integer, obrigatório, read-only; `kind`: KindEnum, obrigatório, read-only; `title`: string, obrigatório, read-only; `body`: string, obrigatório, read-only; `actor_id`: integer | null, obrigatório, read-only; `conversation_id`: integer | null, obrigatório, read-only; `product_order_id`: integer | null, obrigatório, read-only; `href`: string | null, obrigatório, read-only; `created_at`: string/date-time, obrigatório, read-only; `read_at`: string/date-time | null, obrigatório, read-only.
- **OpenConversation** - `proposal_id`: integer, obrigatório.
- **OrderOpportunity** - `id`: integer, obrigatório, read-only; `category`: integer, obrigatório; `category_name`: string, obrigatório, read-only; `title`: string, obrigatório; `description`: string, obrigatório; `minimum_budget`: string/decimal | null; `maximum_budget`: string/decimal | null; `requested_duration_minutes`: integer | null; `currency`: string; `municipality_name_snapshot`: string, obrigatório; `province_name_snapshot`: string, obrigatório; `neighborhood_snapshot`: string; `requested_at`: string/date-time | null; `created_at`: string/date-time, obrigatório, read-only; `status`: OrderStatusEnum.
- **OrderStatus** - `id`: integer, obrigatório, read-only; `status`: OrderStatusEnum, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **OrderStatusEnum** - string.
- **PaginatedBookingList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Booking], obrigatório.
- **PaginatedCategoryList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Category], obrigatório.
- **PaginatedConversationList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Conversation], obrigatório.
- **PaginatedFavoriteProviderList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[FavoriteProvider], obrigatório.
- **PaginatedFavoriteServiceList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[FavoriteService], obrigatório.
- **PaginatedMessageList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Message], obrigatório.
- **PaginatedMunicipalityList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Municipality], obrigatório.
- **PaginatedNotificationList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Notification], obrigatório.
- **PaginatedOrderOpportunityList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[OrderOpportunity], obrigatório.
- **PaginatedPaymentList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Payment], obrigatório.
- **PaginatedProductList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Product], obrigatório.
- **PaginatedProductOrderList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[ProductOrder], obrigatório.
- **PaginatedProposalList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Proposal], obrigatório.
- **PaginatedProviderCoverageList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[ProviderCoverage], obrigatório.
- **PaginatedProviderDiscoveryList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[ProviderDiscovery], obrigatório.
- **PaginatedProviderVerificationDocumentList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[ProviderVerificationDocument], obrigatório.
- **PaginatedProvinceList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Province], obrigatório.
- **PaginatedReviewList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Review], obrigatório.
- **PaginatedServiceList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[Service], obrigatório.
- **PaginatedServiceOrderList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[ServiceOrder], obrigatório.
- **PaginatedUserLocationList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[UserLocation], obrigatório.
- **PaginatedWeeklyAvailabilityList** - `count`: integer, obrigatório; `next`: string/uri | null; `previous`: string/uri | null; `results`: array[WeeklyAvailability], obrigatório.
- **PasswordResetConfirm** - `uid`: string, obrigatório; `token`: string, obrigatório; `password`: string, obrigatório, write-only.
- **PatchedAccount** - `id`: integer, read-only; `email`: string/email, read-only; `phone`: string | null.
- **PatchedBusinessProfile** - `id`: integer, read-only; `business_type`: BusinessTypeEnum; `commercial_name`: string; `description`: string; `business_phone`: string; `business_email`: string/email | string; `verification_status`: string, read-only; `verified_at`: string/date-time, read-only; `registered_name`: string; `logo`: string/uri | null; `website`: string/uri | string; `address`: string; `opening_hours`: object; `created_at`: string/date-time, read-only; `updated_at`: string/date-time, read-only.
- **PatchedCategory** - `id`: integer, read-only; `name`: string; `description`: string; `parent`: integer | null; `is_active`: boolean; `created_at`: string/date-time, read-only; `updated_at`: string/date-time, read-only.
- **PatchedMunicipality** - `id`: integer, read-only; `province`: integer; `province_name`: string, read-only; `name`: string; `is_active`: boolean.
- **PatchedProduct** - `id`: integer, read-only; `provider_id`: integer, read-only; `provider_name`: string, read-only; `category`: integer; `category_name`: string, read-only; `name`: string; `description`: string; `price`: string/decimal; `currency`: string, read-only; `stock_quantity`: integer/int64; `image`: string/uri | null; `image_url`: string/uri | string; `is_active`: boolean; `created_at`: string/date-time, read-only; `updated_at`: string/date-time, read-only.
- **PatchedProfile** - `id`: integer, read-only; `full_name`: string; `photo`: string/uri | null; `biography`: string; `birth_date`: string/date | null; `created_at`: string/date-time, read-only; `updated_at`: string/date-time, read-only.
- **PatchedProvider** - `id`: integer, read-only; `commercial_name`: string; `description`: string; `business_phone`: string; `business_email`: string/email | string; `verification_status`: VerificationStatusEnum, read-only; `verified_at`: string/date-time | null, read-only; `verification_submitted_at`: string/date-time | null, read-only; `verification_feedback`: string, read-only; `created_at`: string/date-time, read-only; `updated_at`: string/date-time, read-only.
- **PatchedProviderCoverage** - `id`: integer, read-only; `provider_id`: integer, read-only; `provider_name`: string, read-only; `municipality`: integer; `municipality_name`: string, read-only; `province_name`: string, read-only; `radius_km`: string/decimal | null; `created_at`: string/date-time, read-only; `updated_at`: string/date-time, read-only.
- **PatchedProvince** - `id`: integer, read-only; `name`: string; `code`: string; `is_active`: boolean.
- **PatchedService** - `id`: integer, read-only; `provider_id`: integer, read-only; `category`: integer; `name`: string; `description`: string; `minimum_price`: string/decimal | null; `maximum_price`: string/decimal | null; `currency`: string; `price_type`: PriceTypeEnum; `duration_minutes`: integer | null; `is_active`: boolean; `created_at`: string/date-time, read-only; `updated_at`: string/date-time, read-only.
- **PatchedUserLocation** - `id`: integer, read-only; `municipality`: integer; `municipality_name`: string, read-only; `province_name`: string, read-only; `label`: string; `neighborhood`: string; `address`: string; `latitude`: string/decimal | null; `longitude`: string/decimal | null; `is_active`: boolean; `created_at`: string/date-time, read-only; `updated_at`: string/date-time, read-only.
- **PatchedWeeklyAvailability** - `id`: integer, read-only; `weekday`: WeekdayEnum; `start_time`: string/time; `end_time`: string/time; `created_at`: string/date-time, read-only; `updated_at`: string/date-time, read-only.
- **Payment** - `id`: integer, obrigatório, read-only; `booking_id`: integer, obrigatório; `amount`: string/decimal, obrigatório, read-only; `currency`: string, obrigatório, read-only; `method`: MethodEnum, obrigatório; `external_reference`: string; `status`: PaymentStatusEnum, obrigatório, read-only; `created_at`: string/date-time, obrigatório, read-only; `reviewed_at`: string/date-time | null, obrigatório, read-only.
- **PaymentStatusEnum** - string.
- **PendingBusiness** - `id`: integer, obrigatório; `name`: string, obrigatório; `registered_name`: string, obrigatório; `email`: string/email, obrigatório; `submitted_at`: string/date-time, obrigatório.
- **PendingVerification** - `id`: integer, obrigatório; `name`: string, obrigatório; `submitted_at`: string/date-time, obrigatório.
- **PeriodComparison** - `period_days`: integer, obrigatório; `current_start`: string/date, obrigatório; `current_end`: string/date, obrigatório; `previous_start`: string/date, obrigatório; `previous_end`: string/date, obrigatório; `metrics`: object, obrigatório.
- **PeriodComparisonMetric** - `current`: integer, obrigatório; `previous`: integer, obrigatório; `change`: integer, obrigatório; `change_percent`: number/double | null, obrigatório.
- **PlatformDashboard** - `users_total`: integer, obrigatório; `providers_by_verification_status`: object, obrigatório; `orders_by_status`: object, obrigatório; `bookings_by_status`: object, obrigatório; `payments_by_status`: object, obrigatório.
- **PlatformEnum** - string.
- **PriceTypeEnum** - string.
- **Product** - `id`: integer, obrigatório, read-only; `provider_id`: integer, obrigatório, read-only; `provider_name`: string, obrigatório, read-only; `category`: integer, obrigatório; `category_name`: string, obrigatório, read-only; `name`: string, obrigatório; `description`: string; `price`: string/decimal, obrigatório; `currency`: string, obrigatório, read-only; `stock_quantity`: integer/int64; `image`: string/uri | null; `image_url`: string/uri | string; `is_active`: boolean; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **ProductOrder** - `id`: integer, obrigatório, read-only; `provider_name`: string, obrigatório, read-only; `is_buyer`: boolean, obrigatório, read-only; `is_provider`: boolean, obrigatório, read-only; `buyer_email`: string, obrigatório, read-only; `buyer_phone`: string, obrigatório, read-only; `provider_email`: string, obrigatório, read-only; `provider_phone`: string, obrigatório, read-only; `status`: ProductOrderStatusEnum, obrigatório, read-only; `total_amount`: string/decimal, obrigatório, read-only; `currency`: string, obrigatório, read-only; `delivery_notes`: string, obrigatório, read-only; `payment_note`: string, obrigatório, read-only; `items`: array[ProductOrderItem], obrigatório, read-only; `review`: ProductOrderReviewSummary | null, obrigatório, read-only; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **ProductOrderCreate** - `items`: array[ProductOrderLineInput], obrigatório; `delivery_notes`: string.
- **ProductOrderItem** - `product_id`: integer, obrigatório, read-only; `product_name`: string, obrigatório, read-only; `unit_price`: string/decimal, obrigatório, read-only; `quantity`: integer, obrigatório, read-only; `subtotal`: string/decimal, obrigatório, read-only.
- **ProductOrderLineInput** - `product_id`: integer, obrigatório; `quantity`: integer, obrigatório.
- **ProductOrderReviewSummary** - `rating`: integer, obrigatório; `comment`: string, obrigatório; `created_at`: string/date-time, obrigatório.
- **ProductOrderStatusEnum** - string.
- **ProfessionalAnalyticsResponse** - `period_days`: integer, obrigatório; `publications_total`: integer, obrigatório; `summary`: ProfessionalAnalyticsSummary, obrigatório; `series`: array[ProfessionalAnalyticsSeries], obrigatório.
- **ProfessionalAnalyticsSeries** - `date`: string/date, obrigatório; `views`: integer, obrigatório; `publications`: integer, obrigatório; `service_orders`: integer, obrigatório; `proposals`: integer, obrigatório; `conversations`: integer, obrigatório; `product_orders`: integer, obrigatório.
- **ProfessionalAnalyticsSummary** - `views`: integer, obrigatório; `publications`: integer, obrigatório; `service_orders`: integer, obrigatório; `proposals`: integer, obrigatório; `conversations`: integer, obrigatório; `product_orders`: integer, obrigatório.
- **Profile** - `id`: integer, obrigatório, read-only; `full_name`: string, obrigatório; `photo`: string/uri | null; `biography`: string; `birth_date`: string/date | null; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **Proposal** - `id`: integer, obrigatório, read-only; `order_id`: integer, obrigatório; `order_title`: string, obrigatório, read-only; `provider_id`: integer, obrigatório, read-only; `provider_name`: string, obrigatório, read-only; `service`: integer | null; `price`: string/decimal, obrigatório; `currency`: string, obrigatório, read-only; `description`: string, obrigatório; `estimated_days`: integer/int64, obrigatório; `status`: ProposalStatusEnum, obrigatório, read-only; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **ProposalStatusEnum** - string.
- **Provider** - `id`: integer, obrigatório, read-only; `commercial_name`: string, obrigatório; `description`: string; `business_phone`: string; `business_email`: string/email | string; `verification_status`: VerificationStatusEnum, obrigatório, read-only; `verified_at`: string/date-time | null, obrigatório, read-only; `verification_submitted_at`: string/date-time | null, obrigatório, read-only; `verification_feedback`: string, obrigatório, read-only; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **ProviderCoverage** - `id`: integer, obrigatório, read-only; `provider_id`: integer, obrigatório, read-only; `provider_name`: string, obrigatório, read-only; `municipality`: integer, obrigatório; `municipality_name`: string, obrigatório, read-only; `province_name`: string, obrigatório, read-only; `radius_km`: string/decimal | null; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **ProviderDashboard** - `services`: ProviderServiceCounts, obrigatório; `proposals_by_status`: object, obrigatório; `bookings_by_status`: object, obrigatório; `reviews`: ProviderReviewCounts, obrigatório; `completed_booking_value`: string, obrigatório; `confirmed_payments_total`: string, obrigatório; `currency`: string, obrigatório.
- **ProviderDiscovery** - `id`: integer, obrigatório, read-only; `commercial_name`: string, obrigatório; `description`: string; `verification_status`: VerificationStatusEnum; `business_profile`: BusinessProfilePublic, obrigatório, read-only; `active_service_count`: integer, obrigatório, read-only; `average_rating`: string/decimal | null, obrigatório, read-only; `review_count`: integer, obrigatório, read-only; `view_count`: integer, obrigatório, read-only.
- **ProviderReviewCounts** - `average_rating`: string | null, obrigatório; `count`: integer, obrigatório.
- **ProviderServiceCounts** - `active`: integer, obrigatório; `inactive`: integer, obrigatório.
- **ProviderVerificationDocument** - `id`: integer, obrigatório, read-only; `document_type`: DocumentTypeEnum, obrigatório; `file`: string/uri, obrigatório, write-only; `uploaded_at`: string/date-time, obrigatório, read-only.
- **Province** - `id`: integer, obrigatório, read-only; `name`: string, obrigatório; `code`: string, obrigatório; `is_active`: boolean.
- **PushDeviceToken** - `id`: integer, obrigatório, read-only; `token`: string, obrigatório; `platform`: PlatformEnum, obrigatório; `user_id`: integer, obrigatório, read-only; `is_active`: boolean, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **RecentUser** - `id`: integer, obrigatório; `email`: string/email, obrigatório; `created_at`: string/date-time, obrigatório; `active`: boolean, obrigatório; `staff`: boolean, obrigatório.
- **Registration** - `email`: string/email, obrigatório; `phone`: string | null; `password`: string, obrigatório, write-only.
- **RegistrationResponse** - `detail`: string, obrigatório.
- **Review** - `id`: integer, obrigatório, read-only; `booking_id`: integer, write-only; `product_order_id`: integer, write-only; `provider_id`: integer, obrigatório, read-only; `provider_name`: string, obrigatório, read-only; `rating`: integer, obrigatório; `comment`: string; `created_at`: string/date-time, obrigatório, read-only.
- **ReviewSummaryResponse** - `provider_id`: integer, obrigatório; `average_rating`: string | null, obrigatório; `review_count`: integer, obrigatório.
- **ScheduleBooking** - `scheduled_at`: string/date-time, obrigatório.
- **Service** - `id`: integer, obrigatório, read-only; `provider_id`: integer, obrigatório, read-only; `category`: integer, obrigatório; `name`: string, obrigatório; `description`: string; `minimum_price`: string/decimal | null; `maximum_price`: string/decimal | null; `currency`: string; `price_type`: PriceTypeEnum, obrigatório; `duration_minutes`: integer | null; `is_active`: boolean; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **ServiceOrder** - `id`: integer, obrigatório, read-only; `category`: integer, obrigatório; `title`: string, obrigatório; `description`: string, obrigatório; `minimum_budget`: string/decimal | null; `maximum_budget`: string/decimal | null; `requested_duration_minutes`: integer | null; `currency`: string; `municipality`: integer, obrigatório; `municipality_name`: string, obrigatório, read-only; `province_name`: string, obrigatório, read-only; `neighborhood`: string; `address`: string; `latitude`: string/decimal | null; `longitude`: string/decimal | null; `requested_at`: string/date-time | null; `status`: OrderStatusEnum, obrigatório, read-only; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **ServiceOrderFunnel** - `cohort_start`: string/date, obrigatório; `cohort_end`: string/date, obrigatório; `stages`: array[ServiceOrderFunnelStage], obrigatório.
- **ServiceOrderFunnelStage** - `key`: string, obrigatório; `name`: string, obrigatório; `count`: integer, obrigatório; `conversion_from_previous`: number/double | null, obrigatório.
- **TokenBody** - `token`: string, obrigatório.
- **TokenPairResponse** - `access`: string, obrigatório; `refresh`: string, obrigatório.
- **TokenRefresh** - `access`: string, obrigatório, read-only; `refresh`: string, obrigatório.
- **TrendDirectionEnum** - string.
- **UnreadNotificationCount** - `unread_count`: integer, obrigatório.
- **UserGrowthPoint** - `month`: string, obrigatório; `users`: integer, obrigatório.
- **UserLocation** - `id`: integer, obrigatório, read-only; `municipality`: integer, obrigatório; `municipality_name`: string, obrigatório, read-only; `province_name`: string, obrigatório, read-only; `label`: string; `neighborhood`: string; `address`: string; `latitude`: string/decimal | null; `longitude`: string/decimal | null; `is_active`: boolean; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.
- **VerificationActivity** - `id`: integer, obrigatório; `provider_name`: string, obrigatório; `previous_status`: string | null, obrigatório; `new_status`: string, obrigatório; `actor`: string/email | null, obrigatório; `created_at`: string/date-time, obrigatório.
- **VerificationStatusEnum** - string.
- **VerifiedTokenObtainPair** - `email`: string, obrigatório, write-only; `password`: string, obrigatório, write-only.
- **WebLogin** - `email`: string/email, obrigatório; `password`: string, obrigatório, write-only.
- **WeekdayEnum** - integer.
- **WeeklyAvailability** - `id`: integer, obrigatório, read-only; `weekday`: WeekdayEnum, obrigatório; `start_time`: string/time, obrigatório; `end_time`: string/time, obrigatório; `created_at`: string/date-time, obrigatório, read-only; `updated_at`: string/date-time, obrigatório, read-only.

## Como interpretar os dashboards

- `GET /api/v1/dashboard/`: `client` resume os estados dos pedidos,
  propostas recebidas, contratações e pagamentos do utilizador autenticado.
  `provider` é `null` se não existir perfil profissional; caso exista, inclui
  publicações activas/inactivas, propostas, contratações, avaliações e totais
  monetários. `platform` é `null` para não-administradores.
- `GET /api/v1/dashboard/analytics/`: `summary` conta visualizações,
  publicações, pedidos com proposta, propostas, conversas e encomendas de
  produtos criadas no período. `publications_total` é o total actual de
  publicações activas do prestador; `series` tem uma entrada por dia do
  período.
- `GET /api/v1/dashboard/admin/`: `summary` contém totais actuais da
  plataforma. `analytics.summary` conta os eventos no período escolhido e
  `analytics.series` apresenta a contagem diária e médias móveis de sete dias.
  A análise inclui média e desvio diários, dias activos/sem eventos e tendência
  linear descritiva; não é uma previsão. `period_comparison` compara intervalos
  consecutivos com igual duração. O funil agrupa pedidos pela data de criação
  dentro do período, embora as etapas posteriores possam reflectir estados
  actuais que ainda mudam.
- A análise administrativa aceita `period=7`, `30` ou `90` (predefinição:
  `30`). Crescimento de utilizadores/empresas cobre os últimos 12 meses;
  listas recentes ou pendentes são limitadas e não representam todos os
  registos.
- Valores monetários são devolvidos como strings decimais para evitar perda de
  precisão. Os totais financeiros do painel profissional usam `AOA`.

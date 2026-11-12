"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, ClipboardList, MessageCircle, Star } from "lucide-react";
import AvailabilityWidget from "../availability-widget";
import AnalyticsPanel from "@/app/components/analytics-panel";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
const estados = {
    PENDING: "Em análise",
    VERIFIED: "Verificado",
    REJECTED: "Precisa de correções",
    SUSPENDED: "Suspenso",
};
const nomesEstado = {
    PENDING: "Pendente", ACCEPTED: "Aceite", REJECTED: "Recusada", CANCELLED: "Cancelada",
    SCHEDULED: "Por agendar", CONFIRMED: "Confirmado", IN_PROGRESS: "Em execução", COMPLETED: "Concluído",
};
function formatarData(valor) {
    return new Date(valor).toLocaleDateString("pt-AO", { day: "numeric", month: "short" });
}
export default function PainelPrestador() {
    const router = useRouter();
    const [provider, setProvider] = useState(null);
    const [summary, setSummary] = useState(null);
    const [feed, setFeed] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let active = true;
        (async () => {
            const dashboardResponse = await fetchApi("/api/auth/dashboard/", { cache: "no-store" });
            if (dashboardResponse.status === 401) {
                router.replace("/entrar?next=%2Fprestador");
                return;
            }
            if (!dashboardResponse.ok)
                throw new Error("Não foi possível carregar as métricas da atividade.");
            const dashboard = await dashboardResponse.json();
            const providerResponse = await fetchApi("/api/auth/providers/me/", { cache: "no-store" });
            if (providerResponse.status === 401) {
                router.replace("/entrar?next=%2Fprestador");
                return;
            }
            const providerData = providerResponse.ok ? await providerResponse.json() : null;
            let opportunities = 0;
            let opportunitiesPage = null;
            if (providerData?.verification_status === "VERIFIED") {
                const opportunitiesResponse = await fetchApi("/api/auth/orders/opportunities/", { cache: "no-store" });
                if (opportunitiesResponse.status === 401) {
                    router.replace("/entrar?next=%2Fprestador");
                    return;
                }
                if (opportunitiesResponse.ok) {
                    opportunitiesPage = await opportunitiesResponse.json();
                    opportunities = opportunitiesPage?.count ?? 0;
                }
            }
            const [proposalsResponse, bookingsResponse, productOrdersResponse] = await Promise.all([
                fetchApi("/api/auth/proposals/", { cache: "no-store" }),
                fetchApi("/api/auth/bookings/", { cache: "no-store" }),
                fetchApi("/api/auth/product-orders", { cache: "no-store" }),
            ]);
            if ([proposalsResponse, bookingsResponse, productOrdersResponse].some((response) => response.status === 401)) {
                router.replace("/entrar?next=%2Fprestador");
                return;
            }
            const [proposals, bookings, productOrders] = await Promise.all([
                proposalsResponse.ok ? proposalsResponse.json() : Promise.resolve({ results: [] }),
                bookingsResponse.ok ? bookingsResponse.json() : Promise.resolve({ results: [] }),
                productOrdersResponse.ok ? productOrdersResponse.json() : Promise.resolve({ results: [] }),
            ]);
            if (!active)
                return;
            setProvider(providerData);
            const business = dashboard.provider;
            setSummary({
                opportunities,
                proposals: business ? Object.entries(business.proposals_by_status)
                    .filter(([status]) => status !== "CANCELLED")
                    .reduce((sum, [, count]) => sum + count, 0) : 0,
                services: business?.services.active ?? 0,
                bookings: business?.bookings_by_status ? Object.values(business.bookings_by_status).reduce((sum, count) => sum + count, 0) : 0,
                rating: business?.reviews?.average_rating ?? null,
                reviews: business?.reviews?.count ?? 0,
            });
            setFeed(providerData ? [
                ...proposals.results.map((proposal) => ({
                    id: `proposta-${proposal.id}`, titulo: `Proposta no pedido: ${proposal.order_title}`,
                    detalhe: "A tua proposta", estado: nomesEstado[proposal.status] ?? proposal.status,
                    data: proposal.created_at, href: "/prestador/pedidos",
                })),
                ...bookings.results.map((booking) => ({
                    id: `contratacao-${booking.id}`, titulo: `Contratação #${booking.id}`,
                    detalhe: `Pedido #${booking.order_id}`, estado: nomesEstado[booking.status] ?? booking.status,
                    data: booking.created_at, href: "/contratacoes",
                })),
                ...productOrders.results.filter((order) => order.is_provider).map((order) => ({
                    id: `encomenda-produto-${order.id}`, titulo: `Encomenda de produtos #${order.id}`,
                    detalhe: "Compra recebida", estado: nomesEstado[order.status] ?? order.status,
                    data: order.created_at, href: "/empresa/encomendas",
                })),
                ...(opportunitiesPage?.results ?? []).map((opportunity) => ({
                    id: `oportunidade-${opportunity.id}`, titulo: opportunity.title,
                    detalhe: "Novo pedido compatível", estado: "Oportunidade",
                    data: opportunity.created_at, href: "/prestador/pedidos",
                })),
            ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 8) : []);
            if (!providerResponse.ok && providerResponse.status !== 404) {
                setError("O estado do perfil profissional não está disponível neste momento.");
            }
        })()
            .catch(() => {
            if (active)
                setError("Não foi possível contactar a plataforma. Tenta atualizar o painel.");
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
        return () => { active = false; };
    }, [router]);
    return (_jsxs(EstruturaAutenticacao, { account: true, area: "provider", profileName: provider?.commercial_name, children: [_jsx("p", { className: styles.eyebrow, children: "\u00C1rea profissional" }), _jsx("h1", { children: provider?.commercial_name ? `Olá, ${provider.commercial_name}` : "Painel do prestador" }), _jsx("p", { className: styles.intro, children: "Acompanha o teu desempenho e gere os servi\u00E7os que apresentas aos clientes." }), loading ? _jsx("p", { className: styles.intro, "aria-live": "polite", children: "A carregar o teu painel\u2026" }) : (_jsxs(_Fragment, { children: [error && _jsx("p", { className: styles.notice, role: "status", children: error }), _jsxs("section", { className: styles.providerWelcome, children: [_jsx("span", { className: styles.providerWelcomeAvatar, children: provider?.commercial_name?.slice(0, 1).toLocaleUpperCase("pt-AO") ?? "P" }), _jsxs("div", { children: [_jsx("span", { children: "Perfil profissional" }), _jsx("strong", { children: provider?.commercial_name ?? "Completa o teu perfil" }), _jsx("small", { children: "Angola \u00B7 Servi\u00E7os e oportunidades" })] }), provider && _jsx("span", { className: styles.providerWelcomeStatus, "data-status": provider.verification_status, children: estados[provider.verification_status] }), _jsx(Link, { href: "/perfil", children: "Editar perfil" })] }), summary && _jsxs("div", { className: styles.dashboardStats, "aria-label": "Resumo da atividade", children: [_jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "blue", children: _jsx(BriefcaseBusiness, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: summary.services }), _jsx("span", { children: "Servi\u00E7os publicados" })] }), _jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "violet", children: _jsx(ClipboardList, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: summary.opportunities }), _jsx("span", { children: "Pedidos dispon\u00EDveis" })] }), _jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "blue", children: _jsx(MessageCircle, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: summary.proposals }), _jsx("span", { children: "Propostas enviadas" })] }), _jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "amber", children: _jsx(Star, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: summary.rating ?? "—" }), _jsxs("span", { children: ["Avalia\u00E7\u00E3o m\u00E9dia \u00B7 ", summary.reviews, " avalia\u00E7\u00F5es"] })] })] }), provider && _jsxs("div", { className: styles.providerStatus, children: [_jsx("span", { children: "Estado do perfil profissional" }), _jsx("strong", { "data-status": provider.verification_status, children: estados[provider.verification_status] }), provider.verification_status === "REJECTED" && provider.verification_feedback && _jsx("p", { children: provider.verification_feedback })] }), provider && _jsx(AnalyticsPanel, {}), provider && _jsx(AvailabilityWidget, {}), _jsxs("section", { className: styles.feedSection, "aria-labelledby": "atividade-prestador", children: [_jsxs("div", { className: styles.feedHeading, children: [_jsxs("div", { children: [_jsx("p", { className: styles.eyebrow, children: "A tua rede" }), _jsx("h2", { id: "atividade-prestador", children: "Atividade recente" })] }), _jsx(Link, { href: "/prestador/pedidos", children: "Ver oportunidades" })] }), feed.length ? _jsx("ol", { className: styles.activityFeed, children: feed.map((item) => _jsxs("li", { children: [_jsx("span", { className: styles.feedMarker, "aria-hidden": "true" }), _jsxs(Link, { href: item.href, className: styles.activityCard, children: [_jsxs("span", { className: styles.activityMeta, children: [_jsx("span", { children: item.detalhe }), _jsx("time", { dateTime: item.data, children: formatarData(item.data) })] }), _jsx("strong", { children: item.titulo }), _jsx("span", { className: styles.activityState, children: item.estado })] })] }, item.id)) }) : _jsxs("div", { className: styles.feedEmpty, children: [_jsx("strong", { children: "O teu feed profissional est\u00E1 pronto" }), _jsx("p", { children: "As oportunidades e atualiza\u00E7\u00F5es da tua atividade v\u00E3o aparecer aqui." }), _jsx(Link, { href: "/perfil", children: "Completar perfil profissional" })] })] }), _jsxs("section", { className: styles.dashboardSection, "aria-labelledby": "prestador-acoes", children: [_jsx("h2", { id: "prestador-acoes", children: "Gerir a tua atividade" }), _jsxs("div", { className: styles.dashboardLinks, children: [_jsxs(Link, { href: "/prestador/pedidos", children: [_jsx("strong", { children: "Encontrar pedidos" }), _jsx("span", { children: "Consulta oportunidades e envia propostas." })] }), _jsxs(Link, { href: "/prestador/servicos", children: [_jsx("strong", { children: "Gerir servi\u00E7os" }), _jsx("span", { children: "Atualiza o cat\u00E1logo que os clientes encontram." })] }), _jsxs(Link, { href: "/empresa/produtos", children: [_jsx("strong", { children: "Gerir produtos" }), _jsx("span", { children: "Publica artigos com pre\u00E7o e stock." })] }), _jsxs(Link, { href: "/empresa/encomendas", children: [_jsx("strong", { children: "Encomendas recebidas" }), _jsx("span", { children: "Responde aos pedidos dos clientes." })] }), _jsxs(Link, { href: "/perfil", children: [_jsx("strong", { children: "Perfil e verifica\u00E7\u00E3o" }), _jsx("span", { children: "Completa os dados e acompanha os documentos." })] }), _jsxs(Link, { href: "/mensagens", children: [_jsx("strong", { children: "Mensagens" }), _jsx("span", { children: "Responde a clientes e acompanha conversas." })] }), _jsxs(Link, { href: "/contratacoes", children: [_jsx("strong", { children: "Contrata\u00E7\u00F5es" }), _jsx("span", { children: "Gere marca\u00E7\u00F5es e servi\u00E7os em curso." })] })] })] }), !provider && _jsx("p", { className: styles.success, children: "Cria o teu perfil profissional para come\u00E7ares a apresentar os teus servi\u00E7os." })] }))] }));
}

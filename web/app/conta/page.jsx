"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { Bell, ClipboardList, Heart, MessageCircle } from "lucide-react";
import EstruturaAutenticacao from "../auth-shell";
import BusinessLogo from "../components/business-logo";
import styles from "../auth.module.css";
const nomesEstado = {
    OPEN: "Aberto", NEGOTIATING: "A receber propostas", AWARDED: "Contratado", COMPLETED: "Concluído", CANCELLED: "Cancelado",
    PENDING: "Pendente", ACCEPTED: "Aceite", REJECTED: "Recusada", WITHDRAWN: "Retirada",
    SCHEDULED: "Por agendar", CONFIRMED: "Confirmado", IN_PROGRESS: "Em execução",
};
function formatarData(valor) {
    return new Date(valor).toLocaleDateString("pt-AO", { day: "numeric", month: "short" });
}
function contarItens(pagina) {
    return typeof pagina.count === "number" ? pagina.count : pagina.results?.length ?? 0;
}
function criarAtividades(pedidos, propostas, contratacoes) {
    return [
        ...pedidos.map((pedido) => ({
            id: `pedido-${pedido.id}`, titulo: pedido.title,
            detalhe: "Pedido publicado", estado: nomesEstado[pedido.status] ?? pedido.status,
            data: pedido.created_at, href: "/pedidos",
        })),
        ...propostas.map((proposta) => ({
            id: `proposta-${proposta.id}`, titulo: `Proposta de ${proposta.provider_name}`,
            detalhe: proposta.order_title, estado: nomesEstado[proposta.status] ?? proposta.status,
            data: proposta.created_at, href: "/pedidos",
        })),
        ...contratacoes.map((contratacao) => ({
            id: `contratacao-${contratacao.id}`, titulo: `Serviço com ${contratacao.provider_name}`,
            detalhe: `Contratação do pedido #${contratacao.order_id}`, estado: nomesEstado[contratacao.status] ?? contratacao.status,
            data: contratacao.created_at, href: "/contratacoes",
        })),
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}
export default function PaginaConta() {
    const navegador = useRouter();
    const [account, setAccount] = useState(false);
    const [erro, definirErro] = useState("");
    const [estaCarregando, definirCarregamento] = useState(true);
    const [erroMetricas, definirErroMetricas] = useState("");
    const [erroPrestadores, definirErroPrestadores] = useState("");
    const [nome, setNome] = useState("");
    const [resumo, setResumo] = useState(null);
    const [feed, setFeed] = useState([]);
    const [paginaApiFeed, definirPaginaApiFeed] = useState(1);
    const [limiteFeed, definirLimiteFeed] = useState(8);
    const [temMaisFeed, definirTemMaisFeed] = useState(false);
    const [aCarregarFeed, definirCarregamentoFeed] = useState(false);
    const [erroFeed, definirErroFeed] = useState("");
    const [prestadoresEmDestaque, definirPrestadoresEmDestaque] = useState([]);
    useEffect(() => {
        let ativo = true;
        fetchApi("/api/public/providers/discover/?ordering=-rating&page=1", { cache: "no-store" })
            .then(async (resposta) => {
            if (!resposta.ok)
                throw new Error("Não foi possível carregar os prestadores em destaque.");
            const pagina = await resposta.json();
            if (ativo)
                definirPrestadoresEmDestaque(pagina.results.slice(0, 3));
        })
            .catch((motivo) => {
            if (ativo) {
                definirErroPrestadores(motivo instanceof Error
                    ? motivo.message
                    : "Não foi possível carregar os prestadores em destaque.");
            }
        });
        return () => { ativo = false; };
    }, []);
    useEffect(() => {
        let ativo = true;
        fetchApi("/api/auth/me/", { cache: "no-store" })
            .then(async (respostaHttp) => {
            const dadosRecebidos = await respostaHttp.json();
            if (!ativo)
                return;
            if (respostaHttp.status === 401) {
                navegador.replace("/entrar?next=%2Fconta");
                return;
            }
            if (!respostaHttp.ok) {
                definirErro(typeof dadosRecebidos?.detail === "string"
                    ? dadosRecebidos.detail
                    : "Não foi possível carregar a conta.");
                return;
            }
            setAccount(true);
            const [perfilHttp, dashboardHttp] = await Promise.all([
                fetchApi("/api/auth/profiles/me/", { cache: "no-store" }),
                fetchApi("/api/auth/dashboard/", { cache: "no-store" }),
            ]);
            if ([perfilHttp, dashboardHttp].some((response) => response.status === 401)) {
                navegador.replace("/entrar?next=%2Fconta");
                return;
            }
            const [perfil, dashboard] = await Promise.all([
                perfilHttp.ok ? perfilHttp.json() : Promise.resolve(null),
                dashboardHttp.ok ? dashboardHttp.json() : Promise.resolve(null),
            ]);
            if (!ativo)
                return;
            setNome(perfil?.full_name ?? "");
            const [pedidosHttp, propostasHttp, contratacoesHttp, favoritosPrestadoresHttp, favoritosServicosHttp, conversasHttp, notificacoesHttp,] = await Promise.all([
                fetchApi("/api/auth/orders/", { cache: "no-store" }),
                fetchApi("/api/auth/proposals/", { cache: "no-store" }),
                fetchApi("/api/auth/bookings/", { cache: "no-store" }),
                fetchApi("/api/auth/favorites/providers/", { cache: "no-store" }),
                fetchApi("/api/auth/favorites/services/", { cache: "no-store" }),
                fetchApi("/api/auth/conversations/", { cache: "no-store" }),
                fetchApi("/api/auth/notifications/unread-count/", { cache: "no-store" }),
            ]);
            if ([pedidosHttp, propostasHttp, contratacoesHttp, favoritosPrestadoresHttp, favoritosServicosHttp, conversasHttp, notificacoesHttp].some((response) => response.status === 401)) {
                navegador.replace("/entrar?next=%2Fconta");
                return;
            }
            const [pedidos, propostas, contratacoes, favoritosPrestadores, favoritosServicos, conversas, notificacoes,] = await Promise.all([
                pedidosHttp.ok ? pedidosHttp.json() : Promise.resolve({ results: [], next: null }),
                propostasHttp.ok ? propostasHttp.json() : Promise.resolve({ results: [], next: null }),
                contratacoesHttp.ok ? contratacoesHttp.json() : Promise.resolve({ results: [], next: null }),
                favoritosPrestadoresHttp.ok ? favoritosPrestadoresHttp.json() : Promise.resolve(null),
                favoritosServicosHttp.ok ? favoritosServicosHttp.json() : Promise.resolve(null),
                conversasHttp.ok ? conversasHttp.json() : Promise.resolve(null),
                notificacoesHttp.ok ? notificacoesHttp.json() : Promise.resolve(null),
            ]);
            if ([favoritosPrestadoresHttp, favoritosServicosHttp, conversasHttp, notificacoesHttp].some((response) => !response.ok)) {
                definirErroMetricas("Alguns indicadores não estão disponíveis neste momento.");
            }
            const atividades = criarAtividades(pedidos.results, propostas.results, contratacoes.results);
            if (ativo) {
                setFeed(atividades);
                definirTemMaisFeed(Boolean(pedidos.next || propostas.next || contratacoes.next));
            }
            const estadosPedidos = dashboard?.client?.orders_by_status ?? {};
            setResumo({
                favorites: favoritosPrestadores && favoritosServicos
                    ? contarItens(favoritosPrestadores) + contarItens(favoritosServicos)
                    : null,
                orders: dashboard?.client
                    ? Object.values(estadosPedidos).reduce((soma, count) => soma + count, 0)
                    : null,
                messages: conversas ? contarItens(conversas) : null,
                notifications: typeof notificacoes?.unread_count === "number" ? notificacoes.unread_count : null,
            });
        })
            .catch(() => {
            if (ativo)
                definirErro("Não foi possível contactar o serviço.");
        })
            .finally(() => {
            if (ativo)
                definirCarregamento(false);
        });
        return () => {
            ativo = false;
        };
    }, [navegador]);
    async function carregarMaisFeed() {
        definirErroFeed("");
        if (feed.length > limiteFeed) {
            definirLimiteFeed((atual) => atual + 8);
            return;
        }
        if (!temMaisFeed || aCarregarFeed)
            return;
        definirCarregamentoFeed(true);
        const proximaPagina = paginaApiFeed + 1;
        const consulta = `?page=${proximaPagina}`;
        try {
            const respostas = await Promise.all([
                fetchApi(`/api/auth/orders/${consulta}`, { cache: "no-store" }),
                fetchApi(`/api/auth/proposals/${consulta}`, { cache: "no-store" }),
                fetchApi(`/api/auth/bookings/${consulta}`, { cache: "no-store" }),
            ]);
            if (respostas.some((resposta) => resposta.status === 401)) {
                navegador.replace("/entrar?next=%2Fconta");
                return;
            }
            if (respostas.some((resposta) => !resposta.ok)) {
                throw new Error("Não foi possível carregar mais atividade.");
            }
            const paginas = await Promise.all(respostas.map((resposta) => resposta.json()));
            const [pedidos, propostas, contratacoes] = paginas;
            const novasAtividades = criarAtividades(pedidos.results, propostas.results, contratacoes.results);
            setFeed((atuais) => {
                const unicas = new Map([...atuais, ...novasAtividades].map((item) => [item.id, item]));
                return [...unicas.values()].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
            });
            definirPaginaApiFeed(proximaPagina);
            definirTemMaisFeed(Boolean(pedidos.next || propostas.next || contratacoes.next));
        }
        catch {
            definirErroFeed("Não foi possível carregar mais atividade.");
        }
        finally {
            definirCarregamentoFeed(false);
        }
    }
    return (_jsxs(EstruturaAutenticacao, { account: true, profileName: nome, children: [_jsx("p", { className: styles.eyebrow, children: "Feed da comunidade" }), _jsx("h1", { children: nome ? `Olá, ${nome.split(" ")[0]}` : "O teu feed" }), estaCarregando ? (_jsx("p", { className: styles.intro, "aria-live": "polite", children: "A validar a sess\u00E3o\u2026" })) : account ? (_jsxs(_Fragment, { children: [_jsx("p", { className: styles.intro, children: "Acompanha os teus pedidos e encontra profissionais para o que precisares." }), _jsxs("div", { className: styles.dashboardStats, "aria-label": "Resumo da atividade", children: [_jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "rose", children: _jsx(Heart, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: resumo?.favorites ?? "—" }), _jsx("span", { children: "Favoritos" })] }), _jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "blue", children: _jsx(ClipboardList, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: resumo?.orders ?? "—" }), _jsx("span", { children: "Pedidos" })] }), _jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "violet", children: _jsx(MessageCircle, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: resumo?.messages ?? "—" }), _jsx("span", { children: "Mensagens" })] }), _jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "amber", children: _jsx(Bell, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: resumo?.notifications ?? "—" }), _jsx("span", { children: "Notifica\u00E7\u00F5es" })] })] }), erroMetricas && _jsx("p", { className: styles.profileHint, role: "status", children: erroMetricas }), _jsxs("section", { className: styles.dashboardSection, id: "destaques", "aria-labelledby": "prestadores-destaque", children: [_jsxs("div", { className: styles.feedHeading, children: [_jsxs("div", { children: [_jsx("p", { className: styles.eyebrow, children: "Descobre na comunidade" }), _jsx("h2", { id: "prestadores-destaque", children: "Prestadores em destaque" })] }), _jsx(Link, { href: "/explorar", children: "Ver todos" })] }), prestadoresEmDestaque.length ? _jsx("div", { className: styles.featuredProviders, children: prestadoresEmDestaque.map((prestador) => _jsxs("article", { className: styles.featuredProvider, children: [_jsx(BusinessLogo, { className: styles.featuredImage, companyName: prestador.commercial_name, logoUrl: prestador.business_profile?.logo, width: 72, height: 72 }), _jsxs("div", { children: [_jsx("strong", { children: prestador.commercial_name }), _jsx("small", { children: prestador.description || "Prestador de serviços em Angola." }), _jsxs("span", { className: styles.featuredMeta, children: [prestador.average_rating ? `★ ${prestador.average_rating} · ${prestador.review_count} avaliações` : "Novo prestador", " \u00B7 ", prestador.active_service_count, " servi\u00E7os"] }), _jsx("span", { className: styles.featuredCategory, children: prestador.verification_status === "VERIFIED" ? "Prestador verificado" : "Serviços em destaque" })] }), _jsx(Link, { href: `/prestadores/${prestador.id}`, children: "Ver perfil" })] }, prestador.id)) }) : _jsx("p", { className: styles.profileHint, role: erroPrestadores ? "alert" : undefined, children: erroPrestadores || "Os profissionais disponíveis aparecerão aqui." })] }), _jsxs("section", { className: styles.feedSection, "aria-labelledby": "atividade-recente", children: [_jsxs("div", { className: styles.feedHeading, children: [_jsxs("div", { children: [_jsx("p", { className: styles.eyebrow, children: "A tua rede" }), _jsx("h2", { id: "atividade-recente", children: "Atividade recente" })] }), _jsx(Link, { href: "/pedidos", children: "Ver pedidos" })] }), feed.length ? _jsx("ol", { className: styles.activityFeed, children: feed.slice(0, limiteFeed).map((item) => _jsxs("li", { children: [_jsx("span", { className: styles.feedMarker, "aria-hidden": "true" }), _jsxs(Link, { href: item.href, className: styles.activityCard, children: [_jsxs("span", { className: styles.activityMeta, children: [_jsx("span", { children: item.detalhe }), _jsx("time", { dateTime: item.data, children: formatarData(item.data) })] }), _jsx("strong", { children: item.titulo }), _jsx("span", { className: styles.activityState, children: item.estado })] })] }, item.id)) }) : _jsxs("div", { className: styles.feedEmpty, children: [_jsx("strong", { children: "A tua atividade come\u00E7a aqui" }), _jsx("p", { children: "Cria um pedido para receber propostas de profissionais da comunidade." }), _jsx(Link, { href: "/pedidos/novo", children: "Publicar o primeiro pedido" })] }), (feed.length > limiteFeed || temMaisFeed) && (_jsxs("div", { className: styles.feedLoadMore, children: [erroFeed && _jsx("p", { className: styles.notice, role: "alert", children: erroFeed }), _jsx("button", { type: "button", disabled: aCarregarFeed, onClick: () => void carregarMaisFeed(), children: aCarregarFeed ? "A carregar…" : erroFeed ? "Tentar novamente" : "Ver mais atividade" })] }))] }), _jsxs("section", { className: styles.dashboardSection, "aria-labelledby": "cliente-acoes", children: [_jsx("h2", { id: "cliente-acoes", children: "O que queres fazer?" }), _jsxs("div", { className: styles.dashboardLinks, children: [_jsxs(Link, { href: "/pedidos/novo", children: [_jsx("strong", { children: "Criar pedido" }), _jsx("span", { children: "Descreve o trabalho e recebe propostas." })] }), _jsxs(Link, { href: "/pedidos", children: [_jsx("strong", { children: "Acompanhar pedidos" }), _jsx("span", { children: "Consulta respostas e fala com prestadores." })] }), _jsxs(Link, { href: "/contratacoes", children: [_jsx("strong", { children: "Ver contrata\u00E7\u00F5es" }), _jsx("span", { children: "Gere hor\u00E1rios e acompanha servi\u00E7os." })] }), _jsxs(Link, { href: "/mensagens", children: [_jsx("strong", { children: "Mensagens" }), _jsx("span", { children: "Continua as conversas da plataforma." })] }), _jsxs(Link, { href: "/produtos", children: [_jsx("strong", { children: "Comprar produtos" }), _jsx("span", { children: "Encomenda a empresas e lojas da comunidade." })] })] })] }), _jsxs("div", { className: styles.accountActions, children: [_jsx(Link, { className: styles.secondary, href: "/perfil", children: "Gerir perfis" }), _jsx(Link, { className: styles.secondary, href: "/explorar", children: "Explorar servi\u00E7os" }), _jsx(Link, { className: styles.secondary, href: "/mensagens", children: "Mensagens" }), _jsx(Link, { className: styles.secondary, href: "/compras", children: "As minhas encomendas" }), _jsx(Link, { className: styles.secondary, href: "/contratacoes", children: "Contrata\u00E7\u00F5es" })] })] })) : (_jsx("p", { className: styles.notice, role: "alert", children: erro || "Não foi possível validar a sessão." })), erro && account && (_jsx("p", { className: styles.notice, role: "alert", children: erro }))] }));
}

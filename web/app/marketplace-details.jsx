"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useEffect, useState } from "react";
import { ApiRequestError, requisitarJson } from "@/lib/api-client";
import BusinessLogo from "@/app/components/business-logo";
import ListingViewTracker from "@/app/components/listing-view-tracker";
import styles from "./marketplace-details.module.css";
const diasSemana = [
    "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira",
    "Sexta-feira", "Sábado", "Domingo",
];
const nomesDiasEmpresa = {
    monday: "Segunda-feira",
    tuesday: "Terça-feira",
    wednesday: "Quarta-feira",
    thursday: "Quinta-feira",
    friday: "Sexta-feira",
    saturday: "Sábado",
    sunday: "Domingo",
};
function formatarPreco(servico) {
    if (servico.price_type === "ON_REQUEST" || servico.minimum_price === null) {
        return "Preço sob consulta";
    }
    const minimo = Number(servico.minimum_price).toLocaleString("pt-AO");
    if (servico.price_type === "RANGE" && servico.maximum_price !== null) {
        return `${minimo}–${Number(servico.maximum_price).toLocaleString("pt-AO")} ${servico.currency}`;
    }
    if (servico.price_type === "STARTING_AT")
        return `Desde ${minimo} ${servico.currency}`;
    return `${minimo} ${servico.currency}`;
}
function formatarData(valor) {
    const data = new Date(valor);
    return Number.isNaN(data.getTime())
        ? ""
        : new Intl.DateTimeFormat("pt-AO", { day: "numeric", month: "long", year: "numeric" }).format(data);
}
function criarUrlPedido(servico, prestador) {
    const parametros = new URLSearchParams({
        category: String(servico.category),
        title: servico.name,
        description: servico.description,
        source_provider: prestador.commercial_name,
    });
    if (servico.price_type !== "ON_REQUEST" && servico.minimum_price !== null) {
        parametros.set("minimum_budget", servico.minimum_price);
    }
    if (servico.maximum_price !== null)
        parametros.set("maximum_budget", servico.maximum_price);
    if (servico.duration_minutes !== null)
        parametros.set("duration", String(servico.duration_minutes));
    return `/pedidos/novo?${parametros.toString()}`;
}
function CabecalhoMarketplace() {
    return (_jsxs("header", { className: styles.header, children: [_jsxs(Link, { className: styles.brand, href: "/", "aria-label": "Conect Services \u2014 p\u00E1gina inicial", children: [_jsx("span", { className: styles.brandMark, "aria-hidden": "true", children: "C" }), _jsxs("span", { children: ["conect", _jsx("span", { className: styles.brandAccent, children: "." }), _jsx("small", { children: "services" })] })] }), _jsxs("nav", { className: styles.headerLinks, "aria-label": "Navega\u00E7\u00E3o", children: [_jsx(Link, { href: "/explorar", children: "Explorar servi\u00E7os" }), _jsx(Link, { href: "/entrar", children: "A minha conta" })] })] }));
}
function EstadoCarregamento({ texto }) {
    return _jsx("p", { className: styles.loading, role: "status", "aria-live": "polite", children: texto });
}
function EstadoErro({ mensagem }) {
    return (_jsxs("section", { className: styles.error, role: "alert", children: [_jsx("h1", { children: "N\u00E3o foi poss\u00EDvel abrir esta p\u00E1gina" }), _jsx("p", { children: mensagem }), _jsx(Link, { href: "/explorar", children: "Voltar a explorar servi\u00E7os" })] }));
}
function PerfilPrestador({ dados }) {
    const { provider, services, categories, reviews, availability } = dados;
    return (_jsxs(_Fragment, { children: [_jsxs("section", { className: styles.providerHero, children: [provider.business_profile ? (_jsx(BusinessLogo, { className: `${styles.providerAvatar} ${styles.providerAvatarImage}`, companyName: provider.commercial_name, logoUrl: provider.business_profile.logo, width: 78, height: 78 })) : (_jsx("div", { className: styles.providerAvatar, "aria-hidden": "true", children: provider.commercial_name.slice(0, 1).toLocaleUpperCase("pt-AO") })), _jsxs("div", { className: styles.providerIntro, children: [_jsx("p", { className: styles.eyebrow, children: provider.business_profile ? "Empresa · prestador verificado" : "Prestador verificado" }), _jsx("h1", { children: provider.commercial_name }), _jsx("p", { children: provider.description || "Profissional verificado na comunidade Conect Services." }), _jsxs("div", { className: styles.metrics, children: [_jsxs("span", { children: [_jsxs("strong", { children: ["\u2605 ", provider.average_rating ?? "Novo"] }), " avalia\u00E7\u00E3o m\u00E9dia"] }), _jsxs("span", { children: [_jsx("strong", { children: provider.review_count }), " ", provider.review_count === 1 ? "avaliação" : "avaliações"] }), _jsxs("span", { children: [_jsx("strong", { children: provider.active_service_count }), " ", provider.active_service_count === 1 ? "serviço ativo" : "serviços ativos"] })] }), provider.business_profile && (_jsxs("div", { className: styles.businessPublicDetails, children: [provider.business_profile.website && (_jsx("a", { href: provider.business_profile.website, target: "_blank", rel: "noopener noreferrer", children: "Visitar website da empresa" })), Object.entries(provider.business_profile.opening_hours ?? {}).length > 0 && (_jsx("dl", { children: Object.entries(provider.business_profile.opening_hours).map(([day, hours]) => (_jsxs("div", { children: [_jsx("dt", { children: nomesDiasEmpresa[day] ?? day }), _jsx("dd", { children: hours })] }, day))) }))] }))] })] }), _jsxs("section", { className: styles.section, "aria-labelledby": "servicos-do-prestador", children: [_jsxs("div", { className: styles.sectionHeader, children: [_jsxs("div", { children: [_jsx("p", { className: styles.eyebrow, children: "Cat\u00E1logo profissional" }), _jsx("h2", { id: "servicos-do-prestador", children: "Servi\u00E7os dispon\u00EDveis" })] }), _jsxs("span", { children: [services.length, " ", services.length === 1 ? "serviço" : "serviços"] })] }), services.length ? (_jsx("div", { className: styles.serviceGrid, children: services.map((service) => (_jsxs("article", { className: styles.serviceCard, children: [_jsxs("div", { className: styles.serviceMeta, children: [_jsx("span", { children: categories.find((category) => category.id === service.category)?.name ?? "Serviço profissional" }), service.duration_minutes && _jsxs("span", { children: [service.duration_minutes, " min"] })] }), _jsx("h3", { children: service.name }), _jsx("p", { children: service.description || "Fala com o prestador para saber mais sobre este serviço." }), _jsxs("div", { className: styles.serviceFooter, children: [_jsx("strong", { className: styles.price, children: formatarPreco(service) }), _jsx(Link, { className: styles.primaryLink, href: `/servicos/${service.id}`, children: "Ver detalhes" })] })] }, service.id))) })) : _jsx("p", { className: styles.empty, children: "Este prestador ainda n\u00E3o tem servi\u00E7os publicados." })] }), _jsxs("div", { className: styles.detailColumns, children: [_jsxs("section", { className: styles.section, "aria-labelledby": "horario-prestador", children: [_jsx("div", { className: styles.sectionHeader, children: _jsx("h2", { id: "horario-prestador", children: "Disponibilidade semanal" }) }), availability.length ? (_jsx("ul", { className: styles.scheduleList, children: availability.map((slot) => (_jsxs("li", { children: [_jsx("strong", { children: diasSemana[slot.weekday] ?? "Dia não indicado" }), _jsxs("span", { children: [slot.start_time.slice(0, 5), "\u2013", slot.end_time.slice(0, 5)] })] }, slot.id))) })) : _jsx("p", { className: styles.empty, children: "O prestador ainda n\u00E3o publicou hor\u00E1rios semanais. Envia um pedido para combinar a disponibilidade." })] }), _jsxs("section", { className: styles.section, "aria-labelledby": "avaliacoes-prestador", children: [_jsx("div", { className: styles.sectionHeader, children: _jsx("h2", { id: "avaliacoes-prestador", children: "Avalia\u00E7\u00F5es de clientes" }) }), reviews.length ? (_jsx("ul", { className: styles.reviewList, children: reviews.slice(0, 6).map((review) => (_jsxs("li", { className: styles.reviewCard, children: [_jsxs("div", { className: styles.reviewTop, children: [_jsx("strong", { children: "Cliente verificado" }), _jsx("time", { dateTime: review.created_at, children: formatarData(review.created_at) })] }), _jsxs("span", { className: styles.reviewRating, "aria-label": `${review.rating} em 5 estrelas`, children: ["★".repeat(review.rating), "☆".repeat(5 - review.rating)] }), _jsx("p", { children: review.comment || "O cliente deixou uma avaliação sem comentário." })] }, review.id))) })) : _jsx("p", { className: styles.empty, children: "Este prestador ainda n\u00E3o recebeu avalia\u00E7\u00F5es." })] })] })] }));
}
export function ProviderDetails({ providerId }) {
    const [dados, definirDados] = useState(null);
    const [erro, definirErro] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        const consulta = new URLSearchParams({ provider: providerId });
        const consultaReviews = new URLSearchParams({ provider_id: providerId, page: "1" });
        Promise.all([
            requisitarJson(`/api/public/providers/${providerId}/`, { signal: controller.signal }),
            requisitarJson(`/api/public/services/?${consulta}`, { signal: controller.signal }),
            requisitarJson("/api/public/categories/", { signal: controller.signal }),
            requisitarJson(`/api/public/reviews/?${consultaReviews}`, { signal: controller.signal }),
            requisitarJson(`/api/public/availability/?${consulta}`, { signal: controller.signal }),
        ])
            .then(([provider, servicePage, categoryPage, reviewPage, availabilityPage]) => {
            definirDados({
                provider,
                services: servicePage.results,
                categories: categoryPage.results,
                reviews: reviewPage.results,
                availability: availabilityPage.results,
            });
        })
            .catch((falha) => {
            if (controller.signal.aborted)
                return;
            definirErro(falha instanceof ApiRequestError ? falha.message : "Tenta novamente dentro de alguns instantes.");
        });
        return () => controller.abort();
    }, [providerId]);
    return (_jsxs("main", { className: styles.page, children: [_jsx(CabecalhoMarketplace, {}), _jsxs("div", { className: styles.content, children: [_jsx(Link, { className: styles.breadcrumb, href: "/explorar", children: "\u2190 Voltar ao marketplace" }), erro ? _jsx(EstadoErro, { mensagem: erro }) : dados ? (_jsxs(_Fragment, { children: [_jsx(ListingViewTracker, { listingType: "PROVIDER", listingId: dados.provider.id }), _jsx(PerfilPrestador, { dados: dados })] })) : _jsx(EstadoCarregamento, { texto: "A carregar perfil, servi\u00E7os e avalia\u00E7\u00F5es\u2026" })] })] }));
}
export function ServiceDetails({ serviceId }) {
    const [service, definirService] = useState(null);
    const [provider, definirProvider] = useState(null);
    const [categoryName, definirCategoryName] = useState("");
    const [availability, definirAvailability] = useState([]);
    const [erro, definirErro] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        requisitarJson(`/api/public/services/${serviceId}/`, { signal: controller.signal })
            .then(async (serviceData) => {
            const consulta = new URLSearchParams({ provider: String(serviceData.provider_id) });
            const [providerData, categories, schedule] = await Promise.all([
                requisitarJson(`/api/public/providers/${serviceData.provider_id}/`, { signal: controller.signal }),
                requisitarJson("/api/public/categories/", { signal: controller.signal }),
                requisitarJson(`/api/public/availability/?${consulta}`, { signal: controller.signal }),
            ]);
            if (controller.signal.aborted)
                return;
            definirService(serviceData);
            definirProvider(providerData);
            definirCategoryName(categories.results.find((category) => category.id === serviceData.category)?.name ?? "Serviço profissional");
            definirAvailability(schedule.results);
        })
            .catch((falha) => {
            if (controller.signal.aborted)
                return;
            definirErro(falha instanceof ApiRequestError ? falha.message : "Tenta novamente dentro de alguns instantes.");
        });
        return () => controller.abort();
    }, [serviceId]);
    return (_jsxs("main", { className: styles.page, children: [_jsx(CabecalhoMarketplace, {}), _jsxs("div", { className: styles.content, children: [_jsx(Link, { className: styles.breadcrumb, href: "/explorar", children: "\u2190 Voltar ao marketplace" }), erro ? _jsx(EstadoErro, { mensagem: erro }) : service && provider ? (_jsxs(_Fragment, { children: [_jsx(ListingViewTracker, { listingType: "SERVICE", listingId: service.id }), _jsxs("section", { className: styles.serviceHero, children: [_jsx("p", { className: styles.eyebrow, children: categoryName }), _jsx("h1", { children: service.name }), _jsx("p", { className: styles.serviceDescription, children: service.description || "Fala com o prestador para conhecer os detalhes deste serviço." }), _jsxs("div", { className: styles.serviceHeroFooter, children: [_jsx("strong", { className: styles.price, children: formatarPreco(service) }), service.duration_minutes && _jsxs("span", { children: ["Dura\u00E7\u00E3o prevista: ", service.duration_minutes, " min"] })] }), _jsx(Link, { className: styles.primaryLink, href: criarUrlPedido(service, provider), children: "Pedir este servi\u00E7o" })] }), _jsxs("section", { className: styles.providerSummary, children: [_jsx("div", { className: styles.providerAvatar, "aria-hidden": "true", children: provider.commercial_name.slice(0, 1).toLocaleUpperCase("pt-AO") }), _jsxs("div", { children: [_jsx("p", { className: styles.eyebrow, children: "Prestador verificado" }), _jsx("h2", { children: provider.commercial_name }), _jsx("p", { children: provider.description || "Profissional verificado na comunidade Conect Services." }), _jsxs("span", { className: styles.summaryRating, children: ["\u2605 ", provider.average_rating ?? "Novo", " \u00B7 ", provider.review_count, " ", provider.review_count === 1 ? "avaliação" : "avaliações"] })] }), _jsx(Link, { className: styles.secondaryLink, href: `/prestadores/${provider.id}`, children: "Ver perfil completo" })] }), _jsxs("section", { className: styles.section, "aria-labelledby": "horario-servico", children: [_jsx("div", { className: styles.sectionHeader, children: _jsx("h2", { id: "horario-servico", children: "Disponibilidade semanal" }) }), availability.length ? (_jsx("ul", { className: styles.scheduleList, children: availability.map((slot) => _jsxs("li", { children: [_jsx("strong", { children: diasSemana[slot.weekday] ?? "Dia não indicado" }), _jsxs("span", { children: [slot.start_time.slice(0, 5), "\u2013", slot.end_time.slice(0, 5)] })] }, slot.id)) })) : _jsx("p", { className: styles.empty, children: "A disponibilidade \u00E9 combinada diretamente com o prestador." })] })] })) : _jsx(EstadoCarregamento, { texto: "A carregar detalhes do servi\u00E7o\u2026" })] })] }));
}

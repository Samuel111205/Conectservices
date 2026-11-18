"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Image from "@/lib/image";
import Link from "@/lib/link";
import { usePathname, useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Bell, BriefcaseBusiness, ClipboardList, Compass, Heart, Home, LogOut, MessageCircle, Package, Plus, Settings, UserRound, } from "lucide-react";
import { readActiveArea, rememberActiveArea } from "@/lib/active-area";
import NotificationCenter from "./notification-center";
import styles from "./auth.module.css";
async function carregarIdentidade(url) {
    const response = await fetchApi(url, { cache: "no-store" });
    if (response.status === 404)
        return null;
    if (!response.ok) {
        throw new Error(`Não foi possível carregar os dados do perfil (${response.status}).`);
    }
    return response.json();
}
const navigationPorArea = {
    client: [
        { href: "/conta", label: "Dashboard", icon: Home },
        { href: "/explorar", label: "Explorar serviços", icon: Compass },
        { href: "/favoritos", label: "Favoritos", icon: Heart },
        { href: "/pedidos", label: "Meus pedidos", icon: ClipboardList },
        { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
        { href: "#notifications", label: "Notificações", icon: Bell },
        { href: "/perfil", label: "Perfil", icon: UserRound },
        { href: "/perfil#profile-settings", label: "Definições", icon: Settings },
        { href: "/contratacoes", label: "Contratações", icon: BriefcaseBusiness },
    ],
    provider: [
        { href: "/prestador", label: "Dashboard", icon: Home },
        { href: "/prestador/pedidos", label: "Explorar pedidos", icon: Compass },
        { href: "/prestador/servicos", label: "Serviços", icon: ClipboardList },
        { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
        { href: "#notifications", label: "Notificações", icon: Bell },
        { href: "/contratacoes", label: "Contratações", icon: BriefcaseBusiness },
        { href: "/perfil", label: "Perfil profissional", icon: UserRound },
        { href: "/perfil#profile-settings", label: "Definições", icon: Settings },
    ],
    company: [
        { href: "/empresa", label: "Dashboard", icon: Home },
        { href: "/empresa#perfil-empresa", label: "Perfil da empresa", icon: BriefcaseBusiness },
        { href: "/prestador/servicos", label: "Serviços publicados", icon: ClipboardList },
        { href: "/empresa/produtos", label: "Produtos", icon: Package },
        { href: "/empresa/encomendas", label: "Pedidos recebidos", icon: ClipboardList },
        { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
        { href: "#notifications", label: "Notificações", icon: Bell },
        { href: "/perfil#profile-settings", label: "Definições", icon: Settings },
        { href: "/contratacoes", label: "Contratações", icon: BriefcaseBusiness },
    ],
};
const labelsMovel = {
    Dashboard: "Início",
    "Explorar serviços": "Explorar",
    "Meus pedidos": "Pedidos",
    Contratações: "Contratos",
    "Explorar pedidos": "Pedidos",
    "Perfil profissional": "Perfil",
    "Perfil da empresa": "Empresa",
    "Pedidos recebidos": "Encomendas",
};
export default function EstruturaAutenticacao({ children, account = false, profileName, area, }) {
    const router = useRouter();
    const pathname = usePathname();
    const paginaLogin = pathname === "/entrar";
    const areaAtual = area ?? (pathname.startsWith("/empresa") ? "company"
        : pathname.startsWith("/prestador") ? "provider"
            : pathname === "/contratacoes" || pathname === "/mensagens"
                ? readActiveArea() ?? "client"
                : "client");
    const providerArea = areaAtual === "provider" || areaAtual === "company";
    const companyArea = areaAtual === "company";
    const itemsDaArea = navigationPorArea[areaAtual];
    const atalhosProfissionais = [
        {
            href: "/prestador/pedidos",
            label: "Encontrar pedidos",
            description: "Descobre oportunidades na tua zona.",
            icon: Compass,
        },
        {
            href: "/prestador/servicos",
            label: "Gerir serviços",
            description: "Mantém o teu catálogo atualizado.",
            icon: ClipboardList,
        },
        {
            href: "/perfil",
            label: "Perfil e verificação",
            description: "Revê a apresentação da tua atividade.",
            icon: UserRound,
        },
    ];
    const atalhosEmpresa = [
        {
            href: "/empresa",
            label: "Perfil empresarial",
            description: "Atualiza os dados comerciais da empresa.",
            icon: BriefcaseBusiness,
        },
        {
            href: "/empresa/produtos",
            label: "Gerir produtos",
            description: "Atualiza preços e stock do catálogo.",
            icon: Package,
        },
        {
            href: "/empresa/encomendas",
            label: "Encomendas recebidas",
            description: "Revê e responde aos pedidos de compra.",
            icon: ClipboardList,
        },
    ];
    const atalhosCliente = [
        {
            href: "/pedidos/novo",
            label: "Pedir um serviço",
            description: "Conta o que precisas e recebe propostas.",
            icon: Plus,
        },
        {
            href: "/perfil",
            label: "Completar perfil",
            description: "Ajuda os profissionais a conhecerem-te.",
            icon: UserRound,
        },
        {
            href: "/prestador",
            label: "Área profissional",
            description: "Gere serviços e propostas.",
            icon: BriefcaseBusiness,
        },
    ];
    const [aTerminarSessao, definirTerminoSessao] = useState(false);
    const [erroSessao, definirErroSessao] = useState("");
    const [perfilIdentidade, definirPerfilIdentidade] = useState(null);
    const [prestadorIdentidade, definirPrestadorIdentidade] = useState(null);
    const [empresaIdentidade, definirEmpresaIdentidade] = useState(null);
    const [erroPerfilIdentidade, definirErroPerfilIdentidade] = useState("");
    const [imagemPerfilFalhou, definirImagemPerfilFalhou] = useState(false);
    useEffect(() => {
        if (!account)
            return;
        let active = true;
        Promise.all([
            carregarIdentidade("/api/auth/profiles/me/"),
            providerArea
                ? carregarIdentidade("/api/auth/providers/me/")
                : Promise.resolve(null),
            companyArea
                ? carregarIdentidade("/api/auth/businesses/me/")
                : Promise.resolve(null),
        ])
            .then(([profile, provider, company]) => {
            if (!active)
                return;
            definirPerfilIdentidade(profile);
            definirPrestadorIdentidade(provider);
            definirEmpresaIdentidade(company);
        })
            .catch(() => {
            if (active) {
                definirErroPerfilIdentidade("Não foi possível carregar os dados do perfil.");
            }
        });
        return () => {
            active = false;
        };
    }, [account, companyArea, providerArea]);
    const nomeExibido = companyArea
        ? empresaIdentidade?.commercial_name
            || profileName?.trim()
            || perfilIdentidade?.full_name
            || "Área da empresa"
        : providerArea
            ? prestadorIdentidade?.commercial_name
                || profileName?.trim()
                || perfilIdentidade?.full_name
                || "Área profissional"
            : perfilIdentidade?.full_name
                || profileName?.trim()
                || "Área do cliente";
    const imagemPerfil = companyArea
        ? empresaIdentidade?.logo
        : perfilIdentidade?.photo;
    const iniciais = nomeExibido.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toLocaleUpperCase("pt-AO");
    useEffect(() => {
        definirImagemPerfilFalhou(false);
    }, [imagemPerfil]);
    useEffect(() => {
        if (companyArea)
            rememberActiveArea("company");
        else if (providerArea)
            rememberActiveArea("provider");
        else if (pathname === "/conta")
            rememberActiveArea("client");
    }, [pathname, providerArea]);
    const brand = (_jsxs(Link, { className: styles.brand, href: companyArea ? "/empresa" : providerArea ? "/prestador" : account ? "/conta" : "/", "aria-label": "Conect Services \u2014 in\u00EDcio", children: [_jsx("span", { className: styles.brandMark, "aria-hidden": "true", children: "C" }), _jsxs("span", { className: styles.brandWord, children: ["conect", _jsx("span", { children: "." }), _jsx("small", { children: "services" })] })] }));
    if (!account) {
        return (_jsx("main", { className: `${styles.page} ${styles.authPage} ${paginaLogin ? styles.loginPage : ""}`, children: _jsxs("div", { className: styles.authLayout, children: [_jsxs("section", { className: `${styles.authShowcase} ${paginaLogin ? styles.loginShowcase : ""}`, children: [paginaLogin && (_jsxs("div", { className: styles.loginOrbs, "aria-hidden": "true", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] })), brand, _jsxs("div", { className: `${styles.authShowcaseCopy} ${paginaLogin ? styles.loginShowcaseCopy : ""}`, children: [_jsx("p", { children: "Conect Services" }), _jsx("h2", { children: "Conectando pessoas, empresas e servi\u00E7os em Angola." }), _jsx("span", { children: "Encontra servi\u00E7os e profissionais de confian\u00E7a, ou faz o teu neg\u00F3cio chegar a novos clientes." })] }), _jsxs("ul", { children: [_jsxs("li", { children: [_jsx("span", { children: "\u2713" }), " Encontra servi\u00E7os e profissionais"] }), _jsxs("li", { children: [_jsx("span", { children: "\u2713" }), " Divulga o teu neg\u00F3cio"] }), _jsxs("li", { children: [_jsx("span", { children: "\u2713" }), " Conecta-te com clientes"] })] }), _jsxs("div", { className: `${styles.authShowcaseFooter} ${paginaLogin ? styles.loginShowcaseFooter : ""}`, children: [_jsx("small", { children: "Conectando o mundo, movendo o futuro." }), paginaLogin && (_jsxs("span", { className: styles.loginPhotoCredit, children: ["Fotografia:", " ", _jsx("a", { href: "https://commons.wikimedia.org/wiki/File:Luanda_Skyline_-_Angola_2015_(cropped).jpg", target: "_blank", rel: "noreferrer", children: "David Stanley" }), " · ", _jsx("a", { href: "https://creativecommons.org/licenses/by/2.0/", target: "_blank", rel: "noreferrer", children: "CC BY 2.0" })] }))] })] }), _jsx("section", { className: `${styles.authFormPane} ${paginaLogin ? styles.loginFormPane : ""}`, children: _jsxs("div", { className: `${styles.authFormInner} ${paginaLogin ? styles.loginFormInner : ""}`, children: [_jsx("div", { className: styles.authMobileBrand, children: brand }), children, _jsx(Link, { className: styles.homeLink, href: "/", children: "Voltar \u00E0 p\u00E1gina inicial" })] }) })] }) }));
    }
    const nav = (mobile = false) => (_jsx("nav", { className: mobile ? styles.mobileNav : styles.workspaceNav, "aria-label": mobile ? "Navegação móvel" : "Navegação da área pessoal", children: (mobile
            ? areaAtual === "client"
                ? [itemsDaArea[0], itemsDaArea[1], itemsDaArea[3], itemsDaArea[8], itemsDaArea[4], itemsDaArea[6]]
                : areaAtual === "provider"
                    ? [itemsDaArea[0], itemsDaArea[1], itemsDaArea[2], itemsDaArea[5], itemsDaArea[3], itemsDaArea[6]]
                    : [itemsDaArea[0], itemsDaArea[1], itemsDaArea[3], itemsDaArea[4], itemsDaArea[5], itemsDaArea[8]]
            : itemsDaArea).map((item) => {
            const hrefPath = item.href.split("#")[0];
            const ativo = item.href.includes("#")
                ? false
                : hrefPath === "/conta"
                    ? pathname === hrefPath
                    : pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
            const Icon = item.icon;
            return (_jsxs(Link, { href: item.href, className: styles.workspaceLink, "aria-current": ativo ? "page" : undefined, onClick: () => {
                    if (item.href === "/conta")
                        rememberActiveArea("client");
                    if (item.href.startsWith("/prestador"))
                        rememberActiveArea("provider");
                }, children: [_jsx("span", { className: `${styles.navLetter} shrink-0`, "aria-hidden": "true", children: _jsx(Icon, { size: 18, strokeWidth: 1.8 }) }), _jsx("span", { children: mobile ? labelsMovel[item.label] ?? item.label : item.label })] }, `${item.href}-${item.label}`));
        }) }));
    async function terminarSessao() {
        definirTerminoSessao(true);
        definirErroSessao("");
        try {
            const resposta = await fetchApi("/api/auth/logout/", { method: "POST" });
            if (!resposta.ok) {
                const dados = await resposta.json().catch(() => null);
                const detalhe = dados && typeof dados === "object" && "detail" in dados
                    && typeof dados.detail === "string" ? dados.detail : "";
                definirErroSessao(detalhe || "Não foi possível terminar a sessão. Tenta novamente.");
                return;
            }
            router.replace("/");
        }
        catch {
            definirErroSessao("Não foi possível contactar o serviço para terminar a sessão.");
        }
        finally {
            definirTerminoSessao(false);
        }
    }
    return (_jsxs("main", { className: `${styles.page} ${styles.workspacePage} antialiased`, children: [_jsx("header", { className: styles.workspaceHeader, children: _jsxs("div", { className: styles.workspaceHeaderInner, children: [_jsxs("div", { className: styles.workspaceGreeting, children: [_jsx("span", { children: "\u00C1rea de trabalho" }), _jsx("strong", { children: companyArea ? "Painel da empresa" : providerArea ? "Painel do prestador" : "Painel do cliente" })] }), _jsxs("div", { className: styles.workspaceHeaderActions, children: [_jsx(Link, { href: providerArea ? "/conta" : "/prestador", onClick: () => rememberActiveArea(providerArea ? "client" : "provider"), children: providerArea ? "Área de cliente" : "Área profissional" }), _jsx("span", { id: "notifications", children: _jsx(NotificationCenter, {}) }), _jsx(Link, { href: providerArea ? "/prestador/pedidos" : "/explorar", children: providerArea ? "Ver oportunidades" : "Descobrir serviços" }), _jsx(Link, { href: "/mensagens", children: "Mensagens" }), _jsxs(Link, { className: styles.createAction, href: companyArea ? "/empresa/produtos#formulario-produto" : providerArea ? "/prestador/servicos#formulario-servico" : "/pedidos/novo", children: [_jsx(Plus, { size: 16, "aria-hidden": "true" }), " ", companyArea ? "Adicionar produto" : providerArea ? "Adicionar serviço" : "Pedir serviço"] })] })] }) }), _jsxs("div", { className: `${styles.workspaceLayout} ${styles[`workspaceArea_${areaAtual}`]}`, children: [_jsxs("aside", { className: styles.workspaceSidebar, children: [brand, _jsxs("div", { className: styles.sidebarProfile, children: [imagemPerfil && !imagemPerfilFalhou ? (_jsx(Image, { className: styles.sidebarAvatar, src: imagemPerfil, alt: `Imagem de perfil de ${nomeExibido}`, width: 38, height: 38, unoptimized: true, onError: () => definirImagemPerfilFalhou(true) })) : (_jsx("span", { className: styles.sidebarAvatar, "aria-hidden": "true", children: iniciais || "C" })), _jsxs("span", { className: styles.sidebarProfileDetails, children: [_jsx("strong", { children: nomeExibido }), _jsx("small", { className: "truncate", children: companyArea ? "Empresa" : providerArea ? "Prestador" : "Cliente" })] })] }), erroPerfilIdentidade && _jsx("p", { className: styles.sidebarProfileError, role: "status", children: erroPerfilIdentidade }), _jsx("p", { className: styles.sidebarCaption, children: companyArea ? "Gestão da empresa" : providerArea ? "Gestão profissional" : "Menu principal" }), nav(), _jsxs(Link, { className: styles.sidebarCreate, href: companyArea ? "/empresa/produtos#formulario-produto" : providerArea ? "/prestador/servicos#formulario-servico" : "/pedidos/novo", children: [_jsx("span", { "aria-hidden": "true", children: "\uFF0B" }), " ", companyArea ? "Adicionar produto" : providerArea ? "Adicionar serviço" : "Pedir um serviço"] }), _jsxs("div", { className: styles.sidebarNote, children: [_jsx("span", { className: styles.sidebarNoteMark, "aria-hidden": "true", children: "\u2726" }), _jsx("strong", { children: providerArea
                                            ? "Novos pedidos podem ser oportunidades para ti."
                                            : "O próximo serviço pode começar com uma conversa." }), _jsxs(Link, { href: providerArea ? "/prestador/pedidos" : "/explorar", children: [providerArea ? "Ver pedidos disponíveis" : "Encontrar profissionais", " ", _jsx("span", { "aria-hidden": "true", children: "\u2192" })] })] }), _jsxs("div", { className: styles.sidebarBottom, children: [erroSessao && _jsx("p", { className: styles.sidebarError, role: "alert", children: erroSessao }), _jsxs("button", { type: "button", onClick: () => void terminarSessao(), disabled: aTerminarSessao, children: [_jsx(LogOut, { size: 17, "aria-hidden": "true" }), aTerminarSessao ? "A terminar sessão…" : "Sair"] })] })] }), _jsx("div", { className: styles.workspaceMain, children: _jsx("section", { className: `${styles.card} ${styles.accountCard}`, children: children }) }), _jsxs("aside", { className: styles.workspaceAside, "aria-label": "Atalhos", children: [_jsxs("section", { className: styles.asideCard, children: [_jsxs("div", { className: styles.asideHeading, children: [_jsx("p", { className: styles.sidebarCaption, children: "Come\u00E7a por aqui" }), _jsx("span", { children: "Atalhos para chegares mais depressa ao que precisas." })] }), (companyArea
                                        ? atalhosEmpresa
                                        : providerArea
                                            ? atalhosProfissionais
                                            : atalhosCliente).map((atalho) => {
                                        const Icon = atalho.icon;
                                        return (_jsxs(Link, { className: styles.asideLink, href: atalho.href, children: [_jsx("span", { className: styles.asideLinkIcon, "aria-hidden": "true", children: _jsx(Icon, { size: 16, strokeWidth: 1.8 }) }), _jsxs("span", { className: styles.asideLinkCopy, children: [_jsx("strong", { children: atalho.label }), _jsx("span", { children: atalho.description })] }), _jsx(ArrowUpRight, { className: styles.asideLinkArrow, size: 15, "aria-hidden": "true" })] }, atalho.href));
                                    }), providerArea && !companyArea && (_jsxs(_Fragment, { children: [_jsx("p", { className: styles.asideGroupTitle, children: "Tamb\u00E9m na tua empresa" }), atalhosEmpresa.map((atalho) => {
                                                const Icon = atalho.icon;
                                                return (_jsxs(Link, { className: styles.asideLink, href: atalho.href, children: [_jsx("span", { className: styles.asideLinkIcon, "aria-hidden": "true", children: _jsx(Icon, { size: 16, strokeWidth: 1.8 }) }), _jsxs("span", { className: styles.asideLinkCopy, children: [_jsx("strong", { children: atalho.label }), _jsx("span", { children: atalho.description })] }), _jsx(ArrowUpRight, { className: styles.asideLinkArrow, size: 15, "aria-hidden": "true" })] }, atalho.href));
                                            })] }))] }), !providerArea && (_jsxs("section", { className: styles.promoCard, children: [_jsx("span", { children: "Conect para empresas" }), _jsx("strong", { children: "Divulgue o seu neg\u00F3cio" }), _jsx("p", { children: "Encontre novos clientes e mostre os seus servi\u00E7os a toda a comunidade." }), _jsxs(Link, { href: "/empresa", children: ["Saiba mais ", _jsx("span", { "aria-hidden": "true", children: "\u2192" })] })] })), _jsx("p", { className: styles.workspaceFootnote, children: "Uma comunidade de servi\u00E7os feita para Angola." })] })] }), nav(true)] }));
}

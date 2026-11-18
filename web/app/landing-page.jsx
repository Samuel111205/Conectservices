"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import Link from "@/lib/link";
import { requisitarJson } from "@/lib/api-client";
import BusinessLogo from "@/app/components/business-logo";
import { DirectorySection } from "./directory-page";
import styles from "./page.module.css";
const filtrosIniciais = {
    search: "",
    category: "",
    municipality: "",
    ordering: "-rating",
    page: 1,
};
const imagensFundoHero = [
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1800&q=80",
];
const categoriasSugeridas = [
    {
        name: "Tecnologia e informática",
        description: "Suporte e soluções digitais",
    },
    {
        name: "Construção e reparações",
        description: "Obras, manutenção e assistência",
    },
    {
        name: "Saúde e bem-estar",
        description: "Cuidados para si e para a família",
    },
    {
        name: "Beleza e estética",
        description: "Cuidados pessoais e beleza",
    },
    {
        name: "Transporte e logística",
        description: "Entregas, mudanças e transporte",
    },
    {
        name: "Educação e formação",
        description: "Aulas, explicações e cursos",
    },
    {
        name: "Limpeza",
        description: "Soluções para casa e escritório",
    },
    {
        name: "Consultoria e serviços empresariais",
        description: "Apoio especializado para negócios",
    },
];
const iconesCategoria = ["♡", "✂", "⚒", "▣", "➜", "♨", "▱", "⌂", "✦", "⋯"];
async function obterDadosApi(endpoint, parametros) {
    const consulta = parametros?.toString();
    const recurso = endpoint.replace(/^\/+|\/+$/g, "");
    return requisitarJson(`/api/public/${recurso}${consulta ? `?${consulta}` : ""}`);
}
function Icone({ name, size = 20, }) {
    const atributosSvg = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true,
    };
    if (name === "search") {
        return (_jsxs("svg", { ...atributosSvg, children: [_jsx("circle", { cx: "11", cy: "11", r: "7" }), _jsx("path", { d: "m20 20-4-4" })] }));
    }
    if (name === "pin") {
        return (_jsxs("svg", { ...atributosSvg, children: [_jsx("path", { d: "M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" }), _jsx("circle", { cx: "12", cy: "10", r: "2.5" })] }));
    }
    if (name === "arrow") {
        return (_jsx("svg", { ...atributosSvg, children: _jsx("path", { d: "M5 12h14M13 6l6 6-6 6" }) }));
    }
    if (name === "spark") {
        return (_jsxs("svg", { ...atributosSvg, children: [_jsx("path", { d: "m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" }), _jsx("path", { d: "m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" })] }));
    }
    if (name === "briefcase") {
        return (_jsxs("svg", { ...atributosSvg, children: [_jsx("rect", { x: "3", y: "7", width: "18", height: "13", rx: "2" }), _jsx("path", { d: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18m-11 0v2h4v-2" })] }));
    }
    return (_jsx("svg", { ...atributosSvg, children: _jsx("path", { d: "M4 7h16M4 12h16M4 17h16" }) }));
}
function formatarContagemAvaliacoes(quantidade) {
    if (quantidade === 1)
        return "1 avaliação";
    return `${quantidade} avaliações`;
}
export default function PaginaInicial({ appMode = false }) {
    const [filtros, definirFiltros] = useState(filtrosIniciais);
    const [textoPesquisa, definirTextoPesquisa] = useState("");
    const [prestadores, definirPrestadores] = useState([]);
    const [quantidadePrestadores, definirQuantidadePrestadores] = useState(0);
    const [temProximaPagina, definirProximaPagina] = useState(false);
    const [temPaginaAnterior, definirPaginaAnterior] = useState(false);
    const [estaCarregando, definirCarregamento] = useState(true);
    const [erroNaPesquisa, definirErroNaPesquisa] = useState("");
    const [categorias, definirCategorias] = useState([]);
    const [municipios, definirMunicipios] = useState([]);
    const [erroNosFiltros, definirErroNosFiltros] = useState("");
    const [tentativaFiltros, definirTentativaFiltros] = useState(0);
    const [menuMovelAberto, definirMenuMovelAberto] = useState(false);
    const [tentativas, definirTentativas] = useState(0);
    const [indiceImagemHero, definirIndiceImagemHero] = useState(0);
    useEffect(() => {
        const temporizador = window.setInterval(() => {
            definirIndiceImagemHero((atual) => (atual + 1) % imagensFundoHero.length);
        }, 5_000);
        return () => window.clearInterval(temporizador);
    }, []);
    useEffect(() => {
        let ativo = true;
        const parametros = new URLSearchParams({
            audience: "providers",
            ordering: filtros.ordering,
            page: String(filtros.page),
        });
        if (filtros.search)
            parametros.set("search", filtros.search);
        if (filtros.category)
            parametros.set("category", filtros.category);
        if (filtros.municipality)
            parametros.set("municipality", filtros.municipality);
        obterDadosApi("/providers/discover/", parametros)
            .then((pagina) => {
            if (!ativo)
                return;
            definirPrestadores(pagina.results);
            definirQuantidadePrestadores(pagina.count);
            definirProximaPagina(Boolean(pagina.next));
            definirPaginaAnterior(Boolean(pagina.previous));
            definirErroNaPesquisa("");
        })
            .catch((erro) => {
            if (!ativo)
                return;
            definirErroNaPesquisa(erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os prestadores.");
            definirPrestadores([]);
            definirQuantidadePrestadores(0);
        })
            .finally(() => {
            if (ativo)
                definirCarregamento(false);
        });
        return () => {
            ativo = false;
        };
    }, [filtros, tentativas]);
    useEffect(() => {
        let ativo = true;
        async function carregarFiltros() {
            try {
                const [paginaCategorias, paginaMunicipios] = await Promise.all([
                    obterDadosApi("/categories/", new URLSearchParams({ parent: "null" })),
                    obterDadosApi("/municipalities/"),
                ]);
                if (ativo) {
                    definirErroNosFiltros("");
                    definirCategorias(paginaCategorias.results);
                    definirMunicipios(paginaMunicipios.results);
                    const municipioLuanda = paginaMunicipios.results.find((municipio) => municipio.name.trim().toLocaleLowerCase("pt-AO") === "luanda");
                    if (municipioLuanda) {
                        definirFiltros((atual) => atual.municipality
                            ? atual
                            : { ...atual, municipality: String(municipioLuanda.id) });
                    }
                }
            }
            catch {
                if (ativo) {
                    definirErroNosFiltros("Alguns filtros não estão disponíveis neste momento.");
                }
            }
        }
        void carregarFiltros();
        return () => {
            ativo = false;
        };
    }, [tentativaFiltros]);
    function enviarPesquisa(evento) {
        evento.preventDefault();
        definirCarregamento(true);
        definirErroNaPesquisa("");
        definirFiltros((atual) => ({
            ...atual,
            search: textoPesquisa.trim(),
            page: 1,
        }));
    }
    function atualizarFiltro(chave, valor) {
        definirCarregamento(true);
        definirErroNaPesquisa("");
        definirFiltros((atual) => ({ ...atual, [chave]: valor, page: 1 }));
    }
    function selecionarCategoria(idCategoria) {
        atualizarFiltro("category", filtros.category === idCategoria ? "" : idCategoria);
        document.getElementById("prestadores")?.scrollIntoView({ behavior: "smooth" });
    }
    function pesquisarCategoriaSugerida(nomeCategoria) {
        definirTextoPesquisa(nomeCategoria);
        definirCarregamento(true);
        definirErroNaPesquisa("");
        definirFiltros((atual) => ({
            ...atual,
            search: nomeCategoria,
            category: "",
            page: 1,
        }));
        document.getElementById("prestadores")?.scrollIntoView({ behavior: "smooth" });
    }
    const nomeCategoriaSelecionada = categorias.find((categoria) => String(categoria.id) === filtros.category)?.name;
    const nomeMunicipioSelecionado = municipios.find((municipio) => String(municipio.id) === filtros.municipality)?.name;
    const temFiltrosAtivos = Boolean(filtros.search || filtros.category || filtros.municipality);
    const categoriasVisiveis = categorias.length
        ? categorias.slice(0, 10)
        : categoriasSugeridas;
    function limparFiltros() {
        definirTextoPesquisa("");
        definirCarregamento(true);
        definirErroNaPesquisa("");
        definirFiltros((atual) => ({
            ...atual,
            search: "",
            category: "",
            municipality: "",
            page: 1,
        }));
    }
    return (_jsx("main", { className: styles.site, children: _jsx("div", { className: styles.homeShell, children: _jsxs("div", { className: styles.primaryColumn, children: [_jsxs("header", { className: styles.header, children: [_jsxs(Link, { className: styles.brand, href: appMode ? "/conta" : "/", "aria-label": "Conect Services \u2014 in\u00EDcio", children: [_jsx("span", { className: styles.brandMark, "aria-hidden": "true", children: "C" }), _jsxs("span", { className: styles.brandName, children: ["Conect ", _jsx("span", { className: styles.brandAccent, children: "Services" }), _jsx("small", { children: "Conectando o mundo, movendo o futuro." })] })] }), _jsxs("nav", { className: `${styles.navigation} ${menuMovelAberto ? styles.navigationOpen : ""}`, "aria-label": "Navega\u00E7\u00E3o principal", children: [_jsx("a", { href: "#inicio", onClick: () => definirMenuMovelAberto(false), children: "In\u00EDcio" }), _jsx("a", { href: "#categorias", onClick: () => definirMenuMovelAberto(false), children: "Servi\u00E7os" }), _jsx(Link, { href: "/produtos", onClick: () => definirMenuMovelAberto(false), children: "Produtos" }), _jsx("a", { href: "#empresas", onClick: () => definirMenuMovelAberto(false), children: "Empresas" }), _jsx("a", { href: "#prestadores", onClick: () => definirMenuMovelAberto(false), children: "Profissionais" }), _jsx("a", { href: "#empreendedores", onClick: () => definirMenuMovelAberto(false), children: "Empreendedores" }), _jsx("a", { href: "#como-funciona", onClick: () => definirMenuMovelAberto(false), children: "Como funciona" }), _jsx("a", { href: "#sobre", onClick: () => definirMenuMovelAberto(false), children: "Sobre n\u00F3s" })] }), _jsx("div", { className: styles.headerActions, children: appMode ? (_jsx(Link, { className: styles.headerSearchButton, href: "/conta", children: "A minha \u00E1rea" })) : (_jsxs(_Fragment, { children: [_jsx(Link, { className: styles.headerLogin, href: "/entrar", children: "Entrar" }), _jsx(Link, { className: styles.headerSearchButton, href: "/registar", children: "Criar conta" })] })) }), _jsx("button", { className: styles.menuButton, type: "button", "aria-label": menuMovelAberto ? "Fechar menu" : "Abrir menu", "aria-expanded": menuMovelAberto, onClick: () => definirMenuMovelAberto((open) => !open), children: _jsx(Icone, { name: "menu" }) })] }), _jsxs("section", { className: styles.hero, id: "inicio", children: [_jsx("div", { className: styles.heroBackgrounds, "aria-hidden": "true", children: imagensFundoHero.map((imagem, indice) => (_jsx("div", { className: `${styles.heroBackground} ${indice === indiceImagemHero ? styles.heroBackgroundActive : ""}`, style: { backgroundImage: `url("${imagem}")` } }, imagem))) }), _jsxs("div", { className: styles.heroContent, children: [_jsxs("div", { className: styles.eyebrow, children: [_jsx("span", { className: styles.eyebrowLine }), "Servi\u00E7os locais, liga\u00E7\u00F5es de confian\u00E7a"] }), _jsx("h1", { children: "Encontra os servi\u00E7os de que precisas, num s\u00F3 lugar." }), _jsx("p", { className: styles.heroDescription, children: "Descobre empresas e profissionais em Angola, compara op\u00E7\u00F5es e entra directamente em contacto com quem pode ajudar." }), _jsxs("form", { className: styles.searchPanel, id: "pesquisa", onSubmit: enviarPesquisa, children: [_jsxs("label", { className: styles.searchField, children: [_jsx(Icone, { name: "search", size: 20 }), _jsx("span", { className: styles.visuallyHidden, children: "Que servi\u00E7o procura?" }), _jsx("input", { type: "search", placeholder: "O que voc\u00EA procura?", value: textoPesquisa, onChange: (evento) => definirTextoPesquisa(evento.target.value) })] }), _jsxs("label", { className: styles.searchField, children: [_jsx(Icone, { name: "pin", size: 20 }), _jsx("span", { className: styles.visuallyHidden, children: "Localiza\u00E7\u00E3o" }), _jsxs("select", { value: filtros.municipality, onChange: (evento) => atualizarFiltro("municipality", evento.target.value), children: [_jsx("option", { value: "", children: "Todas as localiza\u00E7\u00F5es" }), municipios.map((municipality) => (_jsx("option", { value: municipality.id, children: municipality.name }, municipality.id)))] })] }), _jsx("button", { className: styles.searchButton, type: "submit", children: "Pesquisar" })] }), erroNosFiltros && (_jsxs("div", { className: styles.filterNotice, role: "status", children: [_jsx("span", { children: erroNosFiltros }), _jsx("button", { type: "button", onClick: () => definirTentativaFiltros((tentativa) => tentativa + 1), children: "Atualizar filtros" })] })), _jsxs("div", { className: styles.searchExamples, children: [_jsx("span", { children: "Pesquisas populares:" }), categoriasSugeridas.slice(0, 6).map((categoria) => (_jsx("button", { type: "button", onClick: () => pesquisarCategoriaSugerida(categoria.name), children: categoria.name.split(" ")[0] }, categoria.name)))] })] }), _jsx("div", { className: styles.heroVisual, children: _jsxs("div", { className: styles.heroFeatureCard, children: [_jsx("span", { className: styles.featureEyebrow, children: "Conect Services" }), _jsx("h2", { children: "Servi\u00E7os mais perto de si" }), _jsxs("ul", { children: [_jsxs("li", { children: [_jsx("span", { children: "\u2713" }), " R\u00E1pido"] }), _jsxs("li", { children: [_jsx("span", { children: "\u2713" }), " Seguro"] }), _jsxs("li", { children: [_jsx("span", { children: "\u2713" }), " Confi\u00E1vel"] })] })] }) })] }), _jsxs("section", { className: styles.categorySection, id: "categorias", children: [_jsxs("div", { className: styles.sectionHeading, children: [_jsxs("div", { children: [_jsx("div", { className: styles.sectionKicker, children: "Explore por categoria" }), _jsx("h2", { children: "O que voc\u00EA precisa hoje?" })] }), _jsxs(Link, { href: "/categorias", className: styles.textLink, children: ["Ver todos ", _jsx(Icone, { name: "arrow", size: 16 })] })] }), _jsx("div", { className: styles.categoryList, children: categoriasVisiveis.map((categoria, index) => {
                                    const idCategoria = "id" in categoria ? String(categoria.id) : "";
                                    const categoriaSelecionada = Boolean(idCategoria) && filtros.category === idCategoria;
                                    return (_jsxs("button", { className: `${styles.categoryCard} ${categoriaSelecionada ? styles.categorySelected : ""}`, type: "button", onClick: () => idCategoria
                                            ? selecionarCategoria(idCategoria)
                                            : pesquisarCategoriaSugerida(categoria.name), children: [_jsx("span", { className: `${styles.categoryIcon} ${styles[`categoryIcon${index % 4}`]}`, "aria-hidden": "true", children: iconesCategoria[index % iconesCategoria.length] }), _jsx("span", { className: styles.categoryName, children: categoria.name })] }, categoria.name));
                                }) })] }), _jsxs("section", { className: styles.providerSection, id: "prestadores", children: [_jsxs("div", { className: styles.sectionHeading, children: [_jsxs("div", { children: [_jsx("div", { className: styles.sectionKicker, children: "Perto de si" }), _jsxs("h2", { children: ["Prestadores de servi\u00E7os", nomeCategoriaSelecionada ? _jsxs("span", { className: styles.titleFilter, children: [" \u00B7 ", nomeCategoriaSelecionada] }) : null] })] }), _jsxs("label", { className: styles.sortLabel, children: ["Ordenar por", _jsxs("select", { value: filtros.ordering, onChange: (evento) => atualizarFiltro("ordering", evento.target.value), children: [_jsx("option", { value: "-rating", children: "Melhor avalia\u00E7\u00E3o" }), _jsx("option", { value: "-services", children: "Mais servi\u00E7os" }), _jsx("option", { value: "name", children: "Nome A\u2013Z" })] })] })] }), temFiltrosAtivos && (_jsxs("div", { className: styles.activeFilters, "aria-live": "polite", children: [_jsxs("div", { className: styles.activeFilterList, children: [_jsx("span", { className: styles.activeFilterLabel, children: "Filtros ativos" }), filtros.search && _jsxs("span", { className: styles.activeFilter, children: ["Pesquisa: \u201C", filtros.search, "\u201D"] }), nomeCategoriaSelecionada && _jsxs("span", { className: styles.activeFilter, children: ["Categoria: ", nomeCategoriaSelecionada] }), nomeMunicipioSelecionado && _jsxs("span", { className: styles.activeFilter, children: ["Localiza\u00E7\u00E3o: ", nomeMunicipioSelecionado] })] }), _jsx("button", { className: styles.clearFiltersButton, type: "button", onClick: limparFiltros, children: "Limpar filtros" })] })), erroNaPesquisa ? (_jsxs("div", { className: styles.statusPanel, role: "alert", children: [_jsx("span", { className: styles.statusIcon, children: "!" }), _jsxs("div", { children: [_jsx("strong", { children: "N\u00E3o foi poss\u00EDvel carregar os prestadores." }), _jsx("p", { children: erroNaPesquisa })] }), _jsx("button", { type: "button", onClick: () => {
                                            definirCarregamento(true);
                                            definirErroNaPesquisa("");
                                            definirTentativas((quantidade) => quantidade + 1);
                                        }, children: "Tentar novamente" })] })) : estaCarregando ? (_jsx("div", { className: styles.loadingGrid, "aria-label": "A carregar prestadores", children: [0, 1, 2, 3].map((item) => _jsxs("div", { className: styles.skeletonCard, children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }, item)) })) : prestadores.length ? (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.providerGrid, children: prestadores.slice(0, 8).map((prestador) => (_jsxs("article", { className: styles.providerCard, children: [_jsxs("div", { className: styles.providerCardHeader, children: [prestador.business_profile ? (_jsx(BusinessLogo, { className: styles.providerAvatarImage, companyName: prestador.commercial_name, logoUrl: prestador.business_profile.logo, width: 52, height: 52 })) : (_jsx("div", { className: styles.providerAvatar, children: prestador.commercial_name.slice(0, 1).toLocaleUpperCase("pt-AO") })), _jsxs("div", { className: styles.providerBadges, children: [prestador.business_profile && _jsx("span", { className: styles.providerType, children: "Empresa" }), prestador.verification_status === "VERIFIED" && (_jsxs("span", { className: styles.providerVerified, children: [_jsx("span", {}), " Verificado"] }))] })] }), _jsx("h3", { children: prestador.commercial_name }), _jsx("p", { className: styles.providerDescription, children: prestador.description || "Prestador de serviços em Angola." }), _jsxs("div", { className: styles.providerStats, children: [_jsxs("span", { className: styles.providerRating, children: [_jsx("span", { "aria-label": "avalia\u00E7\u00E3o m\u00E9dia", children: "\u2605" }), " ", prestador.average_rating ?? "Novo"] }), _jsx("span", { children: formatarContagemAvaliacoes(prestador.review_count) }), _jsxs("span", { children: [prestador.active_service_count, " ", prestador.active_service_count === 1 ? "serviço" : "serviços"] })] }), _jsxs(Link, { className: styles.providerLink, href: `/prestadores/${prestador.id}`, children: ["Ver perfil ", _jsx(Icone, { name: "arrow", size: 16 })] })] }, prestador.id))) }), _jsxs("div", { className: styles.pagination, children: [_jsxs("span", { children: [quantidadePrestadores, " empresas e prestadores encontrados"] }), _jsxs("div", { children: [_jsx("button", { type: "button", disabled: !temPaginaAnterior, onClick: () => {
                                                            definirCarregamento(true);
                                                            definirFiltros((atual) => ({ ...atual, page: Math.max(1, atual.page - 1) }));
                                                        }, children: "Anterior" }), _jsxs("span", { children: ["P\u00E1gina ", filtros.page] }), _jsx("button", { type: "button", disabled: !temProximaPagina, onClick: () => {
                                                            definirCarregamento(true);
                                                            definirFiltros((atual) => ({ ...atual, page: atual.page + 1 }));
                                                        }, children: "Seguinte" })] })] })] })) : (_jsxs("div", { className: styles.emptyState, children: [_jsx("span", { className: styles.emptyIcon, children: _jsx(Icone, { name: "search", size: 24 }) }), _jsx("h3", { children: "A sua pr\u00F3xima boa escolha come\u00E7a aqui." }), _jsx("p", { children: temFiltrosAtivos
                                            ? "Ainda não encontramos empresas ou prestadores com estes filtros. Experimente ajustar a pesquisa."
                                            : "Estamos a preparar a comunidade de empresas e prestadores verificados. Volte em breve para descobrir quem pode ajudar." }), temFiltrosAtivos && _jsx("button", { type: "button", onClick: limparFiltros, children: "Limpar pesquisa" })] }))] }), _jsx(DirectorySection, { audience: "companies", compact: true, query: filtros.search, category: filtros.category, municipality: filtros.municipality }), _jsx(DirectorySection, { audience: "entrepreneurs", compact: true, query: filtros.search, category: filtros.category, municipality: filtros.municipality }), _jsxs("section", { className: styles.howItWorks, id: "como-funciona", "aria-labelledby": "how-it-works-title", children: [_jsxs("div", { className: styles.howItWorksIntro, id: "sobre", children: [_jsx("span", { children: "Como funciona" }), _jsx("h2", { id: "how-it-works-title", children: "Encontre, compare e entre em contacto." }), _jsx("p", { children: "A plataforma aproxima clientes, empresas e profissionais. O contacto e os detalhes do servi\u00E7o s\u00E3o combinados diretamente entre as partes." })] }), _jsxs("ol", { className: styles.howItWorksSteps, children: [_jsxs("li", { children: [_jsx("span", { children: "1" }), _jsxs("div", { children: [_jsx("strong", { children: "Pesquise o que precisa" }), _jsx("p", { children: "Escolha um servi\u00E7o e indique a localiza\u00E7\u00E3o." })] })] }), _jsxs("li", { children: [_jsx("span", { children: "2" }), _jsxs("div", { children: [_jsx("strong", { children: "Compare perfis" }), _jsx("p", { children: "Consulte empresas, profissionais e servi\u00E7os publicados." })] })] }), _jsxs("li", { children: [_jsx("span", { children: "3" }), _jsxs("div", { children: [_jsx("strong", { children: "Entre em contacto" }), _jsx("p", { children: "Fale diretamente com quem pode prestar o servi\u00E7o." })] })] })] })] }), _jsxs("section", { className: styles.benefits, "aria-labelledby": "benefits-title", children: [_jsxs("div", { className: styles.benefitsHeading, children: [_jsx("span", { children: "Uma plataforma para todos" }), _jsx("h2", { id: "benefits-title", children: "Boas liga\u00E7\u00F5es fazem a diferen\u00E7a." }), _jsx("p", { children: "Encontre quem precisa ou fa\u00E7a o seu trabalho chegar a mais pessoas em Angola." })] }), _jsxs("div", { className: styles.benefitGrid, children: [_jsxs("article", { className: styles.benefitCard, children: [_jsx("span", { "aria-hidden": "true", children: "\u2315" }), _jsx("h3", { children: "Para clientes" }), _jsx("p", { children: "Compare op\u00E7\u00F5es, explore perfis e contacte profissionais para o servi\u00E7o de que precisa." }), _jsxs(Link, { href: "/explorar", children: ["Encontrar um servi\u00E7o ", _jsx(Icone, { name: "arrow", size: 16 })] })] }), _jsxs("article", { className: styles.benefitCard, children: [_jsx("span", { "aria-hidden": "true", children: "\u25A6" }), _jsx("h3", { children: "Para empresas" }), _jsx("p", { children: "Apresente os seus servi\u00E7os e facilite o contacto com novos clientes." }), _jsxs(Link, { href: "/empresa", children: ["Conhecer a \u00E1rea da empresa ", _jsx(Icone, { name: "arrow", size: 16 })] })] }), _jsxs("article", { className: styles.benefitCard, children: [_jsx("span", { "aria-hidden": "true", children: "\u2733" }), _jsx("h3", { children: "Para profissionais" }), _jsx("p", { children: "Crie o seu perfil profissional e divulgue as compet\u00EAncias que oferece." }), _jsxs(Link, { href: "/perfil", children: ["Criar perfil profissional ", _jsx(Icone, { name: "arrow", size: 16 })] })] })] })] }), _jsxs("section", { className: styles.finalCta, id: "tornar-prestador", children: [_jsxs("div", { children: [_jsx("span", { children: "Conect Services" }), _jsx("h2", { children: "Fa\u00E7a parte da Conect Services" }), _jsx("p", { children: "Seja cliente, prestador ou empresa. Juntos, movemos o futuro de Angola." })] }), _jsxs("div", { className: styles.audienceLinks, children: [_jsx(Link, { href: "/registar", children: "Sou cliente" }), _jsx(Link, { href: "/perfil", children: "Sou prestador" }), _jsx(Link, { href: "/empresa", children: "Sou empresa" })] })] }), _jsxs("footer", { className: styles.footer, children: [_jsx(Link, { className: styles.footerBrand, href: appMode ? "/conta" : "/", children: "Conect Services" }), _jsx("span", { children: "Conectando o mundo, movendo o futuro." }), _jsx("span", { children: "Termos \u00B7 Privacidade" }), _jsxs("span", { children: ["\u00A9 ", new Date().getFullYear(), " Conect Services"] })] })] }) }) }));
}

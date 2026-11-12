"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useEffect, useState } from "react";
import BusinessLogo from "@/app/components/business-logo";
import { requisitarJson } from "@/lib/api-client";
import styles from "./categorias.module.css";
const icones = ["⌘", "⌂", "✚", "✧", "➜", "▱", "◌", "▣"];
export default function CategoriasPublicasPage() {
    const [categorias, definirCategorias] = useState([]);
    const [categoriaSelecionada, definirCategoriaSelecionada] = useState(null);
    const [prestadores, definirPrestadores] = useState([]);
    const [termo, definirTermo] = useState("");
    const [carregandoCategorias, definirCarregamentoCategorias] = useState(true);
    const [carregandoPrestadores, definirCarregamentoPrestadores] = useState(false);
    const [tentativaPrestadores, definirTentativaPrestadores] = useState(0);
    const [erro, definirErro] = useState("");
    useEffect(() => {
        let ativo = true;
        requisitarJson("/api/public/categories?parent=null")
            .then((pagina) => { if (ativo)
            definirCategorias(pagina.results); })
            .catch((falha) => {
            if (ativo)
                definirErro(falha instanceof Error ? falha.message : "Não foi possível carregar as categorias.");
        })
            .finally(() => { if (ativo)
            definirCarregamentoCategorias(false); });
        return () => { ativo = false; };
    }, []);
    useEffect(() => {
        if (!categoriaSelecionada) {
            return;
        }
        let ativo = true;
        requisitarJson(`/api/public/providers/discover?category=${categoriaSelecionada.id}&ordering=-rating`)
            .then((pagina) => { if (ativo)
            definirPrestadores(pagina.results); })
            .catch((falha) => {
            if (ativo)
                definirErro(falha instanceof Error ? falha.message : "Não foi possível carregar os prestadores.");
        })
            .finally(() => { if (ativo)
            definirCarregamentoPrestadores(false); });
        return () => { ativo = false; };
    }, [categoriaSelecionada, tentativaPrestadores]);
    const categoriasFiltradas = categorias.filter((categoria) => `${categoria.name} ${categoria.description}`.toLocaleLowerCase("pt-AO").includes(termo.trim().toLocaleLowerCase("pt-AO")));
    return (_jsxs("main", { className: styles.page, children: [_jsxs("header", { className: styles.header, children: [_jsxs(Link, { className: styles.brand, href: "/", "aria-label": "Conect Services \u2014 p\u00E1gina inicial", children: [_jsx("span", { className: styles.brandMark, "aria-hidden": "true", children: "C" }), _jsxs("span", { children: ["Conect ", _jsx("strong", { children: "Services" })] })] }), _jsxs("nav", { "aria-label": "Navega\u00E7\u00E3o principal", children: [_jsx(Link, { href: "/", children: "In\u00EDcio" }), _jsx(Link, { href: "/categorias", "aria-current": "page", children: "Categorias" }), _jsx(Link, { href: "/explorar", children: "Empresas e profissionais" })] }), _jsxs("div", { className: styles.headerActions, children: [_jsx(Link, { href: "/entrar", children: "Entrar" }), _jsx(Link, { className: styles.primaryButton, href: "/registar", children: "Criar conta" })] })] }), _jsxs("section", { className: styles.hero, children: [_jsx("span", { className: styles.eyebrow, children: "Encontra o que procuras" }), _jsx("h1", { children: "Categorias de servi\u00E7os" }), _jsx("p", { children: "Explora categorias e descobre empresas e profissionais dispon\u00EDveis em Angola." }), _jsxs("label", { className: styles.searchField, children: [_jsx("span", { "aria-hidden": "true", children: "\u2315" }), _jsx("span", { className: styles.srOnly, children: "Pesquisar categorias" }), _jsx("input", { value: termo, onChange: (evento) => definirTermo(evento.target.value), placeholder: "Pesquisar categorias\u2026" })] })] }), _jsxs("section", { className: styles.content, "aria-labelledby": "categories-title", children: [_jsxs("div", { className: styles.sectionHeading, children: [_jsxs("div", { children: [_jsx("span", { className: styles.sectionKicker, children: "Explore por \u00E1rea" }), _jsx("h2", { id: "categories-title", children: "Escolhe uma categoria" })] }), _jsxs("span", { className: styles.resultCount, children: [categoriasFiltradas.length, " categorias"] })] }), carregandoCategorias ? (_jsx("p", { className: styles.notice, role: "status", children: "A carregar categorias\u2026" })) : erro && categorias.length === 0 ? (_jsxs("div", { className: styles.notice, role: "alert", children: [_jsx("p", { children: erro }), _jsx("button", { type: "button", onClick: () => window.location.reload(), children: "Tentar novamente" })] })) : categoriasFiltradas.length ? (_jsx("div", { className: styles.categoryGrid, children: categoriasFiltradas.map((categoria, index) => (_jsxs("button", { className: `${styles.categoryCard} ${categoriaSelecionada?.id === categoria.id ? styles.categorySelected : ""}`, type: "button", "aria-pressed": categoriaSelecionada?.id === categoria.id, onClick: () => {
                                definirErro("");
                                const desmarcar = categoriaSelecionada?.id === categoria.id;
                                definirCarregamentoPrestadores(!desmarcar);
                                definirCategoriaSelecionada(desmarcar ? null : categoria);
                            }, children: [_jsx("span", { className: `${styles.categoryIcon} ${styles[`categoryIcon${index % 4}`]}`, "aria-hidden": "true", children: icones[index % icones.length] }), _jsx("strong", { children: categoria.name }), _jsx("span", { children: categoria.description || "Descobre serviços e profissionais nesta área." })] }, categoria.id))) })) : (_jsx("p", { className: styles.notice, children: "N\u00E3o encontr\u00E1mos categorias com esse nome." }))] }), categoriaSelecionada && (_jsxs("section", { className: styles.providers, "aria-live": "polite", children: [_jsxs("div", { className: styles.sectionHeading, children: [_jsxs("div", { children: [_jsx("span", { className: styles.sectionKicker, children: "Prestadores verificados" }), _jsx("h2", { children: categoriaSelecionada.name })] }), _jsx("button", { className: styles.clearButton, type: "button", onClick: () => { definirCarregamentoPrestadores(false); definirCategoriaSelecionada(null); }, children: "Limpar sele\u00E7\u00E3o" })] }), carregandoPrestadores ? (_jsx("p", { className: styles.notice, role: "status", children: "A procurar empresas e profissionais\u2026" })) : erro ? (_jsxs("div", { className: styles.notice, role: "alert", children: [_jsx("p", { children: erro }), _jsx("button", { type: "button", onClick: () => {
                                    definirErro("");
                                    definirCarregamentoPrestadores(true);
                                    definirTentativaPrestadores((tentativa) => tentativa + 1);
                                }, children: "Tentar novamente" })] })) : prestadores.length ? (_jsx("div", { className: styles.providerGrid, children: prestadores.map((prestador) => (_jsxs("article", { className: styles.providerCard, children: [prestador.business_profile ? (_jsx(BusinessLogo, { className: styles.avatarImage, companyName: prestador.commercial_name, logoUrl: prestador.business_profile.logo, width: 48, height: 48 })) : _jsx("span", { className: styles.avatar, "aria-hidden": "true", children: prestador.commercial_name.slice(0, 1) }), _jsxs("div", { className: styles.providerInfo, children: [_jsx("h3", { children: prestador.commercial_name }), _jsx("p", { children: prestador.description || "Prestador de serviços em Angola." }), _jsxs("span", { className: styles.providerMeta, children: [prestador.average_rating ? `★ ${prestador.average_rating} · ${prestador.review_count} avaliações` : "Novo prestador", ` · ${prestador.active_service_count} ${prestador.active_service_count === 1 ? "serviço" : "serviços"}`] })] }), _jsx(Link, { className: styles.profileLink, href: `/prestadores/${prestador.id}`, children: "Ver perfil" })] }, prestador.id))) })) : (_jsx("p", { className: styles.notice, children: "Ainda n\u00E3o h\u00E1 prestadores publicados nesta categoria. Experimenta outra categoria." }))] })), _jsxs("footer", { className: styles.footer, children: [_jsx(Link, { href: "/", children: "Conect Services" }), _jsx("span", { children: "Conectando o mundo, movendo o futuro." }), _jsxs("span", { children: ["\u00A9 ", new Date().getFullYear(), " Conect Services"] })] })] }));
}

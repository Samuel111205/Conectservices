"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Heart, Trash2 } from "lucide-react";
import BusinessLogo from "../components/business-logo";
import EstruturaAutenticacao from "../auth-shell";
import styles from "./favorites.module.css";
function extrairMensagemErro(dados) {
    if (dados && typeof dados === "object" && "detail" in dados && typeof dados.detail === "string") {
        return dados.detail;
    }
    return "Não foi possível atualizar os favoritos.";
}
function formatarPreco(servico) {
    if (servico.minimum_price === null)
        return "Preço sob consulta";
    const minimo = Number(servico.minimum_price);
    const maximo = servico.maximum_price === null ? null : Number(servico.maximum_price);
    const formatarValor = (valor) => new Intl.NumberFormat("pt-AO", {
        style: "currency",
        currency: servico.currency || "AOA",
        maximumFractionDigits: 0,
    }).format(valor);
    return maximo !== null && maximo !== minimo
        ? `${formatarValor(minimo)} – ${formatarValor(maximo)}`
        : formatarValor(minimo);
}
export default function PaginaFavoritos() {
    const router = useRouter();
    const [prestadores, definirPrestadores] = useState([]);
    const [servicos, definirServicos] = useState([]);
    const [aCarregar, definirCarregamento] = useState(true);
    const [idEmRemocao, definirIdEmRemocao] = useState(null);
    const [erro, definirErro] = useState("");
    useEffect(() => {
        let ativo = true;
        Promise.all([
            fetchApi("/api/auth/favorites/providers/", { cache: "no-store" }),
            fetchApi("/api/auth/favorites/services/", { cache: "no-store" }),
        ])
            .then(async ([prestadoresHttp, servicosHttp]) => {
            if ([prestadoresHttp, servicosHttp].some((resposta) => resposta.status === 401)) {
                router.replace("/entrar?next=%2Ffavoritos");
                return;
            }
            if ([prestadoresHttp, servicosHttp].some((resposta) => !resposta.ok)) {
                throw new Error("Não foi possível carregar os favoritos. Tenta novamente.");
            }
            const [paginaPrestadores, paginaServicos] = await Promise.all([
                prestadoresHttp.json(),
                servicosHttp.json(),
            ]);
            if (!ativo)
                return;
            definirPrestadores(paginaPrestadores.results ?? []);
            definirServicos(paginaServicos.results ?? []);
        })
            .catch((motivo) => {
            if (ativo)
                definirErro(motivo instanceof Error ? motivo.message : "Não foi possível carregar os favoritos.");
        })
            .finally(() => {
            if (ativo)
                definirCarregamento(false);
        });
        return () => { ativo = false; };
    }, [router]);
    async function removerFavorito(tipo, id) {
        const chave = `${tipo}-${id}`;
        definirIdEmRemocao(chave);
        definirErro("");
        try {
            const resposta = await fetchApi(`/api/auth/favorites/${tipo}/${id}/`, { method: "DELETE" });
            if (resposta.status === 401) {
                router.replace("/entrar?next=%2Ffavoritos");
                return;
            }
            if (!resposta.ok) {
                const dados = await resposta.json();
                throw new Error(extrairMensagemErro(dados));
            }
            if (tipo === "providers") {
                definirPrestadores((atuais) => atuais.filter((item) => item.id !== id));
            }
            else {
                definirServicos((atuais) => atuais.filter((item) => item.id !== id));
            }
        }
        catch (motivo) {
            definirErro(motivo instanceof Error ? motivo.message : "Não foi possível remover este favorito.");
        }
        finally {
            definirIdEmRemocao(null);
        }
    }
    const total = prestadores.length + servicos.length;
    return (_jsxs(EstruturaAutenticacao, { account: true, area: "client", profileName: "Cliente", children: [_jsx("p", { className: styles.eyebrow, children: "A tua cole\u00E7\u00E3o" }), _jsx("h1", { children: "Favoritos" }), _jsx("p", { className: styles.intro, children: "Guarda profissionais e servi\u00E7os para os encontrares facilmente mais tarde." }), !aCarregar && _jsxs("p", { className: styles.summary, children: [total, " ", total === 1 ? "item guardado" : "itens guardados"] }), erro && _jsx("p", { className: styles.error, role: "alert", children: erro }), aCarregar ? (_jsx("p", { className: styles.loading, role: "status", children: "A carregar os teus favoritos\u2026" })) : total ? (_jsxs("div", { className: styles.sections, children: [prestadores.length > 0 && (_jsxs("section", { "aria-labelledby": "favorite-providers-heading", children: [_jsxs("header", { className: styles.sectionHeading, children: [_jsxs("div", { children: [_jsx("p", { children: "Profissionais" }), _jsx("h2", { id: "favorite-providers-heading", children: "Prestadores guardados" })] }), _jsx("span", { children: prestadores.length })] }), _jsx("div", { className: styles.grid, children: prestadores.map((favorito) => (_jsxs("article", { className: styles.card, children: [_jsx(BusinessLogo, { className: styles.logo, companyName: favorito.commercial_name, width: 58, height: 58 }), _jsxs("div", { className: styles.cardCopy, children: [_jsx("strong", { children: favorito.commercial_name }), _jsx("span", { children: "Prestador de servi\u00E7os" })] }), _jsx(Link, { className: styles.open, href: `/prestadores/${favorito.provider}`, "aria-label": `Ver perfil de ${favorito.commercial_name}`, children: _jsx(ArrowUpRight, { size: 17 }) }), _jsx("button", { className: styles.remove, type: "button", disabled: idEmRemocao === `providers-${favorito.id}`, onClick: () => void removerFavorito("providers", favorito.id), "aria-label": `Remover ${favorito.commercial_name} dos favoritos`, children: _jsx(Trash2, { size: 16, "aria-hidden": "true" }) })] }, favorito.id))) })] })), servicos.length > 0 && (_jsxs("section", { "aria-labelledby": "favorite-services-heading", children: [_jsxs("header", { className: styles.sectionHeading, children: [_jsxs("div", { children: [_jsx("p", { children: "Servi\u00E7os" }), _jsx("h2", { id: "favorite-services-heading", children: "Servi\u00E7os guardados" })] }), _jsx("span", { children: servicos.length })] }), _jsx("div", { className: styles.grid, children: servicos.map((favorito) => (_jsxs("article", { className: styles.card, children: [_jsx("span", { className: styles.serviceIcon, children: _jsx(Heart, { size: 20, "aria-hidden": "true" }) }), _jsxs("div", { className: styles.cardCopy, children: [_jsx("strong", { children: favorito.service_name }), _jsxs("span", { children: [favorito.provider_name, " \u00B7 ", formatarPreco(favorito)] })] }), _jsx(Link, { className: styles.open, href: `/servicos/${favorito.service}`, "aria-label": `Ver serviço ${favorito.service_name}`, children: _jsx(ArrowUpRight, { size: 17 }) }), _jsx("button", { className: styles.remove, type: "button", disabled: idEmRemocao === `services-${favorito.id}`, onClick: () => void removerFavorito("services", favorito.id), "aria-label": `Remover ${favorito.service_name} dos favoritos`, children: _jsx(Trash2, { size: 16, "aria-hidden": "true" }) })] }, favorito.id))) })] }))] })) : (_jsxs("section", { className: styles.empty, children: [_jsx("span", { children: _jsx(Heart, { size: 24, "aria-hidden": "true" }) }), _jsx("h2", { children: "Os teus favoritos aparecem aqui" }), _jsx("p", { children: "Explora servi\u00E7os e perfis profissionais e guarda os que queres consultar novamente." }), _jsx(Link, { href: "/explorar", children: "Explorar servi\u00E7os" })] }))] }));
}

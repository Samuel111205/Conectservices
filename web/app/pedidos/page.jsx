"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { ApiRequestError, requisitarJson, fetchApi } from "@/lib/api-client";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
const nomesEstados = {
    OPEN: "Aberto",
    NEGOTIATING: "A receber propostas",
    AWARDED: "Contratado",
    COMPLETED: "Concluído",
    CANCELLED: "Cancelado",
};
function formatarOrcamento(pedido) {
    if (pedido.minimum_budget === null && pedido.maximum_budget === null) {
        return "Orçamento sob consulta";
    }
    const minimo = pedido.minimum_budget === null
        ? null
        : Number(pedido.minimum_budget).toLocaleString("pt-AO");
    const maximo = pedido.maximum_budget === null
        ? null
        : Number(pedido.maximum_budget).toLocaleString("pt-AO");
    if (minimo && maximo && minimo !== maximo) {
        return `${minimo}–${maximo} ${pedido.currency}`;
    }
    return `${minimo ?? maximo} ${pedido.currency}`;
}
export default function PaginaPedidos() {
    const navegador = useRouter();
    const [pedidos, definirPedidos] = useState([]);
    const [propostas, definirPropostas] = useState([]);
    const [categorias, definirCategorias] = useState([]);
    const [erro, definirErro] = useState("");
    const [estaCarregando, definirCarregamento] = useState(true);
    const [acaoProposta, definirAcaoProposta] = useState(null);
    const [erroDaProposta, definirErroDaProposta] = useState("");
    const [conversaAabrir, definirConversaAabrir] = useState(null);
    const [erroDaConversa, definirErroDaConversa] = useState("");
    useEffect(() => {
        let ativo = true;
        Promise.all([
            fetchApi("/api/auth/orders/", { cache: "no-store" }),
            fetchApi("/api/auth/proposals/", { cache: "no-store" }),
            requisitarJson("/api/public/categories/?parent=null"),
        ])
            .then(async ([respostaPedidos, respostaPropostas, paginaCategorias]) => {
            if (respostaPedidos.status === 401 || respostaPropostas.status === 401) {
                navegador.replace("/entrar?next=%2Fpedidos");
                return;
            }
            if (!respostaPedidos.ok ||
                !respostaPropostas.ok) {
                const dadosRecebidos = await respostaPedidos.json().catch(() => null);
                throw new Error(typeof dadosRecebidos?.detail === "string"
                    ? dadosRecebidos.detail
                    : "Não foi possível carregar os pedidos.");
            }
            const [orderPage, paginaPropostas] = (await Promise.all([
                respostaPedidos.json(),
                respostaPropostas.json(),
            ]));
            if (ativo) {
                definirPedidos(orderPage.results);
                definirPropostas(paginaPropostas.results);
                definirCategorias(paginaCategorias.results);
            }
        })
            .catch((motivo) => {
            if (ativo) {
                definirErro(motivo instanceof Error
                    ? motivo.message
                    : "Não foi possível carregar os pedidos.");
            }
        })
            .finally(() => {
            if (ativo)
                definirCarregamento(false);
        });
        return () => {
            ativo = false;
        };
    }, [navegador]);
    async function responderProposta(proposta, acao) {
        definirAcaoProposta(proposta.id);
        definirErroDaProposta("");
        try {
            const respostaHttp = await fetchApi(`/api/auth/proposals/${proposta.id}/${acao}/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            });
            const dadosRecebidos = await respostaHttp.json().catch(() => null);
            if (respostaHttp.status === 401) {
                navegador.replace("/entrar?next=%2Fpedidos");
                return;
            }
            if (!respostaHttp.ok) {
                definirErroDaProposta(typeof dadosRecebidos?.detail === "string"
                    ? dadosRecebidos.detail
                    : "Não foi possível atualizar a proposta.");
                return;
            }
            definirPropostas((atual) => atual.map((item) => item.order_id === proposta.order_id && acao === "accept"
                ? {
                    ...item,
                    status: item.id === proposta.id ? "ACCEPTED" : "REJECTED",
                }
                : item.id === proposta.id
                    ? { ...item, status: "REJECTED" }
                    : item));
            if (acao === "accept") {
                definirPedidos((atual) => atual.map((pedido) => pedido.id === proposta.order_id
                    ? { ...pedido, status: "AWARDED" }
                    : pedido));
                navegador.push("/contratacoes");
            }
        }
        catch {
            definirErroDaProposta("Não foi possível contactar o serviço.");
        }
        finally {
            definirAcaoProposta(null);
        }
    }
    async function abrirConversa(proposta) {
        definirConversaAabrir(proposta.id);
        definirErroDaConversa("");
        try {
            const conversa = await requisitarJson("/api/auth/conversations/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proposal_id: proposta.id }),
            });
            navegador.push(`/mensagens?conversa=${conversa.id}`);
        }
        catch (motivo) {
            if (motivo instanceof ApiRequestError && motivo.status === 401) {
                navegador.replace("/entrar?next=%2Fpedidos");
            }
            else {
                definirErroDaConversa(motivo instanceof Error ? motivo.message : "Não foi possível abrir a conversa.");
            }
        }
        finally {
            definirConversaAabrir(null);
        }
    }
    return (_jsxs(EstruturaAutenticacao, { account: true, children: [_jsx("p", { className: styles.eyebrow, children: "Acompanhamento" }), _jsx("h1", { children: "Os meus pedidos" }), _jsx("p", { className: styles.intro, children: "Consulta os pedidos enviados e acompanha o estado de cada um." }), _jsxs("div", { className: styles.accountActions, children: [_jsx(Link, { className: styles.submitLink, href: "/pedidos/novo", children: "Criar pedido" }), _jsx(Link, { className: styles.secondary, href: "/conta", children: "\u00C1rea pessoal" })] }), estaCarregando ? (_jsx("p", { className: styles.intro, "aria-live": "polite", children: "A carregar pedidos\u2026" })) : erro ? (_jsx("p", { className: styles.notice, role: "alert", children: erro })) : pedidos.length ? (_jsx("div", { className: styles.orderList, children: pedidos.map((pedido) => (_jsxs("article", { className: styles.orderCard, children: [_jsxs("div", { className: styles.orderTopline, children: [_jsx("span", { className: styles.orderCategory, children: categorias.find((item) => item.id === pedido.category)?.name ??
                                        "Serviço" }), _jsx("span", { className: styles.profileBadge, children: nomesEstados[pedido.status] ?? pedido.status })] }), _jsx("h2", { children: pedido.title }), _jsx("p", { children: pedido.description }), _jsxs("div", { className: styles.orderMetadata, children: [_jsxs("span", { children: [pedido.neighborhood ? `${pedido.neighborhood}, ` : "", pedido.municipality_name, ", ", pedido.province_name] }), _jsx("strong", { children: formatarOrcamento(pedido) })] }), _jsxs("small", { children: ["Criado em", " ", new Date(pedido.created_at).toLocaleDateString("pt-AO"), pedido.requested_at
                                    ? ` · Pretendido para ${new Date(pedido.requested_at).toLocaleString("pt-AO")}`
                                    : ""] }), propostas.some((proposta) => proposta.order_id === pedido.id) && (_jsxs("section", { className: styles.proposalSection, children: [_jsx("h3", { children: "Propostas recebidas" }), erroDaConversa && (_jsx("p", { className: styles.notice, role: "alert", children: erroDaConversa })), erroDaProposta && (_jsx("p", { className: styles.notice, role: "alert", children: erroDaProposta })), propostas
                                    .filter((proposta) => proposta.order_id === pedido.id)
                                    .map((proposta) => (_jsxs("article", { className: styles.proposalCard, children: [_jsxs("div", { className: styles.orderTopline, children: [_jsx("strong", { children: proposta.provider_name }), _jsx("span", { className: styles.profileBadge, children: proposta.status === "PENDING"
                                                        ? "Pendente"
                                                        : proposta.status === "ACCEPTED"
                                                            ? "Aceite"
                                                            : proposta.status === "REJECTED"
                                                                ? "Rejeitada"
                                                                : proposta.status })] }), _jsx("p", { children: proposta.description }), _jsxs("div", { className: styles.orderMetadata, children: [_jsxs("strong", { children: [Number(proposta.price).toLocaleString("pt-AO"), " ", proposta.currency] }), _jsxs("span", { children: ["Prazo estimado: ", proposta.estimated_days, " dias"] })] }), proposta.status === "PENDING" &&
                                            pedido.status !== "AWARDED" &&
                                            pedido.status !== "COMPLETED" &&
                                            pedido.status !== "CANCELLED" && (_jsxs("div", { className: styles.accountActions, children: [_jsx("button", { className: styles.submitLink, type: "button", disabled: acaoProposta === proposta.id, onClick: () => void responderProposta(proposta, "accept"), children: acaoProposta === proposta.id
                                                        ? "A processar…"
                                                        : "Aceitar proposta" }), _jsx("button", { className: styles.secondary, type: "button", disabled: acaoProposta === proposta.id, onClick: () => void responderProposta(proposta, "reject"), children: "Rejeitar" })] })), ["PENDING", "ACCEPTED"].includes(proposta.status) &&
                                            pedido.status !== "CANCELLED" && (_jsx("div", { className: styles.accountActions, children: _jsx("button", { className: styles.secondary, type: "button", disabled: conversaAabrir === proposta.id, onClick: () => void abrirConversa(proposta), children: conversaAabrir === proposta.id
                                                    ? "A abrir…"
                                                    : "Conversar sobre a proposta" }) }))] }, proposta.id)))] }))] }, pedido.id))) })) : (_jsxs("div", { className: styles.orderEmpty, children: [_jsx("h2", { children: "Ainda n\u00E3o tens pedidos." }), _jsx("p", { children: "Cria um pedido e recebe propostas de profissionais." })] }))] }));
}

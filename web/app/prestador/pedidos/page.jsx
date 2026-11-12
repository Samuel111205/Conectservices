"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import EstruturaAutenticacao from "../../auth-shell";
import styles from "../../auth.module.css";
function formatarOrcamento(orcamentoMinimo, orcamentoMaximo) {
    if (orcamentoMinimo === null && orcamentoMaximo === null) {
        return "Sem orçamento indicado";
    }
    const minimo = orcamentoMinimo === null
        ? null
        : Number(orcamentoMinimo).toLocaleString("pt-AO");
    const maximo = orcamentoMaximo === null
        ? null
        : Number(orcamentoMaximo).toLocaleString("pt-AO");
    if (minimo && maximo && minimo !== maximo)
        return `${minimo}–${maximo} AOA`;
    return `${minimo ?? maximo} AOA`;
}
function obterMensagemErro(dadosRecebidos) {
    if (dadosRecebidos && typeof dadosRecebidos === "object") {
        const mensagens = Object.values(dadosRecebidos).flatMap((valor) => Array.isArray(valor) ? valor : [valor]);
        const mensagem = mensagens.find((valor) => typeof valor === "string");
        if (typeof mensagem === "string")
            return mensagem;
    }
    return "Não foi possível concluir a operação.";
}
export default function PaginaOportunidadesPrestador() {
    const navegador = useRouter();
    const [oportunidades, definirOportunidades] = useState([]);
    const [propostas, definirPropostas] = useState([]);
    const [erro, definirErro] = useState("");
    const [estaCarregando, definirCarregamento] = useState(true);
    const [aEnviarPedido, definirEnvioPedido] = useState(null);
    const [errosFormulario, definirErrosFormulario] = useState({});
    const [precos, definirPrecos] = useState({});
    const [descricoes, definirDescricoes] = useState({});
    const [prazos, definirPrazos] = useState({});
    const [conversaAabrir, definirConversaAabrir] = useState(null);
    useEffect(() => {
        let ativo = true;
        Promise.all([
            fetchApi("/api/auth/orders/opportunities/", { cache: "no-store" }),
            fetchApi("/api/auth/proposals/", { cache: "no-store" }),
        ])
            .then(async ([respostaOportunidades, respostaPropostas]) => {
            if (respostaOportunidades.status === 401 ||
                respostaPropostas.status === 401) {
                navegador.replace("/entrar?next=%2Fprestador%2Fpedidos");
                return;
            }
            if (!respostaOportunidades.ok || !respostaPropostas.ok) {
                const dadosRecebidos = await respostaOportunidades.json().catch(() => null);
                throw new Error(typeof dadosRecebidos?.detail === "string"
                    ? dadosRecebidos.detail
                    : "Não foi possível carregar os pedidos disponíveis.");
            }
            const [paginaOportunidades, paginaPropostas] = (await Promise.all([
                respostaOportunidades.json(),
                respostaPropostas.json(),
            ]));
            if (ativo) {
                definirOportunidades(paginaOportunidades.results);
                definirPropostas(paginaPropostas.results);
            }
        })
            .catch((motivo) => {
            if (ativo) {
                definirErro(motivo instanceof Error
                    ? motivo.message
                    : "Não foi possível carregar os pedidos disponíveis.");
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
    async function enviarProposta(evento, oportunidade) {
        evento.preventDefault();
        definirEnvioPedido(oportunidade.id);
        definirErrosFormulario((atual) => ({ ...atual, [oportunidade.id]: "" }));
        try {
            const respostaHttp = await fetchApi("/api/auth/proposals/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    order_id: oportunidade.id,
                    price: precos[oportunidade.id],
                    description: descricoes[oportunidade.id],
                    estimated_days: Number(prazos[oportunidade.id]),
                }),
            });
            const dadosRecebidos = await respostaHttp.json();
            if (respostaHttp.status === 401) {
                navegador.replace("/entrar?next=%2Fprestador%2Fpedidos");
                return;
            }
            if (!respostaHttp.ok) {
                definirErrosFormulario((atual) => ({
                    ...atual,
                    [oportunidade.id]: obterMensagemErro(dadosRecebidos),
                }));
                return;
            }
            definirPropostas((atual) => [dadosRecebidos, ...atual]);
        }
        catch {
            definirErrosFormulario((atual) => ({
                ...atual,
                [oportunidade.id]: "Não foi possível contactar o serviço.",
            }));
        }
        finally {
            definirEnvioPedido(null);
        }
    }
    async function abrirConversa(proposta) {
        definirConversaAabrir(proposta.id);
        definirErrosFormulario((atual) => ({ ...atual, [proposta.order_id]: "" }));
        try {
            const respostaHttp = await fetchApi("/api/auth/conversations/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proposal_id: proposta.id }),
            });
            const dados = await respostaHttp.json().catch(() => null);
            if (respostaHttp.status === 401) {
                navegador.replace("/entrar?next=%2Fprestador%2Fpedidos");
                return;
            }
            if (!respostaHttp.ok || typeof dados?.id !== "number") {
                definirErrosFormulario((atual) => ({
                    ...atual,
                    [proposta.order_id]: typeof dados?.detail === "string"
                        ? dados.detail
                        : "Não foi possível abrir a conversa.",
                }));
                return;
            }
            navegador.push(`/mensagens?conversa=${dados.id}`);
        }
        catch {
            definirErrosFormulario((atual) => ({
                ...atual,
                [proposta.order_id]: "Não foi possível contactar o serviço.",
            }));
        }
        finally {
            definirConversaAabrir(null);
        }
    }
    const propostaDoPedido = (idPedido) => propostas.find((proposta) => proposta.order_id === idPedido && proposta.status !== "CANCELLED");
    return (_jsxs(EstruturaAutenticacao, { account: true, children: [_jsx("p", { className: styles.eyebrow, children: "\u00C1rea do prestador" }), _jsx("h1", { children: "Pedidos dispon\u00EDveis" }), _jsx("p", { className: styles.intro, children: "Consulta pedidos compat\u00EDveis com a tua conta e envia uma proposta aos clientes que podes ajudar." }), _jsxs("div", { className: styles.accountActions, children: [_jsx(Link, { className: styles.secondary, href: "/perfil", children: "Gerir perfil profissional" }), _jsx(Link, { className: styles.secondary, href: "/conta", children: "\u00C1rea pessoal" })] }), estaCarregando ? (_jsx("p", { className: styles.intro, "aria-live": "polite", children: "A carregar pedidos\u2026" })) : erro ? (_jsx("p", { className: styles.notice, role: "alert", children: erro })) : oportunidades.length ? (_jsx("div", { className: styles.orderList, children: oportunidades.map((oportunidade) => {
                    const proposta = propostaDoPedido(oportunidade.id);
                    return (_jsxs("article", { className: styles.orderCard, children: [_jsxs("div", { className: styles.orderTopline, children: [_jsx("span", { className: styles.orderCategory, children: oportunidade.category_name }), _jsx("span", { className: styles.profileBadge, children: proposta ? "Proposta enviada" : "Aberto" })] }), _jsx("h2", { children: oportunidade.title }), _jsx("p", { children: oportunidade.description }), _jsxs("div", { className: styles.orderMetadata, children: [_jsxs("span", { children: [oportunidade.neighborhood_snapshot
                                                ? `${oportunidade.neighborhood_snapshot}, `
                                                : "", oportunidade.municipality_name_snapshot, ",", " ", oportunidade.province_name_snapshot] }), _jsx("strong", { children: formatarOrcamento(oportunidade.minimum_budget, oportunidade.maximum_budget) })] }), oportunidade.requested_at && (_jsxs("small", { children: ["Pretendido para", " ", new Date(oportunidade.requested_at).toLocaleString("pt-AO")] })), proposta ? (_jsxs("div", { className: styles.sentProposal, children: [_jsxs("strong", { children: ["A tua proposta:", " ", Number(proposta.price).toLocaleString("pt-AO"), " AOA"] }), _jsxs("span", { children: ["Prazo estimado: ", proposta.estimated_days, " dias \u00B7 Estado:", " ", proposta.status === "PENDING"
                                                ? "Pendente"
                                                : proposta.status] }), ["PENDING", "ACCEPTED"].includes(proposta.status) && (_jsx("button", { className: styles.secondary, type: "button", disabled: conversaAabrir === proposta.id, onClick: () => void abrirConversa(proposta), children: conversaAabrir === proposta.id
                                            ? "A abrir…"
                                            : "Conversar com o cliente" }))] })) : (_jsxs("form", { className: styles.inlineProposal, onSubmit: (evento) => void enviarProposta(evento, oportunidade), children: [_jsxs("label", { className: styles.field, children: ["A tua proposta (AOA)", _jsx("input", { type: "number", min: "0.01", step: "0.01", required: true, value: precos[oportunidade.id] ?? "", onChange: (evento) => definirPrecos((atual) => ({
                                                    ...atual,
                                                    [oportunidade.id]: evento.target.value,
                                                })) })] }), _jsxs("label", { className: styles.field, children: ["Prazo estimado (dias)", _jsx("input", { type: "number", min: "1", max: "32767", required: true, value: prazos[oportunidade.id] ?? "", onChange: (evento) => definirPrazos((atual) => ({
                                                    ...atual,
                                                    [oportunidade.id]: evento.target.value,
                                                })) })] }), _jsxs("label", { className: styles.field, children: ["Mensagem para o cliente", _jsx("textarea", { required: true, maxLength: 3000, rows: 3, value: descricoes[oportunidade.id] ?? "", onChange: (evento) => definirDescricoes((atual) => ({
                                                    ...atual,
                                                    [oportunidade.id]: evento.target.value,
                                                })) })] }), errosFormulario[oportunidade.id] && (_jsx("p", { className: styles.notice, role: "alert", children: errosFormulario[oportunidade.id] })), _jsx("button", { className: styles.submit, type: "submit", disabled: aEnviarPedido === oportunidade.id, children: aEnviarPedido === oportunidade.id
                                            ? "A enviar proposta…"
                                            : "Enviar proposta" })] }))] }, oportunidade.id));
                }) })) : (_jsxs("div", { className: styles.orderEmpty, children: [_jsx("h2", { children: "N\u00E3o h\u00E1 pedidos dispon\u00EDveis neste momento." }), _jsx("p", { children: "Confirma que o teu perfil profissional est\u00E1 verificado e que a tua conta est\u00E1 ativa. Os pedidos compat\u00EDveis aparecer\u00E3o aqui." })] }))] }));
}

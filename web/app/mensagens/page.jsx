"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError, requisitarJson } from "@/lib/api-client";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
function obterPaginaSeguinte(url) {
    if (!url)
        return null;
    return new URL(url, window.location.origin).searchParams.get("page");
}
function formatarData(valor) {
    if (!valor)
        return "Sem mensagens";
    return new Date(valor).toLocaleString("pt-AO", {
        dateStyle: "short",
        timeStyle: "short",
    });
}
function podeEnviarMensagem(conversa) {
    return (["PENDING", "ACCEPTED"].includes(conversa.proposal_status) &&
        conversa.order_status !== "CANCELLED");
}
export default function PaginaMensagens() {
    const navegador = useRouter();
    const [conversas, definirConversas] = useState([]);
    const [utilizadorId, definirUtilizadorId] = useState(null);
    const [conversaSelecionada, definirConversaSelecionada] = useState(null);
    const [mensagens, definirMensagens] = useState([]);
    const [texto, definirTexto] = useState("");
    const [erro, definirErro] = useState("");
    const [erroEnvio, definirErroEnvio] = useState("");
    const [estaCarregando, definirCarregamento] = useState(true);
    const [estaCarregandoMensagens, definirCarregamentoMensagens] = useState(false);
    const [estaCarregandoAntigas, definirCarregamentoAntigas] = useState(false);
    const [estaAEnviar, definirEnvio] = useState(false);
    const [paginaAntiga, definirPaginaAntiga] = useState(null);
    const pedidoMensagensAtual = useRef(0);
    const carregarMensagens = useCallback(async (idConversa, pagina = null) => {
        const pedidoAtual = ++pedidoMensagensAtual.current;
        if (pagina)
            definirCarregamentoAntigas(true);
        else
            definirCarregamentoMensagens(true);
        definirErroEnvio("");
        try {
            const consulta = pagina ? `?page=${encodeURIComponent(pagina)}` : "";
            const dados = await requisitarJson(`/api/auth/conversations/${idConversa}/messages/${consulta}`);
            if (pedidoAtual !== pedidoMensagensAtual.current)
                return;
            const novasMensagens = [...dados.results].reverse();
            if (pagina) {
                definirMensagens((atuais) => {
                    const ids = new Set(atuais.map((mensagem) => mensagem.id));
                    return [...novasMensagens.filter((mensagem) => !ids.has(mensagem.id)), ...atuais];
                });
            }
            else {
                definirMensagens(novasMensagens);
            }
            definirPaginaAntiga(obterPaginaSeguinte(dados.next));
            definirConversas((atuais) => atuais.map((conversa) => conversa.id === idConversa
                ? { ...conversa, unread_count: 0 }
                : conversa));
        }
        catch (motivo) {
            if (pedidoAtual !== pedidoMensagensAtual.current)
                return;
            if (motivo instanceof ApiRequestError && motivo.status === 401) {
                navegador.replace("/entrar?next=%2Fmensagens");
            }
            else {
                definirErroEnvio(motivo instanceof Error
                    ? motivo.message
                    : "Não foi possível carregar as mensagens.");
            }
        }
        finally {
            if (pedidoAtual === pedidoMensagensAtual.current) {
                definirCarregamentoMensagens(false);
                definirCarregamentoAntigas(false);
            }
        }
    }, [navegador]);
    const carregarConversas = useCallback(async () => {
        definirErro("");
        try {
            const [pagina, conta] = await Promise.all([
                requisitarJson("/api/auth/conversations/"),
                requisitarJson("/api/auth/me/"),
            ]);
            definirConversas(pagina.results);
            definirUtilizadorId(conta.id);
            const pedidoUrl = new URLSearchParams(window.location.search).get("conversa");
            const conversaDaUrl = pedidoUrl
                ? pagina.results.find((conversa) => conversa.id === Number(pedidoUrl))
                : undefined;
            const primeiraConversa = conversaDaUrl ?? pagina.results[0];
            if (primeiraConversa) {
                definirConversaSelecionada(primeiraConversa.id);
                await carregarMensagens(primeiraConversa.id);
            }
            else {
                definirConversaSelecionada(null);
                definirMensagens([]);
            }
        }
        catch (motivo) {
            if (motivo instanceof ApiRequestError && motivo.status === 401) {
                navegador.replace("/entrar?next=%2Fmensagens");
            }
            else {
                definirErro(motivo instanceof Error
                    ? motivo.message
                    : "Não foi possível carregar as conversas.");
            }
        }
        finally {
            definirCarregamento(false);
        }
    }, [carregarMensagens, navegador]);
    useEffect(() => {
        const timeout = window.setTimeout(() => void carregarConversas(), 0);
        return () => window.clearTimeout(timeout);
    }, [carregarConversas]);
    function selecionarConversa(conversa) {
        definirConversaSelecionada(conversa.id);
        definirMensagens([]);
        definirPaginaAntiga(null);
        window.history.replaceState(null, "", `/mensagens?conversa=${conversa.id}`);
        void carregarMensagens(conversa.id);
    }
    async function enviarMensagem(evento) {
        evento.preventDefault();
        const conversa = conversas.find((item) => item.id === conversaSelecionada);
        const corpo = texto.trim();
        if (!conversa || !corpo || !podeEnviarMensagem(conversa))
            return;
        definirEnvio(true);
        definirErroEnvio("");
        try {
            const mensagem = await requisitarJson(`/api/auth/conversations/${conversa.id}/messages/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: corpo }),
            });
            definirMensagens((atuais) => [...atuais, mensagem]);
            definirTexto("");
            definirConversas((atuais) => atuais.map((item) => item.id === conversa.id
                ? {
                    ...item,
                    last_message_preview: mensagem.body,
                    last_message_at: mensagem.created_at,
                }
                : item));
        }
        catch (motivo) {
            if (motivo instanceof ApiRequestError && motivo.status === 401) {
                navegador.replace("/entrar?next=%2Fmensagens");
            }
            else {
                definirErroEnvio(motivo instanceof Error
                    ? motivo.message
                    : "Não foi possível enviar a mensagem.");
            }
        }
        finally {
            definirEnvio(false);
        }
    }
    const conversaAtiva = conversas.find((item) => item.id === conversaSelecionada);
    return (_jsxs(EstruturaAutenticacao, { account: true, children: [_jsx("p", { className: styles.eyebrow, children: "Contacto direto" }), _jsx("h1", { children: "Mensagens" }), _jsx("p", { className: styles.intro, children: "Combina os detalhes do servi\u00E7o com clientes e prestadores ligados \u00E0s tuas propostas." }), estaCarregando ? (_jsx("p", { className: styles.intro, "aria-live": "polite", children: "A carregar conversas\u2026" })) : erro ? (_jsxs("div", { className: styles.notice, role: "alert", children: [_jsx("p", { children: erro }), _jsx("button", { className: styles.secondary, type: "button", onClick: () => void carregarConversas(), children: "Tentar novamente" })] })) : conversas.length === 0 ? (_jsxs("section", { className: styles.messageEmpty, children: [_jsx("span", { className: styles.messageEmptyIcon, "aria-hidden": "true", children: "\u2709" }), _jsx("h2", { children: "Ainda n\u00E3o tens conversas" }), _jsx("p", { children: "Quando receberes ou enviares uma proposta, podes falar diretamente com a outra pessoa." }), _jsx(Link, { className: styles.secondary, href: "/pedidos", children: "Ver pedidos e propostas" })] })) : (_jsxs("section", { className: styles.conversationLayout, "aria-label": "Conversas", children: [_jsxs("aside", { className: styles.conversationSidebar, children: [_jsxs("div", { className: styles.messageSectionHeading, children: [_jsx("h2", { children: "As tuas conversas" }), _jsx("button", { className: styles.messageRefresh, type: "button", "aria-label": "Atualizar conversas e mensagens", onClick: () => void carregarConversas(), children: "Atualizar" })] }), _jsx("ul", { className: styles.conversationList, children: conversas.map((conversa) => (_jsx("li", { children: _jsxs("button", { className: `${styles.conversationItem} ${conversa.id === conversaSelecionada ? styles.conversationItemActive : ""}`, type: "button", "aria-current": conversa.id === conversaSelecionada ? "true" : undefined, onClick: () => selecionarConversa(conversa), children: [_jsxs("span", { className: styles.conversationItemTop, children: [_jsx("strong", { children: conversa.contact_name }), conversa.unread_count > 0 && (_jsx("span", { className: styles.unreadBadge, "aria-label": `${conversa.unread_count} mensagens não lidas`, children: conversa.unread_count }))] }), _jsx("span", { className: styles.conversationOrder, children: conversa.order_title }), _jsx("span", { className: styles.conversationPreview, children: conversa.last_message_preview ?? "Inicia a conversa sobre esta proposta." }), _jsx("time", { className: styles.conversationDate, children: formatarData(conversa.last_message_at) })] }) }, conversa.id))) })] }), conversaAtiva && (_jsxs("div", { className: styles.messageThread, children: [_jsxs("header", { className: styles.messageThreadHeader, children: [_jsxs("div", { children: [_jsxs("p", { className: styles.messageThreadEyebrow, children: ["Pedido #", conversaAtiva.order_id] }), _jsx("h2", { children: conversaAtiva.contact_name }), _jsx("p", { children: conversaAtiva.order_title })] }), _jsx(Link, { className: styles.messageOrderLink, href: "/pedidos", children: "Ver pedidos" })] }), _jsxs("div", { className: styles.messageHistory, "aria-live": "polite", "aria-label": "Hist\u00F3rico de mensagens", children: [paginaAntiga && (_jsx("button", { className: styles.loadOlder, type: "button", disabled: estaCarregandoAntigas, onClick: () => void carregarMensagens(conversaAtiva.id, paginaAntiga), children: estaCarregandoAntigas ? "A carregar…" : "Carregar mensagens anteriores" })), estaCarregandoMensagens ? (_jsx("p", { className: styles.profileHint, "aria-live": "polite", children: "A carregar mensagens\u2026" })) : mensagens.length ? (mensagens.map((mensagem) => {
                                        const eMinha = mensagem.sender_id === utilizadorId;
                                        return (_jsxs("article", { className: `${styles.messageBubble} ${eMinha ? styles.messageBubbleMine : styles.messageBubbleOther}`, children: [_jsx("p", { children: mensagem.body }), _jsx("time", { children: formatarData(mensagem.created_at) })] }, mensagem.id));
                                    })) : (_jsx("p", { className: styles.messageFirst, children: "Ainda n\u00E3o h\u00E1 mensagens. Envia a primeira." }))] }), erroEnvio && _jsx("p", { className: styles.notice, role: "alert", children: erroEnvio }), podeEnviarMensagem(conversaAtiva) ? (_jsxs("form", { className: styles.messageComposer, onSubmit: enviarMensagem, children: [_jsx("label", { className: styles.visuallyHidden, htmlFor: "mensagem", children: "Escreve a tua mensagem" }), _jsx("textarea", { id: "mensagem", maxLength: 5000, rows: 3, placeholder: "Escreve uma mensagem\u2026", value: texto, onChange: (evento) => definirTexto(evento.target.value) }), _jsxs("div", { className: styles.messageComposerFooter, children: [_jsxs("span", { children: [texto.length, "/5000"] }), _jsx("button", { className: styles.submit, type: "submit", disabled: estaAEnviar || !texto.trim(), children: estaAEnviar ? "A enviar…" : "Enviar mensagem" })] })] })) : (_jsx("p", { className: styles.messageClosed, role: "status", children: "Esta conversa est\u00E1 encerrada e j\u00E1 n\u00E3o aceita novas mensagens." }))] }))] }))] }));
}

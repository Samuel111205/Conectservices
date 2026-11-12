"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { usePathname, useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import styles from "./auth.module.css";
function formatarData(valor) {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime()))
        return "";
    return new Intl.DateTimeFormat("pt-AO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(data);
}
export default function NotificationCenter() {
    const router = useRouter();
    const pathname = usePathname();
    const [aberto, definirAberto] = useState(false);
    const [notificacoes, definirNotificacoes] = useState([]);
    const [porLer, definirPorLer] = useState(0);
    const [aCarregar, definirCarregamento] = useState(false);
    const [aMarcarTodas, definirMarcarTodas] = useState(false);
    const [erro, definirErro] = useState("");
    useEffect(() => {
        let ativo = true;
        async function atualizarContagem(atualizarFeed = false) {
            try {
                const resposta = await fetchApi("/api/auth/notifications/unread-count/", {
                    cache: "no-store",
                });
                if (resposta.status === 401) {
                    router.replace(`/entrar?next=${encodeURIComponent(pathname)}`);
                    return;
                }
                if (!resposta.ok)
                    return;
                const dados = (await resposta.json());
                if (ativo && Number.isFinite(dados.unread_count)) {
                    definirPorLer(Math.max(0, dados.unread_count));
                }
                if (ativo && aberto && atualizarFeed) {
                    const respostaFeed = await fetchApi("/api/auth/notifications/?page=1", {
                        cache: "no-store",
                    });
                    if (respostaFeed.ok) {
                        const notificacoesAtuais = (await respostaFeed.json());
                        if (ativo)
                            definirNotificacoes(notificacoesAtuais.results ?? []);
                    }
                }
            }
            catch {
                // O feed continua utilizável se a contagem estiver temporariamente indisponível.
            }
        }
        void atualizarContagem();
        const temporizador = window.setInterval(() => void atualizarContagem(true), 45_000);
        return () => {
            ativo = false;
            window.clearInterval(temporizador);
        };
    }, [aberto, pathname, router]);
    async function carregarNotificacoes() {
        definirCarregamento(true);
        definirErro("");
        try {
            const resposta = await fetchApi("/api/auth/notifications/?page=1", { cache: "no-store" });
            if (resposta.status === 401) {
                router.replace(`/entrar?next=${encodeURIComponent(pathname)}`);
                return;
            }
            if (!resposta.ok)
                throw new Error("Não foi possível carregar as notificações.");
            const dados = (await resposta.json());
            definirNotificacoes(dados.results ?? []);
        }
        catch {
            definirErro("Não foi possível carregar as notificações. Tenta novamente.");
        }
        finally {
            definirCarregamento(false);
        }
    }
    async function marcarTodasComoLidas() {
        definirMarcarTodas(true);
        definirErro("");
        try {
            const resposta = await fetchApi("/api/auth/notifications/read-all/", {
                method: "POST",
            });
            if (!resposta.ok)
                throw new Error("Não foi possível atualizar as notificações.");
            const agora = new Date().toISOString();
            definirNotificacoes((atuais) => atuais.map((notificacao) => ({
                ...notificacao,
                read_at: notificacao.read_at ?? agora,
            })));
            definirPorLer(0);
        }
        catch {
            definirErro("Não foi possível marcar as notificações como lidas.");
        }
        finally {
            definirMarcarTodas(false);
        }
    }
    async function abrirNotificacao(notificacao) {
        if (!notificacao.read_at) {
            try {
                const resposta = await fetchApi(`/api/auth/notifications/${notificacao.id}/read/`, { method: "POST" });
                if (resposta.ok) {
                    const agora = new Date().toISOString();
                    definirNotificacoes((atuais) => atuais.map((item) => item.id === notificacao.id ? { ...item, read_at: agora } : item));
                    definirPorLer((atual) => Math.max(0, atual - 1));
                }
            }
            catch {
                // A pessoa ainda pode abrir a caixa de mensagens se a marcação falhar.
            }
        }
        definirAberto(false);
        const destino = notificacao.href ?? (notificacao.conversation_id
            ? `/mensagens?conversa=${notificacao.conversation_id}`
            : "/compras");
        if (destino.split("?")[0] === pathname) {
            window.location.assign(destino);
            return;
        }
        router.push(destino);
    }
    return (_jsxs("div", { className: styles.notificationCenter, onKeyDown: (evento) => {
            if (evento.key === "Escape")
                definirAberto(false);
        }, children: [_jsxs("button", { type: "button", className: styles.notificationToggle, "aria-label": porLer ? `Notificações, ${porLer} por ler` : "Notificações", "aria-expanded": aberto, "aria-controls": "notification-panel", onClick: () => {
                    if (aberto)
                        definirAberto(false);
                    else {
                        definirAberto(true);
                        void carregarNotificacoes();
                    }
                }, children: [_jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" }), _jsx("path", { d: "M10 21h4" })] }), _jsx("span", { className: styles.notificationToggleLabel, children: "Notifica\u00E7\u00F5es" }), porLer > 0 && _jsx("span", { className: styles.notificationBadge, children: porLer > 9 ? "9+" : porLer })] }), aberto && (_jsxs("section", { className: styles.notificationPanel, id: "notification-panel", "aria-label": "Notifica\u00E7\u00F5es recentes", children: [_jsxs("header", { className: styles.notificationHeader, children: [_jsxs("div", { children: [_jsx("strong", { children: "Notifica\u00E7\u00F5es" }), _jsx("span", { children: porLer ? `${porLer} por ler` : "Estás em dia" })] }), porLer > 0 && (_jsx("button", { type: "button", disabled: aMarcarTodas, onClick: () => void marcarTodasComoLidas(), children: aMarcarTodas ? "A atualizar…" : "Marcar todas como lidas" }))] }), erro && _jsx("p", { className: styles.notificationError, role: "alert", children: erro }), aCarregar ? (_jsx("p", { className: styles.notificationEmpty, "aria-live": "polite", children: "A carregar notifica\u00E7\u00F5es\u2026" })) : notificacoes.length ? (_jsx("ul", { className: styles.notificationList, children: notificacoes.map((notificacao) => (_jsx("li", { children: _jsxs("button", { type: "button", className: `${styles.notificationItem} ${notificacao.read_at ? "" : styles.notificationUnread}`, onClick: () => void abrirNotificacao(notificacao), children: [_jsxs("span", { className: styles.notificationItemTop, children: [_jsx("strong", { children: notificacao.title }), _jsx("time", { dateTime: notificacao.created_at, children: formatarData(notificacao.created_at) })] }), _jsx("span", { children: notificacao.body })] }) }, notificacao.id))) })) : (!erro && _jsx("p", { className: styles.notificationEmpty, children: "Ainda n\u00E3o tens notifica\u00E7\u00F5es." })), _jsx("button", { type: "button", className: styles.notificationMessagesLink, onClick: () => {
                            definirAberto(false);
                            router.push("/mensagens");
                        }, children: "Abrir mensagens" })] }))] }));
}

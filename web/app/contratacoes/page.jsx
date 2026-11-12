"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
const nomesEstados = {
    SCHEDULED: "Por agendar",
    CONFIRMED: "Confirmado",
    IN_PROGRESS: "Em execução",
    COMPLETED: "Concluído",
    CANCELLED: "Cancelado",
};
function formatarData(valor) {
    if (!valor)
        return "Ainda sem horário marcado";
    return new Date(valor).toLocaleString("pt-AO", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Luanda",
    });
}
function formatarDuracao(minutos) {
    if (!minutos)
        return "Duração não indicada";
    if (minutos < 60)
        return `${minutos} minutos`;
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    return minutosRestantes ? `${horas} h ${minutosRestantes} min` : `${horas} h`;
}
function obterMensagemErro(dadosRecebidos) {
    if (dadosRecebidos && typeof dadosRecebidos === "object") {
        const valores = Object.values(dadosRecebidos).flatMap((valor) => Array.isArray(valor) ? valor : [valor]);
        const mensagem = valores.find((valor) => typeof valor === "string");
        if (typeof mensagem === "string")
            return mensagem;
    }
    return "Não foi possível concluir a operação.";
}
export default function PaginaContratacoes() {
    const navegador = useRouter();
    const [reservas, definirReservas] = useState([]);
    const [estaCarregando, definirCarregamento] = useState(true);
    const [erro, definirErro] = useState("");
    const [datas, definirDatas] = useState({});
    const [horarios, definirHorarios] = useState({});
    const [horariosSelecionados, definirHorariosSelecionados] = useState({});
    const [errosHorarios, definirErrosHorarios] = useState({});
    const [idAcao, definirIdAcao] = useState(null);
    const [erroAcao, definirErroAcao] = useState("");
    const [idErroAcao, definirIdErroAcao] = useState(null);
    const [classificacoes, definirClassificacoes] = useState({});
    const [comentarios, definirComentarios] = useState({});
    const [idAvaliacao, definirIdAvaliacao] = useState(null);
    const [erroAvaliacao, definirErroAvaliacao] = useState("");
    const [idErroAvaliacao, definirIdErroAvaliacao] = useState(null);
    useEffect(() => {
        let ativo = true;
        fetchApi("/api/auth/bookings/", { cache: "no-store" })
            .then(async (respostaHttp) => {
            if (respostaHttp.status === 401) {
                navegador.replace("/entrar?next=%2Fcontratacoes");
                return;
            }
            const dadosRecebidos = await respostaHttp.json();
            if (!respostaHttp.ok)
                throw new Error(obterMensagemErro(dadosRecebidos));
            if (ativo)
                definirReservas(dadosRecebidos.results);
        })
            .catch((motivo) => {
            if (ativo) {
                definirErro(motivo instanceof Error
                    ? motivo.message
                    : "Não foi possível carregar as contratações.");
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
    async function carregarHorarios(idContratacao) {
        const dataSelecionada = datas[idContratacao];
        if (!dataSelecionada) {
            definirErrosHorarios((atual) => ({
                ...atual,
                [idContratacao]: "Escolhe primeiro uma data.",
            }));
            return;
        }
        definirErrosHorarios((atual) => ({ ...atual, [idContratacao]: "" }));
        definirHorarios((atual) => ({ ...atual, [idContratacao]: [] }));
        try {
            const respostaHttp = await fetchApi(`/api/auth/bookings/${idContratacao}/available-slots/?date=${encodeURIComponent(dataSelecionada)}`, { cache: "no-store" });
            const dadosRecebidos = await respostaHttp.json();
            if (respostaHttp.status === 401) {
                navegador.replace("/entrar?next=%2Fcontratacoes");
                return;
            }
            if (!respostaHttp.ok) {
                definirErrosHorarios((atual) => ({
                    ...atual,
                    [idContratacao]: obterMensagemErro(dadosRecebidos),
                }));
                return;
            }
            const disponiveis = dadosRecebidos.slots;
            definirHorarios((atual) => ({ ...atual, [idContratacao]: disponiveis }));
            if (!disponiveis.length) {
                definirErrosHorarios((atual) => ({
                    ...atual,
                    [idContratacao]: "Não há horários disponíveis nessa data. Tenta outro dia.",
                }));
            }
        }
        catch {
            definirErrosHorarios((atual) => ({
                ...atual,
                [idContratacao]: "Não foi possível consultar os horários.",
            }));
        }
    }
    async function executarAcao(reserva, acao) {
        definirIdAcao(reserva.id);
        definirErroAcao("");
        definirIdErroAcao(null);
        const corpoRequisicao = acao === "schedule"
            ? { scheduled_at: horariosSelecionados[reserva.id] }
            : {};
        try {
            const respostaHttp = await fetchApi(`/api/auth/bookings/${reserva.id}/${acao}/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(corpoRequisicao),
            });
            const dadosRecebidos = await respostaHttp.json().catch(() => null);
            if (respostaHttp.status === 401) {
                navegador.replace("/entrar?next=%2Fcontratacoes");
                return;
            }
            if (!respostaHttp.ok) {
                definirErroAcao(obterMensagemErro(dadosRecebidos));
                definirIdErroAcao(reserva.id);
                return;
            }
            if (acao === "schedule") {
                definirReservas((atual) => atual.map((item) => (item.id === reserva.id ? dadosRecebidos : item)));
                definirHorarios((atual) => ({ ...atual, [reserva.id]: [] }));
            }
            else {
                definirReservas((atual) => atual.map((item) => (item.id === reserva.id ? dadosRecebidos : item)));
            }
        }
        catch {
            definirErroAcao("Não foi possível contactar o serviço.");
            definirIdErroAcao(reserva.id);
        }
        finally {
            definirIdAcao(null);
        }
    }
    async function enviarAvaliacao(reserva) {
        const rating = classificacoes[reserva.id] ?? 0;
        if (rating < 1 || rating > 5) {
            definirErroAvaliacao("Escolhe uma classificação de 1 a 5 estrelas.");
            definirIdErroAvaliacao(reserva.id);
            return;
        }
        definirIdAvaliacao(reserva.id);
        definirErroAvaliacao("");
        definirIdErroAvaliacao(null);
        try {
            const respostaHttp = await fetchApi("/api/auth/reviews/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    booking_id: reserva.id,
                    rating,
                    comment: (comentarios[reserva.id] ?? "").trim(),
                }),
            });
            const dadosRecebidos = await respostaHttp.json().catch(() => null);
            if (respostaHttp.status === 401) {
                navegador.replace("/entrar?next=%2Fcontratacoes");
                return;
            }
            if (!respostaHttp.ok) {
                definirErroAvaliacao(obterMensagemErro(dadosRecebidos));
                definirIdErroAvaliacao(reserva.id);
                return;
            }
            const avaliacao = dadosRecebidos;
            definirReservas((atual) => atual.map((item) => item.id === reserva.id ? { ...item, review: avaliacao } : item));
        }
        catch {
            definirErroAvaliacao("Não foi possível contactar o serviço.");
            definirIdErroAvaliacao(reserva.id);
        }
        finally {
            definirIdAvaliacao(null);
        }
    }
    return (_jsxs(EstruturaAutenticacao, { account: true, children: [_jsx("p", { className: styles.eyebrow, children: "Servi\u00E7os contratados" }), _jsx("h1", { children: "Contrata\u00E7\u00F5es" }), _jsx("p", { className: styles.intro, children: "Marca hor\u00E1rios, acompanha o servi\u00E7o e confirma a conclus\u00E3o quando o trabalho estiver terminado." }), _jsxs("div", { className: styles.accountActions, children: [_jsx(Link, { className: styles.secondary, href: "/pedidos", children: "Os meus pedidos" }), _jsx(Link, { className: styles.secondary, href: "/prestador/pedidos", children: "Pedidos para prestadores" })] }), estaCarregando ? (_jsx("p", { className: styles.intro, "aria-live": "polite", children: "A carregar contrata\u00E7\u00F5es\u2026" })) : erro ? (_jsx("p", { className: styles.notice, role: "alert", children: erro })) : reservas.length ? (_jsx("div", { className: styles.bookingList, children: reservas.map((reserva) => (_jsxs("article", { className: styles.bookingCard, children: [_jsxs("div", { className: styles.orderTopline, children: [_jsxs("span", { className: styles.orderCategory, children: ["Contrata\u00E7\u00E3o #", reserva.id] }), _jsx("span", { className: styles.profileBadge, children: nomesEstados[reserva.status] })] }), _jsx("h2", { children: reserva.provider_name }), reserva.service_name && (_jsx("p", { className: styles.bookingService, children: reserva.service_name })), _jsxs("div", { className: styles.orderMetadata, children: [_jsxs("strong", { children: [Number(reserva.final_price).toLocaleString("pt-AO"), " ", reserva.currency] }), _jsx("span", { children: formatarDuracao(reserva.duration_minutes) })] }), _jsxs("div", { className: styles.bookingSchedule, children: [_jsx("span", { children: "Data e hora" }), _jsx("strong", { children: formatarData(reserva.scheduled_at) })] }), erroAcao && idErroAcao === reserva.id && (_jsx("p", { className: styles.notice, role: "alert", children: erroAcao })), reserva.status === "SCHEDULED" && reserva.is_client && (_jsxs("div", { className: styles.bookingActions, children: [_jsxs("label", { className: styles.field, children: ["Consultar hor\u00E1rios dispon\u00EDveis", _jsx("input", { type: "date", value: datas[reserva.id] ?? "", onChange: (evento) => {
                                                definirDatas((atual) => ({
                                                    ...atual,
                                                    [reserva.id]: evento.target.value,
                                                }));
                                                definirHorarios((atual) => ({ ...atual, [reserva.id]: [] }));
                                                definirHorariosSelecionados((atual) => ({
                                                    ...atual,
                                                    [reserva.id]: "",
                                                }));
                                            } })] }), _jsx("button", { className: styles.secondary, type: "button", disabled: idAcao === reserva.id, onClick: () => void carregarHorarios(reserva.id), children: "Ver hor\u00E1rios" }), horarios[reserva.id]?.length ? (_jsxs(_Fragment, { children: [_jsxs("label", { className: styles.field, children: ["Hor\u00E1rio dispon\u00EDvel (hora de Luanda)", _jsxs("select", { value: horariosSelecionados[reserva.id] ?? "", onChange: (evento) => definirHorariosSelecionados((atual) => ({
                                                        ...atual,
                                                        [reserva.id]: evento.target.value,
                                                    })), children: [_jsx("option", { value: "", children: "Seleciona um hor\u00E1rio" }), horarios[reserva.id].map((slot) => (_jsx("option", { value: slot, children: new Date(slot).toLocaleTimeString("pt-AO", {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                                timeZone: "Africa/Luanda",
                                                            }) }, slot)))] })] }), _jsx("button", { className: styles.submitLink, type: "button", disabled: idAcao === reserva.id || !horariosSelecionados[reserva.id], onClick: () => void executarAcao(reserva, "schedule"), children: "Marcar hor\u00E1rio" })] })) : null, errosHorarios[reserva.id] && (_jsx("p", { className: styles.notice, role: "alert", children: errosHorarios[reserva.id] }))] })), reserva.status === "SCHEDULED" && reserva.is_provider && (_jsx("div", { className: styles.bookingActions, children: _jsx("button", { className: styles.dangerButton, type: "button", disabled: idAcao === reserva.id, onClick: () => void executarAcao(reserva, "cancel"), children: "Cancelar contrata\u00E7\u00E3o" }) })), reserva.status === "SCHEDULED" &&
                            reserva.scheduled_at &&
                            reserva.is_client && (_jsx("div", { className: styles.bookingActions, children: _jsx("button", { className: styles.submitLink, type: "button", disabled: idAcao === reserva.id, onClick: () => void executarAcao(reserva, "confirm"), children: "Confirmar hor\u00E1rio" }) })), reserva.status === "CONFIRMED" && (_jsxs("div", { className: styles.bookingActions, children: [reserva.is_client && (_jsx("p", { className: styles.profileHint, children: "O prestador pode iniciar o servi\u00E7o quando chegar a hora combinada." })), reserva.is_provider && (_jsx("button", { className: styles.submitLink, type: "button", disabled: idAcao === reserva.id, onClick: () => void executarAcao(reserva, "start"), children: "Iniciar servi\u00E7o" })), _jsx("button", { className: styles.dangerButton, type: "button", disabled: idAcao === reserva.id, onClick: () => void executarAcao(reserva, "cancel"), children: "Cancelar contrata\u00E7\u00E3o" })] })), reserva.status === "IN_PROGRESS" && (_jsx("div", { className: styles.bookingActions, children: reserva.is_client ? (_jsxs(_Fragment, { children: [_jsx("p", { className: styles.profileHint, children: "Depois de verificar o servi\u00E7o conclu\u00EDdo, confirma aqui." }), _jsx("button", { className: styles.submitLink, type: "button", disabled: idAcao === reserva.id, onClick: () => void executarAcao(reserva, "complete"), children: "Confirmar conclus\u00E3o" })] })) : (_jsx("p", { className: styles.profileHint, children: "O cliente confirma a conclus\u00E3o depois de verificar o servi\u00E7o." })) })), reserva.status === "COMPLETED" && (_jsxs("div", { className: styles.bookingActions, children: [_jsx("p", { className: `${styles.notice} ${styles.success}`, children: "Servi\u00E7o conclu\u00EDdo." }), reserva.review ? (_jsxs("div", { children: [_jsx("p", { className: styles.profileHint, children: "Avalia\u00E7\u00E3o enviada pelo cliente" }), _jsxs("p", { className: styles.orderCategory, "aria-label": `${reserva.review.rating} de 5 estrelas`, children: [_jsxs("span", { "aria-hidden": "true", children: ["★".repeat(reserva.review.rating), "☆".repeat(5 - reserva.review.rating)] }), " ", reserva.review.rating, "/5"] }), reserva.review.comment && (_jsxs("p", { className: styles.profileHint, children: ["\u201C", reserva.review.comment, "\u201D"] }))] })) : reserva.is_client ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.field, children: [_jsx("span", { children: "Como avalias o servi\u00E7o?" }), _jsx("div", { role: "group", "aria-label": "Classifica\u00E7\u00E3o do servi\u00E7o", children: [1, 2, 3, 4, 5].map((rating) => {
                                                        const selecionada = classificacoes[reserva.id] === rating;
                                                        return (_jsx("button", { "aria-pressed": selecionada, "aria-label": `${rating} ${rating === 1 ? "estrela" : "estrelas"}`, className: selecionada ? styles.submitLink : styles.secondary, onClick: () => definirClassificacoes((atual) => ({
                                                                ...atual,
                                                                [reserva.id]: rating,
                                                            })), type: "button", children: "\u2605" }, rating));
                                                    }) })] }), _jsxs("label", { className: styles.field, children: ["Coment\u00E1rio opcional", _jsx("textarea", { maxLength: 2000, rows: 4, value: comentarios[reserva.id] ?? "", onChange: (evento) => definirComentarios((atual) => ({
                                                        ...atual,
                                                        [reserva.id]: evento.target.value,
                                                    })) })] }), erroAvaliacao && idErroAvaliacao === reserva.id && (_jsx("p", { className: styles.notice, role: "alert", children: erroAvaliacao })), _jsx("button", { className: styles.submitLink, disabled: idAvaliacao === reserva.id || !classificacoes[reserva.id], onClick: () => void enviarAvaliacao(reserva), type: "button", children: idAvaliacao === reserva.id ? "A enviar…" : "Enviar avaliação" })] })) : (_jsx("p", { className: styles.profileHint, children: "O cliente ainda n\u00E3o enviou uma avalia\u00E7\u00E3o." }))] }))] }, reserva.id))) })) : (_jsxs("div", { className: styles.orderEmpty, children: [_jsx("h2", { children: "Ainda n\u00E3o tens contrata\u00E7\u00F5es." }), _jsx("p", { children: "Quando aceitares uma proposta, a contrata\u00E7\u00E3o aparecer\u00E1 nesta p\u00E1gina." }), _jsx(Link, { className: styles.submitLink, href: "/pedidos", children: "Ver os meus pedidos" })] }))] }));
}

"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { Check, Clock3, LoaderCircle } from "lucide-react";
import styles from "./availability-widget.module.css";
const dias = [
    { weekday: 0, label: "Segunda" },
    { weekday: 1, label: "Terça" },
    { weekday: 2, label: "Quarta" },
    { weekday: 3, label: "Quinta" },
    { weekday: 4, label: "Sexta" },
    { weekday: 5, label: "Sábado" },
    { weekday: 6, label: "Domingo" },
];
function horaCurta(valor) {
    return valor.slice(0, 5);
}
function mensagemErro(dados, fallback) {
    if (dados && typeof dados === "object" && "detail" in dados && typeof dados.detail === "string") {
        return dados.detail;
    }
    if (dados && typeof dados === "object") {
        const primeira = Object.values(dados).flatMap((valor) => Array.isArray(valor) ? valor : [valor])
            .find((valor) => typeof valor === "string");
        if (typeof primeira === "string")
            return primeira;
    }
    return fallback;
}
export default function AvailabilityWidget() {
    const router = useRouter();
    const [disponibilidade, definirDisponibilidade] = useState([]);
    const [rascunhos, definirRascunhos] = useState({});
    const [aCarregar, definirCarregamento] = useState(true);
    const [diaEmAtualizacao, definirDiaEmAtualizacao] = useState(null);
    const [erro, definirErro] = useState("");
    const porDia = useMemo(() => {
        const resultado = new Map();
        for (const item of disponibilidade) {
            resultado.set(item.weekday, [...(resultado.get(item.weekday) ?? []), item]);
        }
        return resultado;
    }, [disponibilidade]);
    const carregarDisponibilidade = useCallback(async () => {
        const resposta = await fetchApi("/api/auth/availability/", { cache: "no-store" });
        if (resposta.status === 401) {
            router.replace("/entrar?next=%2Fprestador");
            return null;
        }
        const dados = await resposta.json();
        if (!resposta.ok)
            throw new Error(mensagemErro(dados, "Não foi possível carregar a disponibilidade."));
        return dados.results ?? [];
    }, [router]);
    const atualizarDisponibilidade = useCallback((itens) => {
        definirDisponibilidade(itens);
        definirRascunhos(Object.fromEntries(itens.map((item) => [item.id, {
                inicio: horaCurta(item.start_time),
                fim: horaCurta(item.end_time),
            }])));
    }, []);
    useEffect(() => {
        let ativo = true;
        carregarDisponibilidade()
            .then((itens) => { if (ativo && itens)
            atualizarDisponibilidade(itens); })
            .catch((motivo) => {
            if (ativo)
                definirErro(motivo instanceof Error ? motivo.message : "Não foi possível carregar a disponibilidade.");
        })
            .finally(() => {
            if (ativo)
                definirCarregamento(false);
        });
        return () => { ativo = false; };
    }, [atualizarDisponibilidade, carregarDisponibilidade]);
    async function alternarDia(dia) {
        const horarios = porDia.get(dia.weekday) ?? [];
        definirDiaEmAtualizacao(dia.weekday);
        definirErro("");
        try {
            if (horarios.length) {
                const respostas = await Promise.all(horarios.map((horario) => fetchApi(`/api/auth/availability/${horario.id}/`, { method: "DELETE" })));
                if (respostas.some((resposta) => resposta.status === 401)) {
                    router.replace("/entrar?next=%2Fprestador");
                    return;
                }
                if (respostas.some((resposta) => !resposta.ok)) {
                    const respostaFalhada = respostas.find((resposta) => !resposta.ok);
                    const dados = respostaFalhada ? await respostaFalhada.json() : null;
                    throw new Error(mensagemErro(dados, `Não foi possível desativar ${dia.label.toLocaleLowerCase("pt-AO")}.`));
                }
            }
            else {
                const resposta = await fetchApi("/api/auth/availability/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ weekday: dia.weekday, start_time: "08:00", end_time: "17:00" }),
                });
                if (resposta.status === 401) {
                    router.replace("/entrar?next=%2Fprestador");
                    return;
                }
                const dados = await resposta.json();
                if (!resposta.ok)
                    throw new Error(mensagemErro(dados, `Não foi possível ativar ${dia.label.toLocaleLowerCase("pt-AO")}.`));
            }
            const horariosAtualizados = await carregarDisponibilidade();
            if (horariosAtualizados)
                atualizarDisponibilidade(horariosAtualizados);
        }
        catch (motivo) {
            definirErro(motivo instanceof Error ? motivo.message : "Não foi possível atualizar a disponibilidade.");
        }
        finally {
            definirDiaEmAtualizacao(null);
        }
    }
    async function guardarHorario(horario) {
        const rascunho = rascunhos[horario.id];
        if (!rascunho)
            return;
        const dia = horario.weekday;
        definirDiaEmAtualizacao(dia);
        definirErro("");
        try {
            const resposta = await fetchApi(`/api/auth/availability/${horario.id}/`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ start_time: rascunho.inicio, end_time: rascunho.fim }),
            });
            if (resposta.status === 401) {
                router.replace("/entrar?next=%2Fprestador");
                return;
            }
            const dados = await resposta.json();
            if (!resposta.ok)
                throw new Error(mensagemErro(dados, "Não foi possível guardar este horário."));
            const horariosAtualizados = await carregarDisponibilidade();
            if (horariosAtualizados)
                atualizarDisponibilidade(horariosAtualizados);
        }
        catch (motivo) {
            definirErro(motivo instanceof Error ? motivo.message : "Não foi possível guardar este horário.");
        }
        finally {
            definirDiaEmAtualizacao(null);
        }
    }
    return (_jsxs("section", { className: styles.widget, "aria-labelledby": "availability-heading", children: [_jsxs("header", { className: styles.heading, children: [_jsxs("div", { children: [_jsx("p", { children: "Hor\u00E1rio semanal" }), _jsx("h2", { id: "availability-heading", children: "Disponibilidade" })] }), _jsx("span", { className: styles.headingIcon, children: _jsx(Clock3, { size: 18, "aria-hidden": "true" }) })] }), aCarregar ? (_jsxs("p", { className: styles.feedback, role: "status", children: [_jsx(LoaderCircle, { size: 16, className: styles.spinner }), " A carregar hor\u00E1rios\u2026"] })) : (_jsx("div", { className: styles.days, children: dias.map((dia) => {
                    const horarios = porDia.get(dia.weekday) ?? [];
                    const ativo = horarios.length > 0;
                    const horarioPrincipal = horarios[0];
                    const rascunho = horarioPrincipal ? rascunhos[horarioPrincipal.id] : null;
                    const emAtualizacao = diaEmAtualizacao === dia.weekday;
                    return (_jsxs("article", { className: styles.day, children: [_jsxs("div", { className: styles.dayControl, children: [_jsxs("div", { children: [_jsx("strong", { children: dia.label }), _jsx("small", { children: ativo ? `${horarios.length > 1 ? `${horarios.length} horários` : "Disponível"}` : "Indisponível" })] }), _jsx("button", { className: styles.switch, type: "button", role: "switch", "aria-label": `${ativo ? "Desativar" : "Ativar"} ${dia.label.toLocaleLowerCase("pt-AO")}`, "aria-checked": ativo, disabled: aCarregar || emAtualizacao, onClick: () => void alternarDia(dia), children: _jsx("span", {}) })] }), ativo && horarioPrincipal && rascunho ? (_jsx("div", { className: styles.timeSlots, children: horarios.map((horario, index) => {
                                    const horarioRascunho = rascunhos[horario.id];
                                    if (!horarioRascunho)
                                        return null;
                                    return (_jsxs("div", { className: styles.timeSlot, children: [horarios.length > 1 && _jsxs("span", { className: styles.slotLabel, children: ["Hor\u00E1rio ", index + 1] }), _jsxs("div", { className: styles.timeFields, children: [_jsxs("label", { children: [_jsx("span", { children: "De" }), _jsx("input", { type: "time", value: horarioRascunho.inicio, disabled: emAtualizacao, onChange: (evento) => definirRascunhos((atuais) => ({
                                                                    ...atuais,
                                                                    [horario.id]: { ...horarioRascunho, inicio: evento.target.value },
                                                                })) })] }), _jsxs("label", { children: [_jsx("span", { children: "At\u00E9" }), _jsx("input", { type: "time", value: horarioRascunho.fim, disabled: emAtualizacao, onChange: (evento) => definirRascunhos((atuais) => ({
                                                                    ...atuais,
                                                                    [horario.id]: { ...horarioRascunho, fim: evento.target.value },
                                                                })) })] }), _jsx("button", { className: styles.save, type: "button", "aria-label": `Guardar horário ${index + 1} de ${dia.label.toLocaleLowerCase("pt-AO")}`, disabled: emAtualizacao || aCarregar, onClick: () => void guardarHorario(horario), children: emAtualizacao ? _jsx(LoaderCircle, { size: 15, className: styles.spinner }) : _jsx(Check, { size: 15 }) })] })] }, horario.id));
                                }) })) : (_jsx("p", { className: styles.offline, children: "Dia de descanso" }))] }, dia.weekday));
                }) })), erro && _jsx("p", { className: styles.error, role: "alert", children: erro }), _jsx("p", { className: styles.note, children: "Os hor\u00E1rios s\u00E3o apresentados no fuso hor\u00E1rio de Luanda." })] }));
}

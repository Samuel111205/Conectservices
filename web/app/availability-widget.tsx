"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, LoaderCircle } from "lucide-react";
import styles from "./availability-widget.module.css";

type Availability = {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
};
type AvailabilityPage = { results: Availability[] };
type Day = { weekday: number; label: string };

const dias: Day[] = [
  { weekday: 0, label: "Segunda" },
  { weekday: 1, label: "Terça" },
  { weekday: 2, label: "Quarta" },
  { weekday: 3, label: "Quinta" },
  { weekday: 4, label: "Sexta" },
  { weekday: 5, label: "Sábado" },
  { weekday: 6, label: "Domingo" },
];

function horaCurta(valor: string) {
  return valor.slice(0, 5);
}

function mensagemErro(dados: unknown, fallback: string) {
  if (dados && typeof dados === "object" && "detail" in dados && typeof dados.detail === "string") {
    return dados.detail;
  }
  if (dados && typeof dados === "object") {
    const primeira = Object.values(dados).flatMap((valor) => Array.isArray(valor) ? valor : [valor])
      .find((valor) => typeof valor === "string");
    if (typeof primeira === "string") return primeira;
  }
  return fallback;
}

export default function AvailabilityWidget() {
  const router = useRouter();
  const [disponibilidade, definirDisponibilidade] = useState<Availability[]>([]);
  const [rascunhos, definirRascunhos] = useState<Record<number, { inicio: string; fim: string }>>({});
  const [aCarregar, definirCarregamento] = useState(true);
  const [diaEmAtualizacao, definirDiaEmAtualizacao] = useState<number | null>(null);
  const [erro, definirErro] = useState("");

  const porDia = useMemo(() => {
    const resultado = new Map<number, Availability[]>();
    for (const item of disponibilidade) {
      resultado.set(item.weekday, [...(resultado.get(item.weekday) ?? []), item]);
    }
    return resultado;
  }, [disponibilidade]);

  const carregarDisponibilidade = useCallback(async () => {
    const resposta = await fetch("/api/auth/availability/", { cache: "no-store" });
    if (resposta.status === 401) {
      router.replace("/entrar?next=%2Fprestador");
      return null;
    }
    const dados: unknown = await resposta.json();
    if (!resposta.ok) throw new Error(mensagemErro(dados, "Não foi possível carregar a disponibilidade."));
    return (dados as AvailabilityPage).results ?? [];
  }, [router]);

  const atualizarDisponibilidade = useCallback((itens: Availability[]) => {
    definirDisponibilidade(itens);
    definirRascunhos(Object.fromEntries(
      itens.map((item) => [item.id, {
        inicio: horaCurta(item.start_time),
        fim: horaCurta(item.end_time),
      }]),
    ));
  }, []);

  useEffect(() => {
    let ativo = true;
    carregarDisponibilidade()
      .then((itens) => { if (ativo && itens) atualizarDisponibilidade(itens); })
      .catch((motivo: unknown) => {
        if (ativo) definirErro(motivo instanceof Error ? motivo.message : "Não foi possível carregar a disponibilidade.");
      })
      .finally(() => {
        if (ativo) definirCarregamento(false);
      });
    return () => { ativo = false; };
  }, [atualizarDisponibilidade, carregarDisponibilidade]);

  async function alternarDia(dia: Day) {
    const horarios = porDia.get(dia.weekday) ?? [];
    definirDiaEmAtualizacao(dia.weekday);
    definirErro("");
    try {
      if (horarios.length) {
        const respostas = await Promise.all(horarios.map((horario) =>
          fetch(`/api/auth/availability/${horario.id}/`, { method: "DELETE" }),
        ));
        if (respostas.some((resposta) => resposta.status === 401)) {
          router.replace("/entrar?next=%2Fprestador");
          return;
        }
        if (respostas.some((resposta) => !resposta.ok)) {
          const respostaFalhada = respostas.find((resposta) => !resposta.ok);
          const dados = respostaFalhada ? await respostaFalhada.json() : null;
          throw new Error(mensagemErro(dados, `Não foi possível desativar ${dia.label.toLocaleLowerCase("pt-AO")}.`));
        }
      } else {
        const resposta = await fetch("/api/auth/availability/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekday: dia.weekday, start_time: "08:00", end_time: "17:00" }),
        });
        if (resposta.status === 401) {
          router.replace("/entrar?next=%2Fprestador");
          return;
        }
        const dados: unknown = await resposta.json();
        if (!resposta.ok) throw new Error(mensagemErro(dados, `Não foi possível ativar ${dia.label.toLocaleLowerCase("pt-AO")}.`));
      }
      const horariosAtualizados = await carregarDisponibilidade();
      if (horariosAtualizados) atualizarDisponibilidade(horariosAtualizados);
    } catch (motivo) {
      definirErro(motivo instanceof Error ? motivo.message : "Não foi possível atualizar a disponibilidade.");
    } finally {
      definirDiaEmAtualizacao(null);
    }
  }

  async function guardarHorario(horario: Availability) {
    const rascunho = rascunhos[horario.id];
    if (!rascunho) return;
    const dia = horario.weekday;
    definirDiaEmAtualizacao(dia);
    definirErro("");
    try {
      const resposta = await fetch(`/api/auth/availability/${horario.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_time: rascunho.inicio, end_time: rascunho.fim }),
      });
      if (resposta.status === 401) {
        router.replace("/entrar?next=%2Fprestador");
        return;
      }
      const dados: unknown = await resposta.json();
      if (!resposta.ok) throw new Error(mensagemErro(dados, "Não foi possível guardar este horário."));
      const horariosAtualizados = await carregarDisponibilidade();
      if (horariosAtualizados) atualizarDisponibilidade(horariosAtualizados);
    } catch (motivo) {
      definirErro(motivo instanceof Error ? motivo.message : "Não foi possível guardar este horário.");
    } finally {
      definirDiaEmAtualizacao(null);
    }
  }

  return (
    <section className={styles.widget} aria-labelledby="availability-heading">
      <header className={styles.heading}>
        <div>
          <p>Horário semanal</p>
          <h2 id="availability-heading">Disponibilidade</h2>
        </div>
        <span className={styles.headingIcon}><Clock3 size={18} aria-hidden="true" /></span>
      </header>
      {aCarregar ? (
        <p className={styles.feedback} role="status"><LoaderCircle size={16} className={styles.spinner} /> A carregar horários…</p>
      ) : (
        <div className={styles.days}>
          {dias.map((dia) => {
            const horarios = porDia.get(dia.weekday) ?? [];
            const ativo = horarios.length > 0;
            const horarioPrincipal = horarios[0];
            const rascunho = horarioPrincipal ? rascunhos[horarioPrincipal.id] : null;
            const emAtualizacao = diaEmAtualizacao === dia.weekday;
            return (
              <article className={styles.day} key={dia.weekday}>
                <div className={styles.dayControl}>
                  <div>
                    <strong>{dia.label}</strong>
                    <small>{ativo ? `${horarios.length > 1 ? `${horarios.length} horários` : "Disponível"}` : "Indisponível"}</small>
                  </div>
                  <button
                    className={styles.switch}
                    type="button"
                    role="switch"
                    aria-label={`${ativo ? "Desativar" : "Ativar"} ${dia.label.toLocaleLowerCase("pt-AO")}`}
                    aria-checked={ativo}
                    disabled={aCarregar || emAtualizacao}
                    onClick={() => void alternarDia(dia)}
                  >
                    <span />
                  </button>
                </div>
                {ativo && horarioPrincipal && rascunho ? (
                  <div className={styles.timeSlots}>
                    {horarios.map((horario, index) => {
                      const horarioRascunho = rascunhos[horario.id];
                      if (!horarioRascunho) return null;
                      return (
                        <div className={styles.timeSlot} key={horario.id}>
                          {horarios.length > 1 && <span className={styles.slotLabel}>Horário {index + 1}</span>}
                          <div className={styles.timeFields}>
                            <label>
                              <span>De</span>
                              <input
                                type="time"
                                value={horarioRascunho.inicio}
                                disabled={emAtualizacao}
                                onChange={(evento) => definirRascunhos((atuais) => ({
                                  ...atuais,
                                  [horario.id]: { ...horarioRascunho, inicio: evento.target.value },
                                }))}
                              />
                            </label>
                            <label>
                              <span>Até</span>
                              <input
                                type="time"
                                value={horarioRascunho.fim}
                                disabled={emAtualizacao}
                                onChange={(evento) => definirRascunhos((atuais) => ({
                                  ...atuais,
                                  [horario.id]: { ...horarioRascunho, fim: evento.target.value },
                                }))}
                              />
                            </label>
                            <button
                              className={styles.save}
                              type="button"
                              aria-label={`Guardar horário ${index + 1} de ${dia.label.toLocaleLowerCase("pt-AO")}`}
                              disabled={emAtualizacao || aCarregar}
                              onClick={() => void guardarHorario(horario)}
                            >
                              {emAtualizacao ? <LoaderCircle size={15} className={styles.spinner} /> : <Check size={15} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.offline}>Dia de descanso</p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {erro && <p className={styles.error} role="alert">{erro}</p>}
      <p className={styles.note}>Os horários são apresentados no fuso horário de Luanda.</p>
    </section>
  );
}

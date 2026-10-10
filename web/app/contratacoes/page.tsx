"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";

type Booking = {
  id: number;
  order_id: number;
  proposal_id: number;
  is_client: boolean;
  is_provider: boolean;
  provider_name: string;
  service_name: string | null;
  final_price: string;
  duration_minutes: number | null;
  currency: string;
  scheduled_at: string | null;
  status: "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  created_at: string;
};

type ApiPage<T> = { count: number; results: T[] };
type SlotsPayload = { date: string; timezone: string; slots: string[] };

const nomesEstados: Record<Booking["status"], string> = {
  SCHEDULED: "Por agendar",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em execução",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

function formatarData(valor: string | null) {
  if (!valor) return "Ainda sem horário marcado";
  return new Date(valor).toLocaleString("pt-AO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Luanda",
  });
}

function formatarDuracao(minutos: number | null) {
  if (!minutos) return "Duração não indicada";
  if (minutos < 60) return `${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  return minutosRestantes ? `${horas} h ${minutosRestantes} min` : `${horas} h`;
}

function obterMensagemErro(dadosRecebidos: unknown) {
  if (dadosRecebidos && typeof dadosRecebidos === "object") {
    const valores = Object.values(dadosRecebidos).flatMap((valor) =>
      Array.isArray(valor) ? valor : [valor],
    );
    const mensagem = valores.find((valor) => typeof valor === "string");
    if (typeof mensagem === "string") return mensagem;
  }
  return "Não foi possível concluir a operação.";
}

export default function PaginaContratacoes() {
  const navegador = useRouter();
  const [reservas, definirReservas] = useState<Booking[]>([]);
  const [estaCarregando, definirCarregamento] = useState(true);
  const [erro, definirErro] = useState("");
  const [datas, definirDatas] = useState<Record<number, string>>({});
  const [horarios, definirHorarios] = useState<Record<number, string[]>>({});
  const [horariosSelecionados, definirHorariosSelecionados] = useState<Record<number, string>>({});
  const [errosHorarios, definirErrosHorarios] = useState<Record<number, string>>({});
  const [idAcao, definirIdAcao] = useState<number | null>(null);
  const [erroAcao, definirErroAcao] = useState("");
  const [idErroAcao, definirIdErroAcao] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/auth/bookings/", { cache: "no-store" })
      .then(async (respostaHttp) => {
        if (respostaHttp.status === 401) {
          navegador.replace("/entrar?next=%2Fcontratacoes");
          return;
        }
        const dadosRecebidos = await respostaHttp.json();
        if (!respostaHttp.ok) throw new Error(obterMensagemErro(dadosRecebidos));
        if (ativo) definirReservas((dadosRecebidos as ApiPage<Booking>).results);
      })
      .catch((motivo: unknown) => {
        if (ativo) {
          definirErro(
            motivo instanceof Error
              ? motivo.message
              : "Não foi possível carregar as contratações.",
          );
        }
      })
      .finally(() => {
        if (ativo) definirCarregamento(false);
      });
    return () => {
      ativo = false;
    };
  }, [navegador]);

  async function carregarHorarios(idContratacao: number) {
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
      const respostaHttp = await fetch(
        `/api/auth/bookings/${idContratacao}/available-slots/?date=${encodeURIComponent(dataSelecionada)}`,
        { cache: "no-store" },
      );
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
      const disponiveis = (dadosRecebidos as SlotsPayload).slots;
      definirHorarios((atual) => ({ ...atual, [idContratacao]: disponiveis }));
      if (!disponiveis.length) {
        definirErrosHorarios((atual) => ({
          ...atual,
          [idContratacao]: "Não há horários disponíveis nessa data. Tenta outro dia.",
        }));
      }
    } catch {
      definirErrosHorarios((atual) => ({
        ...atual,
        [idContratacao]: "Não foi possível consultar os horários.",
      }));
    }
  }

  async function executarAcao(
    reserva: Booking,
    acao: "schedule" | "confirm" | "start" | "complete" | "cancel",
  ) {
    definirIdAcao(reserva.id);
    definirErroAcao("");
    definirIdErroAcao(null);
    const corpoRequisicao =
      acao === "schedule"
        ? { scheduled_at: horariosSelecionados[reserva.id] }
        : {};
    try {
      const respostaHttp = await fetch(
        `/api/auth/bookings/${reserva.id}/${acao}/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpoRequisicao),
        },
      );
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
        definirReservas((atual) =>
          atual.map((item) => (item.id === reserva.id ? (dadosRecebidos as Booking) : item)),
        );
        definirHorarios((atual) => ({ ...atual, [reserva.id]: [] }));
      } else {
        definirReservas((atual) =>
          atual.map((item) => (item.id === reserva.id ? (dadosRecebidos as Booking) : item)),
        );
      }
    } catch {
      definirErroAcao("Não foi possível contactar o serviço.");
      definirIdErroAcao(reserva.id);
    } finally {
      definirIdAcao(null);
    }
  }

  return (
    <EstruturaAutenticacao account>
      <p className={styles.eyebrow}>Serviços contratados</p>
      <h1>Contratações</h1>
      <p className={styles.intro}>
        Marca horários, acompanha o serviço e confirma a conclusão quando o
        trabalho estiver terminado.
      </p>
      <div className={styles.accountActions}>
        <Link className={styles.secondary} href="/pedidos">
          Os meus pedidos
        </Link>
        <Link className={styles.secondary} href="/prestador/pedidos">
          Pedidos para prestadores
        </Link>
      </div>
      {estaCarregando ? (
        <p className={styles.intro} aria-live="polite">
          A carregar contratações…
        </p>
      ) : erro ? (
        <p className={styles.notice} role="alert">
          {erro}
        </p>
      ) : reservas.length ? (
        <div className={styles.bookingList}>
          {reservas.map((reserva) => (
            <article className={styles.bookingCard} key={reserva.id}>
              <div className={styles.orderTopline}>
                <span className={styles.orderCategory}>
                  Contratação #{reserva.id}
                </span>
                <span className={styles.profileBadge}>
                  {nomesEstados[reserva.status]}
                </span>
              </div>
              <h2>{reserva.provider_name}</h2>
              {reserva.service_name && (
                <p className={styles.bookingService}>{reserva.service_name}</p>
              )}
              <div className={styles.orderMetadata}>
                <strong>
                  {Number(reserva.final_price).toLocaleString("pt-AO")}{" "}
                  {reserva.currency}
                </strong>
                <span>{formatarDuracao(reserva.duration_minutes)}</span>
              </div>
              <div className={styles.bookingSchedule}>
                <span>Data e hora</span>
                <strong>{formatarData(reserva.scheduled_at)}</strong>
              </div>
              {erroAcao && idErroAcao === reserva.id && (
                <p className={styles.notice} role="alert">
                  {erroAcao}
                </p>
              )}
              {reserva.status === "SCHEDULED" && reserva.is_client && (
                <div className={styles.bookingActions}>
                  <label className={styles.field}>
                    Consultar horários disponíveis
                    <input
                      type="date"
                      value={datas[reserva.id] ?? ""}
                      onChange={(evento) => {
                        definirDatas((atual) => ({
                          ...atual,
                          [reserva.id]: evento.target.value,
                        }));
                        definirHorarios((atual) => ({ ...atual, [reserva.id]: [] }));
                        definirHorariosSelecionados((atual) => ({
                          ...atual,
                          [reserva.id]: "",
                        }));
                      }}
                    />
                  </label>
                  <button
                    className={styles.secondary}
                    type="button"
                    disabled={idAcao === reserva.id}
                    onClick={() => void carregarHorarios(reserva.id)}
                  >
                    Ver horários
                  </button>
                  {horarios[reserva.id]?.length ? (
                    <>
                      <label className={styles.field}>
                        Horário disponível (hora de Luanda)
                        <select
                          value={horariosSelecionados[reserva.id] ?? ""}
                          onChange={(evento) =>
                            definirHorariosSelecionados((atual) => ({
                              ...atual,
                              [reserva.id]: evento.target.value,
                            }))
                          }
                        >
                          <option value="">Seleciona um horário</option>
                          {horarios[reserva.id].map((slot) => (
                            <option key={slot} value={slot}>
                              {new Date(slot).toLocaleTimeString("pt-AO", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "Africa/Luanda",
                              })}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className={styles.submitLink}
                        type="button"
                        disabled={
                          idAcao === reserva.id || !horariosSelecionados[reserva.id]
                        }
                        onClick={() => void executarAcao(reserva, "schedule")}
                      >
                        Marcar horário
                      </button>
                    </>
                  ) : null}
                  {errosHorarios[reserva.id] && (
                    <p className={styles.notice} role="alert">
                      {errosHorarios[reserva.id]}
                    </p>
                  )}
                </div>
              )}
              {reserva.status === "SCHEDULED" && reserva.is_provider && (
                <div className={styles.bookingActions}>
                  <button
                    className={styles.dangerButton}
                    type="button"
                    disabled={idAcao === reserva.id}
                    onClick={() => void executarAcao(reserva, "cancel")}
                  >
                    Cancelar contratação
                  </button>
                </div>
              )}
              {reserva.status === "SCHEDULED" &&
                reserva.scheduled_at &&
                reserva.is_client && (
                <div className={styles.bookingActions}>
                  <button
                    className={styles.submitLink}
                    type="button"
                    disabled={idAcao === reserva.id}
                    onClick={() => void executarAcao(reserva, "confirm")}
                  >
                    Confirmar horário
                  </button>
                </div>
              )}
              {reserva.status === "CONFIRMED" && (
                <div className={styles.bookingActions}>
                  {reserva.is_client && (
                    <p className={styles.profileHint}>
                      O prestador pode iniciar o serviço quando chegar a hora
                      combinada.
                    </p>
                  )}
                  {reserva.is_provider && (
                    <button
                      className={styles.submitLink}
                      type="button"
                      disabled={idAcao === reserva.id}
                      onClick={() => void executarAcao(reserva, "start")}
                    >
                      Iniciar serviço
                    </button>
                  )}
                  <button
                    className={styles.dangerButton}
                    type="button"
                    disabled={idAcao === reserva.id}
                    onClick={() => void executarAcao(reserva, "cancel")}
                  >
                    Cancelar contratação
                  </button>
                </div>
              )}
              {reserva.status === "IN_PROGRESS" && (
                <div className={styles.bookingActions}>
                  {reserva.is_client ? (
                    <>
                      <p className={styles.profileHint}>
                        Depois de verificar o serviço concluído, confirma aqui.
                      </p>
                      <button
                        className={styles.submitLink}
                        type="button"
                        disabled={idAcao === reserva.id}
                        onClick={() => void executarAcao(reserva, "complete")}
                      >
                        Confirmar conclusão
                      </button>
                    </>
                  ) : (
                    <p className={styles.profileHint}>
                      O cliente confirma a conclusão depois de verificar o
                      serviço.
                    </p>
                  )}
                </div>
              )}
              {reserva.status === "COMPLETED" && (
                <p className={`${styles.notice} ${styles.success}`}>
                  Serviço concluído. A avaliação estará disponível na próxima
                  etapa.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.orderEmpty}>
          <h2>Ainda não tens contratações.</h2>
          <p>
            Quando aceitares uma proposta, a contratação aparecerá nesta página.
          </p>
          <Link className={styles.submitLink} href="/pedidos">
            Ver os meus pedidos
          </Link>
        </div>
      )}
    </EstruturaAutenticacao>
  );
}

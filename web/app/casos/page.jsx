"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchApi } from "@/lib/api-client";
import EstruturaAutenticacao from "../auth-shell";
import styles from "./page.module.css";

const categorias = [
  ["SERVICE_NOT_DELIVERED", "Serviço não prestado"],
  ["LATE_OR_NO_SHOW", "Atraso ou falta de comparência"],
  ["QUALITY", "Qualidade do serviço"],
  ["SCOPE_OR_PRICE", "Âmbito ou preço"],
  ["INTERRUPTION", "Interrupção do serviço"],
  ["REFUND", "Reembolso"],
  ["OTHER", "Outro"],
];

const estadosCaso = {
  OPEN: "Aberta",
  UNDER_REVIEW: "Em análise",
  RESOLVED: "Resolvida",
  CLOSED: "Fechada",
};

const estadosReembolso = {
  REQUESTED: "A aguardar análise",
  APPROVED: "A aguardar devolução do prestador",
  REJECTED: "Rejeitado",
  PAID: "Confirmado pelo prestador",
  CANCELLED: "Cancelado",
};

function mensagemErro(dados) {
  if (dados && typeof dados === "object") {
    const valores = Object.values(dados).flatMap((valor) => Array.isArray(valor) ? valor : [valor]);
    const mensagem = valores.find((valor) => typeof valor === "string");
    if (mensagem) return mensagem;
  }
  return "Não foi possível concluir. Tenta novamente.";
}

async function respostaJson(resposta) {
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = new Error(mensagemErro(dados));
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

export default function CasosPage() {
  const [accountId, setAccountId] = useState(null);
  const [contratacoes, setContratacoes] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [disputas, setDisputas] = useState([]);
  const [reembolsos, setReembolsos] = useState([]);
  const [disputaSelecionada, setDisputaSelecionada] = useState(() => {
    if (typeof window === "undefined") return null;
    const id = Number(new URLSearchParams(window.location.search).get("disputa"));
    return Number.isInteger(id) && id > 0 ? id : null;
  });
  const [mensagens, setMensagens] = useState([]);
  const [mensagem, setMensagem] = useState("");
  const [contratacaoDisputa, setContratacaoDisputa] = useState("");
  const [categoria, setCategoria] = useState("SERVICE_NOT_DELIVERED");
  const [descricao, setDescricao] = useState("");
  const [contratacaoReembolso, setContratacaoReembolso] = useState("");
  const [montante, setMontante] = useState("");
  const [motivoReembolso, setMotivoReembolso] = useState("");
  const [referencias, setReferencias] = useState({});
  const [estaCarregando, setEstaCarregando] = useState(true);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const carregarDados = useCallback(async () => {
    setErro("");
    try {
      const [me, bookingPage, paymentPage, disputePage, refundPage] = await Promise.all([
        fetchApi("/api/auth/me/", { cache: "no-store" }).then(respostaJson),
        fetchApi("/api/auth/bookings/", { cache: "no-store" }).then(respostaJson),
        fetchApi("/api/auth/payments/", { cache: "no-store" }).then(respostaJson),
        fetchApi("/api/auth/disputes/", { cache: "no-store" }).then(respostaJson),
        fetchApi("/api/auth/refund-requests/", { cache: "no-store" }).then(respostaJson),
      ]);
      setAccountId(me.id);
      setContratacoes(bookingPage.results ?? []);
      setPagamentos(paymentPage.results ?? []);
      setDisputas(disputePage.results ?? []);
      setReembolsos(refundPage.results ?? []);
    } catch (reason) {
      if (reason?.status === 401) {
        window.location.assign("/entrar?next=%2Fcasos");
        return;
      }
      setErro(reason instanceof Error ? reason.message : "Não foi possível carregar os casos.");
    } finally {
      setEstaCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    let activo = true;
    if (!disputaSelecionada) {
      setMensagens([]);
      return () => { activo = false; };
    }
    setMensagens([]);
    fetchApi(`/api/auth/disputes/${disputaSelecionada}/messages/`, { cache: "no-store" })
      .then(respostaJson)
      .then((page) => { if (activo) setMensagens(page.results ?? page); })
      .catch((reason) => { if (activo) setErro(reason.message); });
    return () => { activo = false; };
  }, [disputaSelecionada]);

  const pagamentosConfirmados = useMemo(
    () => new Set(pagamentos.filter((item) => item.status === "CONFIRMED").map((item) => item.booking_id)),
    [pagamentos],
  );
  const contratacoesComPagamento = useMemo(
    () => contratacoes.filter((item) => item.is_client && pagamentosConfirmados.has(item.id)),
    [contratacoes, pagamentosConfirmados],
  );
  const contratacoesSemDisputaActiva = useMemo(() => {
    const activas = new Set(
      disputas
        .filter((item) => ["OPEN", "UNDER_REVIEW"].includes(item.status))
        .map((item) => item.booking_id),
    );
    return contratacoes.filter((item) => !activas.has(item.id));
  }, [contratacoes, disputas]);
  const casoActual = disputas.find((item) => item.id === disputaSelecionada);

  async function enviar(url, payload, mensagemSucesso) {
    setAEnviar(true);
    setErro("");
    setAviso("");
    try {
      await respostaJson(await fetchApi(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      setAviso(mensagemSucesso);
      await carregarDados();
      return true;
    } catch (reason) {
      setErro(reason instanceof Error ? reason.message : "Não foi possível contactar o serviço.");
      return false;
    } finally {
      setAEnviar(false);
    }
  }

  async function abrirDisputa(evento) {
    evento.preventDefault();
    if (!contratacaoDisputa || !descricao.trim()) return;
    const criada = await enviar("/api/auth/disputes/", {
      booking_id: Number(contratacaoDisputa), category: categoria, description: descricao.trim(),
    }, "Disputa aberta. A outra parte será notificada.");
    if (criada) {
      setDescricao("");
      setDisputaSelecionada(null);
    }
  }

  async function enviarMensagem(evento) {
    evento.preventDefault();
    if (!mensagem.trim() || !disputaSelecionada) return;
    const enviada = await enviar(
      `/api/auth/disputes/${disputaSelecionada}/messages/`,
      { body: mensagem.trim() },
      "Mensagem enviada.",
    );
    if (enviada) {
      setMensagem("");
      const page = await fetchApi(`/api/auth/disputes/${disputaSelecionada}/messages/`, { cache: "no-store" }).then(respostaJson);
      setMensagens(page.results ?? page);
    }
  }

  async function pedirReembolso(evento) {
    evento.preventDefault();
    if (!contratacaoReembolso || !montante || !motivoReembolso.trim()) return;
    const criado = await enviar("/api/auth/refund-requests/", {
      booking_id: Number(contratacaoReembolso), amount: montante, reason: motivoReembolso.trim(),
    }, "Pedido registado. O prestador terá de efectuar a devolução fora da plataforma.");
    if (criado) {
      setMontante("");
      setMotivoReembolso("");
    }
  }

  async function confirmarDevolucao(pedido) {
    const referencia = referencias[pedido.id]?.trim();
    if (!referencia) {
      setErro("Indica a referência da transferência antes de confirmar.");
      return;
    }
    const confirmado = await enviar(
      `/api/auth/refund-requests/${pedido.id}/confirm-paid/`,
      { payout_reference: referencia },
      "Devolução registada como confirmada pelo prestador.",
    );
    if (confirmado) setReferencias((actual) => ({ ...actual, [pedido.id]: "" }));
  }

  async function cancelarPedidoReembolso(pedido) {
    await enviar(
      `/api/auth/refund-requests/${pedido.id}/cancel/`,
      {},
      "O pedido de reembolso foi cancelado.",
    );
  }

  return (
    <EstruturaAutenticacao account area={undefined}>
      <main className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>APOIO À CONTRATAÇÃO</p>
          <h1>Disputas e reembolsos</h1>
          <p>Acompanha um caso, conversa com a outra parte e consulta o estado de uma devolução.</p>
        </header>

        {erro ? <p className={styles.error} role="alert">{erro}</p> : null}
        {aviso ? <p className={styles.success} role="status">{aviso}</p> : null}
        {estaCarregando ? <p role="status">A carregar os teus casos…</p> : null}

        <section className={styles.panel} aria-labelledby="titulo-disputas">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>RESOLUÇÃO DE PROBLEMAS</p><h2 id="titulo-disputas">Disputas</h2></div>
            <span>{disputas.length} {disputas.length === 1 ? "caso" : "casos"}</span>
          </div>
          <div className={styles.disputeGrid}>
            <div className={styles.formCard}>
              <h3>Abrir uma disputa</h3>
              <p>Escolhe a contratação e explica o que aconteceu. Não incluas dados bancários ou credenciais.</p>
              <form onSubmit={abrirDisputa} className={styles.form}>
                <label>Contratação
                  <select required value={contratacaoDisputa} onChange={(event) => setContratacaoDisputa(event.target.value)}>
                    <option value="">Selecciona uma contratação</option>
                    {contratacoesSemDisputaActiva.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.provider_name} · {nomesEstado(item.status)}</option>)}
                  </select>
                </label>
                <label>Motivo
                  <select value={categoria} onChange={(event) => setCategoria(event.target.value)}>
                    {categorias.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>Descrição
                  <textarea required maxLength={5000} rows={4} value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Descreve os factos e o que precisas de resolver." />
                </label>
                <button className={styles.primary} disabled={aEnviar || !contratacaoDisputa || !descricao.trim()} type="submit">{aEnviar ? "A enviar…" : "Abrir disputa"}</button>
              </form>
            </div>
            <div className={styles.caseList} aria-label="Disputas existentes">
              {!disputas.length && !estaCarregando ? <p className={styles.empty}>Ainda não tens disputas. Se surgir um problema, podes iniciar uma aqui.</p> : null}
              {disputas.map((item) => (
                <button key={item.id} type="button" className={`${styles.caseItem} ${disputaSelecionada === item.id ? styles.caseSelected : ""}`} onClick={() => setDisputaSelecionada(item.id)}>
                  <span className={styles.caseTop}><strong>Disputa #{item.id} · Contratação #{item.booking_id}</strong><span>{estadosCaso[item.status] ?? item.status}</span></span>
                  <span>{categorias.find(([value]) => value === item.category)?.[1] ?? item.category}</span>
                  <span className={styles.muted}>{item.description}</span>
                </button>
              ))}
            </div>
          </div>
          {disputaSelecionada ? (
            <div className={styles.conversation}>
              <h3>Conversa da disputa #{disputaSelecionada}</h3>
              <div className={styles.messages} aria-live="polite">
                {mensagens.map((item) => <article key={item.id} className={styles.message}><p>{item.body}</p><time>{new Date(item.created_at).toLocaleString("pt-AO")}</time></article>)}
                {!mensagens.length ? <p className={styles.empty}>Ainda não há respostas neste caso.</p> : null}
              </div>
              {casoActual && ["OPEN", "UNDER_REVIEW"].includes(casoActual.status) ? (
                <form onSubmit={enviarMensagem} className={styles.messageForm}>
                  <label className={styles.srOnly} htmlFor="mensagem-disputa">Mensagem para a disputa</label>
                  <textarea id="mensagem-disputa" maxLength={4000} rows={2} value={mensagem} onChange={(event) => setMensagem(event.target.value)} placeholder="Escreve uma resposta…" />
                  <button className={styles.primary} disabled={aEnviar || !mensagem.trim()} type="submit">Enviar</button>
                </form>
              ) : <p className={styles.empty}>Este caso já não aceita novas mensagens.</p>}
            </div>
          ) : null}
        </section>

        <section className={styles.panel} aria-labelledby="titulo-reembolsos">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>DEVOLUÇÃO DE VALORES</p><h2 id="titulo-reembolsos">Reembolsos</h2></div>
            <span>{reembolsos.length} {reembolsos.length === 1 ? "pedido" : "pedidos"}</span>
          </div>
          <p className={styles.notice}>A plataforma não movimenta o dinheiro. O prestador efectua a devolução e regista a referência do pagamento.</p>
          {contratacoesComPagamento.length ? (
            <form onSubmit={pedirReembolso} className={styles.refundForm}>
              <label>Contratação
                <select required value={contratacaoReembolso} onChange={(event) => setContratacaoReembolso(event.target.value)}>
                  <option value="">Selecciona uma contratação com pagamento confirmado</option>
                  {contratacoesComPagamento.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.provider_name} · {item.final_price} {item.currency}</option>)}
                </select>
              </label>
              <label>Valor a pedir ({contratacoesComPagamento.find((item) => String(item.id) === contratacaoReembolso)?.currency ?? "AOA"})
                <input required inputMode="decimal" min="0.01" step="0.01" type="number" value={montante} onChange={(event) => setMontante(event.target.value)} />
              </label>
              <label>Motivo
                <textarea required maxLength={3000} rows={3} value={motivoReembolso} onChange={(event) => setMotivoReembolso(event.target.value)} />
              </label>
              <button className={styles.primary} disabled={aEnviar || !contratacaoReembolso || !montante || !motivoReembolso.trim()} type="submit">Pedir reembolso</button>
            </form>
          ) : <p className={styles.empty}>Os pedidos de reembolso ficam disponíveis quando existe um pagamento confirmado numa contratação tua.</p>}
          <div className={styles.refundList}>
            {reembolsos.map((pedido) => {
              const booking = contratacoes.find((item) => item.id === pedido.booking_id);
              return (
                <article className={styles.refundCard} key={pedido.id}>
                  <div className={styles.caseTop}><strong>Pedido #{pedido.id} · Contratação #{pedido.booking_id}</strong><span>{estadosReembolso[pedido.status] ?? pedido.status}</span></div>
                  <p>{pedido.amount} {pedido.currency} · {pedido.reason}</p>
                  {pedido.decision_note ? <p className={styles.muted}>Nota: {pedido.decision_note}</p> : null}
                  {booking?.is_provider && pedido.status === "APPROVED" ? (
                    <div className={styles.confirmRow}>
                      <label>Referência da transferência
                        <input maxLength={120} value={referencias[pedido.id] ?? ""} onChange={(event) => setReferencias((actual) => ({ ...actual, [pedido.id]: event.target.value }))} />
                      </label>
                      <button className={styles.secondary} disabled={aEnviar || !referencias[pedido.id]?.trim()} onClick={() => void confirmarDevolucao(pedido)} type="button">Confirmar devolução</button>
                    </div>
                  ) : null}
                  {pedido.payout_reference ? <p className={styles.muted}>Referência registada: {pedido.payout_reference}</p> : null}
                  {pedido.requested_by_id === accountId && pedido.status === "REQUESTED" ? (
                    <button className={styles.secondary} disabled={aEnviar} onClick={() => void cancelarPedidoReembolso(pedido)} type="button">Cancelar pedido</button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </EstruturaAutenticacao>
  );
}

function nomesEstado(status) {
  return ({ SCHEDULED: "Por agendar", CONFIRMED: "Confirmada", IN_PROGRESS: "Em execução", COMPLETED: "Concluída", CANCELLED: "Cancelada" })[status] ?? status;
}

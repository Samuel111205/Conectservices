"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiRequestError, requisitarJson } from "@/lib/api-client";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";

type Conversation = {
  id: number;
  order_id: number;
  order_title: string;
  order_status: string;
  proposal_status: string;
  contact_name: string;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
};

type Message = {
  id: number;
  sender_id: number;
  body: string;
  created_at: string;
};

type ApiPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type Account = { id: number };

function obterPaginaSeguinte(url: string | null) {
  if (!url) return null;
  return new URL(url, window.location.origin).searchParams.get("page");
}

function formatarData(valor: string | null) {
  if (!valor) return "Sem mensagens";
  return new Date(valor).toLocaleString("pt-AO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function podeEnviarMensagem(conversa: Conversation) {
  return (
    ["PENDING", "ACCEPTED"].includes(conversa.proposal_status) &&
    conversa.order_status !== "CANCELLED"
  );
}

export default function PaginaMensagens() {
  const navegador = useRouter();
  const [conversas, definirConversas] = useState<Conversation[]>([]);
  const [utilizadorId, definirUtilizadorId] = useState<number | null>(null);
  const [conversaSelecionada, definirConversaSelecionada] = useState<number | null>(null);
  const [mensagens, definirMensagens] = useState<Message[]>([]);
  const [texto, definirTexto] = useState("");
  const [erro, definirErro] = useState("");
  const [erroEnvio, definirErroEnvio] = useState("");
  const [estaCarregando, definirCarregamento] = useState(true);
  const [estaCarregandoMensagens, definirCarregamentoMensagens] = useState(false);
  const [estaCarregandoAntigas, definirCarregamentoAntigas] = useState(false);
  const [estaAEnviar, definirEnvio] = useState(false);
  const [paginaAntiga, definirPaginaAntiga] = useState<string | null>(null);
  const pedidoMensagensAtual = useRef(0);

  const carregarMensagens = useCallback(
    async (idConversa: number, pagina: string | null = null) => {
      const pedidoAtual = ++pedidoMensagensAtual.current;
      if (pagina) definirCarregamentoAntigas(true);
      else definirCarregamentoMensagens(true);
      definirErroEnvio("");
      try {
        const consulta = pagina ? `?page=${encodeURIComponent(pagina)}` : "";
        const dados = await requisitarJson<ApiPage<Message>>(
          `/api/auth/conversations/${idConversa}/messages/${consulta}`,
        );
        if (pedidoAtual !== pedidoMensagensAtual.current) return;
        const novasMensagens = [...dados.results].reverse();
        if (pagina) {
          definirMensagens((atuais) => {
            const ids = new Set(atuais.map((mensagem) => mensagem.id));
            return [...novasMensagens.filter((mensagem) => !ids.has(mensagem.id)), ...atuais];
          });
        } else {
          definirMensagens(novasMensagens);
        }
        definirPaginaAntiga(obterPaginaSeguinte(dados.next));
        definirConversas((atuais) =>
          atuais.map((conversa) =>
            conversa.id === idConversa
              ? { ...conversa, unread_count: 0 }
              : conversa,
          ),
        );
      } catch (motivo) {
        if (pedidoAtual !== pedidoMensagensAtual.current) return;
        if (motivo instanceof ApiRequestError && motivo.status === 401) {
          navegador.replace("/entrar?next=%2Fmensagens");
        } else {
          definirErroEnvio(
            motivo instanceof Error
              ? motivo.message
              : "Não foi possível carregar as mensagens.",
          );
        }
      } finally {
        if (pedidoAtual === pedidoMensagensAtual.current) {
          definirCarregamentoMensagens(false);
          definirCarregamentoAntigas(false);
        }
      }
    },
    [navegador],
  );

  const carregarConversas = useCallback(async () => {
    definirErro("");
    try {
      const [pagina, conta] = await Promise.all([
        requisitarJson<ApiPage<Conversation>>("/api/auth/conversations/"),
        requisitarJson<Account>("/api/auth/me/"),
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
      } else {
        definirConversaSelecionada(null);
        definirMensagens([]);
      }
    } catch (motivo) {
      if (motivo instanceof ApiRequestError && motivo.status === 401) {
        navegador.replace("/entrar?next=%2Fmensagens");
      } else {
        definirErro(
          motivo instanceof Error
            ? motivo.message
            : "Não foi possível carregar as conversas.",
        );
      }
    } finally {
      definirCarregamento(false);
    }
  }, [carregarMensagens, navegador]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void carregarConversas(), 0);
    return () => window.clearTimeout(timeout);
  }, [carregarConversas]);

  function selecionarConversa(conversa: Conversation) {
    definirConversaSelecionada(conversa.id);
    definirMensagens([]);
    definirPaginaAntiga(null);
    window.history.replaceState(null, "", `/mensagens?conversa=${conversa.id}`);
    void carregarMensagens(conversa.id);
  }

  async function enviarMensagem(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const conversa = conversas.find((item) => item.id === conversaSelecionada);
    const corpo = texto.trim();
    if (!conversa || !corpo || !podeEnviarMensagem(conversa)) return;

    definirEnvio(true);
    definirErroEnvio("");
    try {
      const mensagem = await requisitarJson<Message>(
        `/api/auth/conversations/${conversa.id}/messages/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: corpo }),
        },
      );
      definirMensagens((atuais) => [...atuais, mensagem]);
      definirTexto("");
      definirConversas((atuais) =>
        atuais.map((item) =>
          item.id === conversa.id
            ? {
                ...item,
                last_message_preview: mensagem.body,
                last_message_at: mensagem.created_at,
              }
            : item,
        ),
      );
    } catch (motivo) {
      if (motivo instanceof ApiRequestError && motivo.status === 401) {
        navegador.replace("/entrar?next=%2Fmensagens");
      } else {
        definirErroEnvio(
          motivo instanceof Error
            ? motivo.message
            : "Não foi possível enviar a mensagem.",
        );
      }
    } finally {
      definirEnvio(false);
    }
  }

  const conversaAtiva = conversas.find((item) => item.id === conversaSelecionada);

  return (
    <EstruturaAutenticacao account>
      <p className={styles.eyebrow}>Contacto direto</p>
      <h1>Mensagens</h1>
      <p className={styles.intro}>
        Combina os detalhes do serviço com clientes e prestadores ligados às tuas propostas.
      </p>

      {estaCarregando ? (
        <p className={styles.intro} aria-live="polite">A carregar conversas…</p>
      ) : erro ? (
        <div className={styles.notice} role="alert">
          <p>{erro}</p>
          <button className={styles.secondary} type="button" onClick={() => void carregarConversas()}>
            Tentar novamente
          </button>
        </div>
      ) : conversas.length === 0 ? (
        <section className={styles.messageEmpty}>
          <span className={styles.messageEmptyIcon} aria-hidden="true">✉</span>
          <h2>Ainda não tens conversas</h2>
          <p>Quando receberes ou enviares uma proposta, podes falar diretamente com a outra pessoa.</p>
          <Link className={styles.secondary} href="/pedidos">Ver pedidos e propostas</Link>
        </section>
      ) : (
        <section className={styles.conversationLayout} aria-label="Conversas">
          <aside className={styles.conversationSidebar}>
            <div className={styles.messageSectionHeading}>
              <h2>As tuas conversas</h2>
              <button
                className={styles.messageRefresh}
                type="button"
                aria-label="Atualizar conversas e mensagens"
                onClick={() => void carregarConversas()}
              >
                Atualizar
              </button>
            </div>
            <ul className={styles.conversationList}>
              {conversas.map((conversa) => (
                <li key={conversa.id}>
                  <button
                    className={`${styles.conversationItem} ${conversa.id === conversaSelecionada ? styles.conversationItemActive : ""}`}
                    type="button"
                    aria-current={conversa.id === conversaSelecionada ? "true" : undefined}
                    onClick={() => selecionarConversa(conversa)}
                  >
                    <span className={styles.conversationItemTop}>
                      <strong>{conversa.contact_name}</strong>
                      {conversa.unread_count > 0 && (
                        <span className={styles.unreadBadge} aria-label={`${conversa.unread_count} mensagens não lidas`}>
                          {conversa.unread_count}
                        </span>
                      )}
                    </span>
                    <span className={styles.conversationOrder}>{conversa.order_title}</span>
                    <span className={styles.conversationPreview}>
                      {conversa.last_message_preview ?? "Inicia a conversa sobre esta proposta."}
                    </span>
                    <time className={styles.conversationDate}>
                      {formatarData(conversa.last_message_at)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {conversaAtiva && (
            <div className={styles.messageThread}>
              <header className={styles.messageThreadHeader}>
                <div>
                  <p className={styles.messageThreadEyebrow}>Pedido #{conversaAtiva.order_id}</p>
                  <h2>{conversaAtiva.contact_name}</h2>
                  <p>{conversaAtiva.order_title}</p>
                </div>
                <Link className={styles.messageOrderLink} href="/pedidos">
                  Ver pedidos
                </Link>
              </header>

              <div className={styles.messageHistory} aria-live="polite" aria-label="Histórico de mensagens">
                {paginaAntiga && (
                  <button
                    className={styles.loadOlder}
                    type="button"
                    disabled={estaCarregandoAntigas}
                    onClick={() => void carregarMensagens(conversaAtiva.id, paginaAntiga)}
                  >
                    {estaCarregandoAntigas ? "A carregar…" : "Carregar mensagens anteriores"}
                  </button>
                )}
                {estaCarregandoMensagens ? (
                  <p className={styles.profileHint} aria-live="polite">A carregar mensagens…</p>
                ) : mensagens.length ? (
                  mensagens.map((mensagem) => {
                    const eMinha = mensagem.sender_id === utilizadorId;
                    return (
                      <article
                        className={`${styles.messageBubble} ${eMinha ? styles.messageBubbleMine : styles.messageBubbleOther}`}
                        key={mensagem.id}
                      >
                        <p>{mensagem.body}</p>
                        <time>{formatarData(mensagem.created_at)}</time>
                      </article>
                    );
                  })
                ) : (
                  <p className={styles.messageFirst}>Ainda não há mensagens. Envia a primeira.</p>
                )}
              </div>

              {erroEnvio && <p className={styles.notice} role="alert">{erroEnvio}</p>}
              {podeEnviarMensagem(conversaAtiva) ? (
                <form className={styles.messageComposer} onSubmit={enviarMensagem}>
                  <label className={styles.visuallyHidden} htmlFor="mensagem">Escreve a tua mensagem</label>
                  <textarea
                    id="mensagem"
                    maxLength={5000}
                    rows={3}
                    placeholder="Escreve uma mensagem…"
                    value={texto}
                    onChange={(evento) => definirTexto(evento.target.value)}
                  />
                  <div className={styles.messageComposerFooter}>
                    <span>{texto.length}/5000</span>
                    <button className={styles.submit} type="submit" disabled={estaAEnviar || !texto.trim()}>
                      {estaAEnviar ? "A enviar…" : "Enviar mensagem"}
                    </button>
                  </div>
                </form>
              ) : (
                <p className={styles.messageClosed} role="status">
                  Esta conversa está encerrada e já não aceita novas mensagens.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </EstruturaAutenticacao>
  );
}
